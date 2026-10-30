import {protect} from './i18n.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateAnnotations(items){
 if(!Array.isArray(items)||items.length>1000)throw Error('書き込みは1000件までです。');
 let total=0;for(const a of items){
  if(!a||!['pen','marker','rect','text'].includes(a.tool)||!/^#[\da-f]{6}$/i.test(a.color)||!Number.isFinite(a.width)||a.width<1||a.width>40||!Array.isArray(a.points)||!a.points.length||a.points.length>4000||a.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<0||v>1))||typeof a.text!=='string'||a.text.length>200)throw Error('会場図の書き込みが不正です。');
  total+=a.points.length;if(total>100000)throw Error('書き込みが多すぎます。不要な線を削除してください。');
 }
 return items;
}
export function annotationSVG(items,protectText=false){return items.map((a,i)=>{
 const p=a.points.map(p=>p.map(v=>v*1000)),first=p[0],last=p.at(-1);
 const style=`data-annotation="${i}" stroke="${a.color}" stroke-width="${a.width}" stroke-linecap="round" stroke-linejoin="round"`;
 if(a.tool==='text')return `<text data-annotation="${i}" x="${first[0]}" y="${first[1]}" fill="${a.color}" font-size="${a.width*4+12}" stroke="none">${protectText?protect(esc(a.text)):esc(a.text)}</text>`;
 if(a.tool==='rect')return `<rect ${style} x="${Math.min(first[0],last[0])}" y="${Math.min(first[1],last[1])}" width="${Math.abs(last[0]-first[0])}" height="${Math.abs(last[1]-first[1])}" fill="${a.color}" fill-opacity=".2"/>`;
 return `<polyline ${style} points="${p.length===1?[p[0], [p[0][0]+.1,p[0][1]+.1]].map(p=>p.join(',')).join(' '):p.map(p=>p.join(',')).join(' ')}" fill="none" opacity="${a.tool==='marker'?'.35':'1'}"/>`;
 }).join('')}
export const annotationLayer=items=>`<svg class="map-annotations" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="会場図への書き込み">${annotationSVG(items,true)}</svg>`;
export function annotationToolbar(s,items){
 const icons={move:'draw-move',pen:'edit',marker:'draw-marker',rect:'draw-rect',text:'draw-text',erase:'trash',undo:'draw-undo',redo:'draw-undo',done:'tasks'};
 const btn=(tool,label,disabled=false)=>`<button type="button" class="map-round ${tool==='redo'?'flip-icon':''}" data-draw-tool="${tool}" aria-label="${label}" title="${label}" ${disabled?'disabled':''} ${['undo','redo','done'].includes(tool)?'':`aria-pressed="${s.tool===tool}"`}><img src="./icons/${icons[tool]}.svg" alt=""></button>`;
 return `<div class="map-edit-toolbar" role="group" aria-label="会場図の編集">${[['move','移動'],['pen','ペン'],['marker','蛍光ペン'],['rect','四角'],['text','文字'],['erase','書き込みを削除']].map(([t,l])=>btn(t,l)).join('')}<label class="map-color-control" title="色"><input id="map-draw-color" type="color" aria-label="書き込みの色" value="${s.color}"></label><select id="map-draw-width" aria-label="線の太さ">${[2,5,10,20,30].map(n=>`<option value="${n}" ${n===s.width?'selected':''}>${n}</option>`).join('')}</select>${btn('undo','元に戻す',!s.undo.length)}${btn('redo','やり直す',!s.redo.length)}${btn('done','編集を終了')}</div>`;
}
export function mountAnnotations(viewport,s,getItems,save,modal,field,toast){
 const svg=viewport.querySelector('.map-annotations');if(!svg)return;
 let draft=null,points=new Map(),gesture=null;
 const normalized=ev=>{const r=svg.getBoundingClientRect();return [Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height))]};
 const paint=()=>svg.innerHTML=annotationSVG([...getItems(),...(draft?[draft]:[])]);
 const consume=e=>{e.preventDefault();e.stopImmediatePropagation()};
 const commit=async items=>{try{await save(items)}catch(e){toast(e.message);paint()}};
 viewport.addEventListener('pointerdown',ev=>{
  if(!s.edit||s.tool==='move'||ev.target.closest('button'))return;
  consume(ev);viewport.setPointerCapture(ev.pointerId);points.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(points.size===2){draft=null;paint();const [a,b]=[...points.values()];gesture={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};return}
  if(points.size!==1)return;
  const p=normalized(ev);
  if(s.tool==='erase'){
   // Capture hit target before pointer capture retargets subsequent events.
   const hit=ev.target.closest('[data-annotation]');if(hit){const items=getItems().slice();items.splice(Number(hit.dataset.annotation),1);s.redo=[];commit(items)}return;
  }
  if(s.tool==='text'){points.clear();modal('会場図に文字を追加',field('文字','map-text','','text','required maxlength="200"'),async f=>{const text=String(f.get('map-text')).trim();if(!text)throw Error('文字を入力してください。');s.redo=[];await save([...getItems(),{tool:'text',color:s.color,width:s.width,points:[p],text}])});return}
  draft={tool:s.tool,color:s.color,width:s.tool==='marker'?Math.max(10,s.width):s.width,points:[p],text:''};paint();
 },true);
 viewport.addEventListener('pointermove',ev=>{
  if(!points.has(ev.pointerId))return;consume(ev);points.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(points.size===2&&gesture){const [a,b]=[...points.values()],x=(a.x+b.x)/2,y=(a.y+b.y)/2,distance=Math.hypot(a.x-b.x,a.y-b.y);viewport._zoomAt(distance/Math.max(1,gesture.distance),x,y);viewport._panBy(x-gesture.x,y-gesture.y);gesture={distance,x,y};return}
  if(!draft)return;const p=normalized(ev);if(draft.tool==='rect')draft.points=[draft.points[0],p];else if(draft.points.length<4000)draft.points.push(p);paint();
 },true);
 viewport.addEventListener('pointerup',ev=>{
  if(!points.has(ev.pointerId))return;consume(ev);points.delete(ev.pointerId);if(gesture){draft=null;if(!points.size)gesture=null;paint();return}
  if(draft){const item=draft;draft=null;s.redo=[];commit([...getItems(),item])}
 },true);
 viewport.addEventListener('pointercancel',ev=>{if(!points.has(ev.pointerId))return;consume(ev);points.clear();gesture=null;draft=null;paint()},true);
}
