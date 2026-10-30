import {installMapEditGuard,syncMapEditGuard} from './map-edit-guard.mjs';
import {markerStyle,mountMarkerEditor} from './circle-marker.mjs';
import {distributionMapFile,loadDistributionMaps,mergeDistributionMaps,citationText,distributionVectorImage} from './distribution-maps.mjs';
import {openMapImport} from './pdf-map-ui.mjs';
import {mapSteps} from './map-steps.mjs';
import {protect,markup,t} from './i18n.mjs';
import {annotationLayer,annotationToolbar,mountAnnotations} from './map-annotations.mjs';
import {emptyMap,newCircle,validateMap,importCircles,setPosition,mapHalls,validLink,addHall,renameHall,deleteHall,circleCatalogFile} from './map-model.mjs';
import {uid} from './core.mjs';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=v=>protect(escape(v));
const hallLabel=h=>h==='マップ1'?t('マップ {number}').replace('{number}','1'):h;
const button=(action,label,extra='',cls='')=>`<button type="button" data-map-action="${action}" ${extra} class="${cls}">${label}</button>`;
const states=new Map(),importJobs=new Set();let api,resizeObserver,floatObserver;
const state=e=>{if(!states.has(e.id))states.set(e.id,{hall:mapHalls(data(e))[0],selected:null,view:'map',floating:false,floatX:null,floatY:null,listScroll:0,open:true,edit:false,tool:'move',color:'#ff675f',width:5,undo:[],redo:[],query:'',marked:false,zoom:1,panX:0,panY:0,place:null,marker:null,focus:false});return states.get(e.id)};
const data=e=>e.mapData||emptyMap();
const mapEdit=(fn,id=api.getEvent().id)=>api.changeEvent(e=>{e.mapData ||= emptyMap();fn(e.mapData);validateMap(e.mapData)},true,id);
export function mapScreen(e){
 const d=data(e),s=state(e),halls=mapHalls(d),m=d.maps.find(m=>m.hall===s.hall&&m.image),own=d.circles.find(c=>c.own);
 return `<section class="map-screen ${s.view==='circles'?'circle-list-mode':''}" aria-label="会場マップ"><div class="map-header"><div class="map-view-tabs" role="tablist" aria-label="表示を切り替え">${[['map','会場図'],['circles','サークル一覧']].map(([view,label])=>button('view',label,`data-view="${view}" role="tab" aria-selected="${s.view===view}"`,s.view===view?'primary':'')).join('')}</div>${s.view==='map'?button('edit-map','<img src="./icons/edit.svg" alt="">',`aria-label="編集モード" title="編集モード" aria-pressed="${s.edit}" ${m?'':'disabled'}`,'map-round map-edit-button'):''}${button('settings','<img src="./icons/settings.svg" alt="">','aria-label="サークルマップの設定" title="サークルマップの設定" aria-haspopup="dialog"','map-round map-settings-button')}</div><div class="map-list-add">${button('add','サークルを追加')}</div><div class="map-toolbar"><div class="map-halls" role="group" aria-label="ホール">${halls.map(h=>button('hall',esc(hallLabel(h)),`data-hall="${esc(h)}" aria-pressed="${h===s.hall}"`,h===s.hall?'primary':'')).join('')}</div></div>
 ${m&&!s.edit&&!s.marker?`<div class="map-step-strip">${mapSteps(d,s.hall,button)}</div>`:''}
 ${m?.demo?'<p class="map-demo-note">操作確認用マップです。実際の会場配置ではありません。</p>':''}
 <div class="map-workspace">${s.edit&&m?annotationToolbar(s,m.annotations||[]):''}<div class="map-viewport ${s.edit?'editing':''}" tabindex="0" aria-label="会場図。ドラッグで移動、ピンチまたはホイールで拡大。位置指定ボタンからスペースを登録できます。">
 ${m?`<div class="map-plane"><img class="map-image" data-vector-map="${distributionVectorImage(m)?'1':'0'}" src="${distributionVectorImage(m)||m.image}" alt="${esc(hallLabel(s.hall))}の会場図" draggable="false">${annotationLayer(m.annotations||[])}<div class="map-pins">${d.circles.filter(c=>c.id!==s.marker?.id&&c.hall===s.hall&&c.x!=null&&(c.highlight||c.own||c.id===s.selected)).map(c=>button('pin',`<span>${esc([c.space,c.name].filter(Boolean).join(' · '))}</span>`,`data-id="${esc(c.id)}" aria-label="${esc(c.space+' '+c.name)}" style="${markerStyle(c)}"`,'map-pin map-circle-marker'+(c.own?' own':'')+(c.status==='訪問済み'?' visited':'')+(c.id===s.selected?' active':''))).join('')}</div></div>`:`${mapSteps(d,s.hall,button)}`}
 <div class="map-zoom" role="group" aria-label="マップ表示">${button('out','−','aria-label="縮小"')}${button('fit','全体表示')}${button('in','＋','aria-label="拡大"')}</div>
 ${s.marker?`<div class="map-marker-note"><strong>${esc(d.circles.find(c=>c.id===s.marker.id)?.space||'')}</strong><p>丸を動かし、端のつまみで大きさを調整してください。</p><div>${button('marker-save','保存','','primary')}${button('marker-cancel','キャンセル')}</div></div>`:''}
 ${s.place?`<div class="map-place-note" role="status">${esc(d.circles.find(c=>c.id===s.place)?.name||'')}の位置をタップしてください ${button('cancel-place','キャンセル')}</div>`:''}
 </div><aside class="map-panel ${s.view==='circles'?'map-list-full':s.floating?'map-list-floating':'map-list-hidden'} ${s.open||s.view==='circles'?'expanded':'collapsed'}" aria-label="サークル一覧"><div class="map-panel-heading"><span class="map-panel-drag" tabindex="0" aria-label="一覧ウィンドウを移動。矢印キーでも移動できます。">サークル一覧 <small>${d.circles.length}件</small></span><div class="map-panel-controls">${button('toggle',`<img src="./icons/${s.open?'window-minimize':'tasks'}.svg" alt="">`,`aria-label="${s.open?'一覧を折り畳む':'一覧を展開する'}" aria-expanded="${s.open}"`,'map-round')}${button('close-list','<img src="./icons/window-close.svg" alt="">','aria-label="一覧ウィンドウを閉じる"','map-round map-close-list')}</div></div><div class="map-panel-body" ${s.open||s.view==='circles'?'':'hidden'}><label class="map-search-label">サークル名・スペース番号<input type="search" id="map-search" value="${esc(s.query)}" placeholder="G-05、サークル名など"></label><label class="map-filter"><input type="checkbox" id="map-marked" ${s.marked?'checked':''}>チェックしたサークルのみ</label><p class="map-list-count" aria-live="polite"></p><div id="map-circle-list"></div></div></aside></div>${m?.sourceAttribution?`<p class="map-source-note">${esc(citationText(m.sourceAttribution))} <a href="${esc(m.sourceAttribution.url)}" target="_blank" rel="noopener noreferrer">公式サイト</a></p>`:''}<p class="map-hint">位置指定で配置。ドラッグで移動、ピンチで拡大。未配置のサークルは一覧から指定できます。</p></section>`;
}
function list(){const e=api.getEvent();if(!e)return;const d=data(e),s=state(e),target=document.querySelector('#map-circle-list');if(!target)return;
 const q=s.query.trim().toLocaleLowerCase();
 const rows=d.circles.filter(c=>(!s.marked||c.highlight)&&(!q||[c.name,c.kana,c.space,c.penName].join(' ').toLocaleLowerCase().includes(q))).sort((a,b)=>Number(b.own)-Number(a.own)||Number(b.hall===s.hall)-Number(a.hall===s.hall)||a.hall.localeCompare(b.hall)||a.space.localeCompare(b.space,'ja',{numeric:true}));
 document.querySelector('.map-list-count').textContent=t(`${rows.length} / ${d.circles.length}件`);
 target.innerHTML=markup(rows.length?rows.map(c=>`<div class="map-list-row ${c.own?'own':''} ${s.selected===c.id?'active':''}"><label class="map-list-select"><input type="checkbox" data-circle-check="${esc(c.id)}" ${c.highlight?'checked':''} aria-label="${esc(c.name)}をチェック"><span class="map-list-focus"><span class="map-list-space">${esc(hallLabel(c.hall))} ${esc(c.space)}${c.own?' · 自分':''}</span><strong>${esc(c.name)}</strong><small>${esc([t(c.status),c.x==null?t('位置未指定'):'',c.highlight?t('ハイライト'):''].filter(Boolean).join(' · '))}</small></span></label>${button('detail','詳細',`data-id="${esc(c.id)}"`,'map-list-detail')}</div>`).join(''):d.circles.length?'<p class="muted">該当するサークルはありません。追加または一覧の読み込みをお試しください。</p>':`<div class="map-list-onboarding"><p class="map-step-number">STEP 2</p><h2>サークルを登録</h2><p>サークルを追加すると、会場図に位置を登録できます。</p>${button('add','サークルを追加','','primary')}<p class="muted">サークル登録と場所の指定は任意です。書き込みだけでも使えます。</p></div>`);
}
export function mountMap(){
 syncMapEditGuard();
 const viewport=document.querySelector('.map-viewport');if(!viewport)return;resizeObserver?.disconnect();
 const e=api.getEvent(),s=state(e);list();mountFloating(s);const scrollList=document.querySelector('#map-circle-list');scrollList.scrollTop=s.listScroll;scrollList.addEventListener('scroll',()=>s.listScroll=scrollList.scrollTop);
 const circleFile=circleCatalogFile(e.metadata);
 if(circleFile&&!e.mapData?.catalogImported&&!importJobs.has(e.id)){
  importJobs.add(e.id);fetch('./'+circleFile).then(r=>{if(!r.ok)throw Error('サークル一覧を読み込めませんでした。');return r.json()}).then(payload=>mapEdit(d=>{importCircles(d,payload.circles);d.catalogImported=true},e.id)).catch(err=>api.toast(err.message)).finally(()=>importJobs.delete(e.id));
 }
 if((e.metadata.map_catalog||e.metadata.key)&&!importJobs.has('map:'+e.id)){
  importJobs.add('map:'+e.id);distributionMapFile(e.metadata).then(async filename=>{if(!filename||data(e).distributionMapImported===filename)return;const payload=await loadDistributionMaps(filename);await mapEdit(d=>mergeDistributionMaps(d,payload),e.id);const current=api.getEvent();if(current?.id===e.id&&!data(current).maps.some(m=>m.hall===s.hall))s.hall=payload.maps[0].hall;api.render()}).catch(err=>api.toast(err.message)).finally(()=>importJobs.delete('map:'+e.id));
 }
 const plane=viewport.querySelector('.map-plane'),image=viewport.querySelector('.map-image');let baseW=0,baseH=0;
 function position(){if(!plane)return;const ratio=image.naturalWidth/image.naturalHeight||1.4;const vw=viewport.clientWidth,vh=viewport.clientHeight;baseW=Math.min(vw,vh*ratio);baseH=baseW/ratio;
  if(s.focus){const c=data(api.getEvent()).circles.find(c=>c.id===s.selected);if(c?.x!=null){s.zoom=Math.max(s.zoom,1.8);s.panX=(.5-c.x)*baseW*s.zoom;s.panY=(.5-c.y)*baseH*s.zoom}s.focus=false}
  const drawScale=image.dataset.vectorMap==='1'?s.zoom:1;plane.style.width=baseW*drawScale+'px';plane.style.height=baseH*drawScale+'px';plane.style.transform=`translate(-50%,-50%) translate(${s.panX}px,${s.panY}px) scale(${s.zoom/drawScale})`;plane.style.setProperty('--inverse',1/s.zoom);
 }
 if(image){image.onload=position;image.onerror=()=>{if(image.dataset.vectorMap==='1'){image.dataset.vectorMap='0';image.src=data(e).maps.find(m=>m.hall===s.hall)?.image||''}};if(image.complete){if(!image.naturalWidth&&image.dataset.vectorMap==='1')image.onerror();else position()}}
 resizeObserver=new ResizeObserver(position);resizeObserver.observe(viewport);
 viewport._position=position;
 viewport._panBy=(x,y)=>{s.panX+=x;s.panY+=y;position()};
 viewport._zoomAt=(delta,x,y)=>{const r=viewport.getBoundingClientRect(),cx=x-r.left-r.width/2,cy=y-r.top-r.height/2,old=s.zoom;s.zoom=Math.max(1,Math.min(12,s.zoom*delta));const factor=s.zoom/old;s.panX=cx-(cx-s.panX)*factor;s.panY=cy-(cy-s.panY)*factor;position()};
 viewport._zoom=delta=>{const r=viewport.getBoundingClientRect();viewport._zoomAt(delta,r.left+r.width/2,r.top+r.height/2)};
 mountAnnotations(viewport,s,()=>data(api.getEvent()).maps.find(m=>m.hall===s.hall)?.annotations||[],async items=>{const previous=structuredClone(data(api.getEvent()).maps.find(m=>m.hall===s.hall)?.annotations||[]);s.undo.push(previous);if(s.undo.length>30)s.undo.shift();try{await mapEdit(d=>{d.maps.find(m=>m.hall===s.hall).annotations=items},e.id)}catch(err){s.undo.pop();throw err}},api.modal,api.field,api.toast);
 if(s.marker)mountMarkerEditor(plane,s.marker,t);
 let points=new Map(),start=null,pinch=null,longTimer=null;
 function cancelLong(){clearTimeout(longTimer);longTimer=null}
 viewport.addEventListener('wheel',ev=>{if(!plane)return;ev.preventDefault();if(s.edit)return;viewport._zoomAt(ev.deltaY<0?1.15:1/1.15,ev.clientX,ev.clientY)},{passive:false});
 viewport.addEventListener('pointerdown',ev=>{if(!plane||ev.target.closest('button'))return;ev.preventDefault();viewport.setPointerCapture(ev.pointerId);points.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});start={x:ev.clientX,y:ev.clientY,panX:s.panX,panY:s.panY,moved:false};
  if(points.size===2){cancelLong();const [a,b]=[...points.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:s.zoom,x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  else if(!s.place&&!s.edit&&!s.marker)longTimer=setTimeout(()=>{const r=plane.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width,y=(ev.clientY-r.top)/r.height;if(x>=0&&x<=1&&y>=0&&y<=1){start.moved=true;editor(null,{hall:s.hall,x,y})}},650);
 });
 viewport.addEventListener('pointermove',ev=>{if(!points.has(ev.pointerId))return;points.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>7){start.moved=true;cancelLong()}
  if(points.size===2&&pinch){const [a,b]=[...points.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2;viewport._zoomAt(distance/Math.max(1,pinch.distance),x,y);s.panX+=x-pinch.x;s.panY+=y-pinch.y;pinch={distance,x,y}}
  else if(points.size===1){s.panX=start.panX+ev.clientX-start.x;s.panY=start.panY+ev.clientY-start.y}position();
 });
 viewport.addEventListener('pointerup',async ev=>{cancelLong();const count=points.size;points.delete(ev.pointerId);pinch=null;if(points.size){const p=[...points.values()][0];start={...p,panX:s.panX,panY:s.panY,moved:true};return}
  if(s.place&&!start?.moved&&count===1){const r=plane.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width,y=(ev.clientY-r.top)/r.height;if(x>=0&&x<=1&&y>=0&&y<=1){try{const id=s.place;s.place=null;await mapEdit(d=>setPosition(d,id,x,y),e.id);api.toast('位置を登録しました')}catch(err){api.toast(err.message)}}}
 });
 viewport.addEventListener('pointercancel',()=>{cancelLong();points.clear();pinch=null});
 viewport.addEventListener('keydown',ev=>{if(!plane||s.edit)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(ev.key)){ev.preventDefault();if(ev.key==='+')s.zoom=Math.min(12,s.zoom*1.2);if(ev.key==='-')s.zoom=Math.max(1,s.zoom/1.2);if(ev.key==='0'){s.zoom=1;s.panX=s.panY=0}if(ev.key==='ArrowLeft')s.panX+=40;if(ev.key==='ArrowRight')s.panX-=40;if(ev.key==='ArrowUp')s.panY+=40;if(ev.key==='ArrowDown')s.panY-=40;position()}});
}
async function readImage(file,max=4096){
 if(!file?.size||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('PNG・JPEG・WebP画像を選んでください。');if(file.size>20000000)throw Error('画像は20MB以下を選んでください。');
 const url=URL.createObjectURL(file);try{const image=new Image();await new Promise((ok,fail)=>{image.onload=ok;image.onerror=()=>fail(Error('画像を読み込めませんでした。'));image.src=url});const factor=Math.min(1,max/image.width,max/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const result=canvas.toDataURL('image/jpeg',.86);if(result.length>2500000)throw Error('画像が大きすぎます。サイズを小さくしてください。');return result}finally{URL.revokeObjectURL(url)}
}
const wantRow=(w,i)=>`<div class="map-want-row"><input name="want-name-${i}" aria-label="買いたいもの ${i+1}" placeholder="頒布物名" value="${esc(w.name)}" maxlength="200"><input name="want-price-${i}" aria-label="価格 ${i+1}" type="number" min="0" max="999999" value="${w.price||0}"><input name="want-quantity-${i}" aria-label="個数 ${i+1}" type="number" min="1" max="999" value="${w.quantity||1}"><label><input type="checkbox" name="want-done-${i}" ${w.done?'checked':''}>購入済</label></div>`;
function editor(id,initial={}){
 const e=api.getEvent(),s=state(e),c=id?data(e).circles.find(c=>c.id===id):newCircle({hall:s.hall,...initial});if(!c)return;
 const field=api.field;
 api.modal(id?'サークル詳細':'サークルを登録',`<div class="map-detail-grid">${field('サークル名','name',c.name,'text','required maxlength="120"')}${field('スペース番号','space',c.space,'text','maxlength="60"')}${field('ホール','hall',c.hall,'text','required maxlength="80"')}</div><div class="map-detail-flags"><label class="row"><input type="checkbox" name="highlight" ${c.highlight?'checked':''}>ハイライト</label>${field('目印の色','color',c.color,'color')}</div><fieldset class="map-status"><legend>訪問状況</legend>${['未訪問','あとで行く','訪問済み'].map(x=>`<label><input type="radio" name="status" value="${x}" ${c.status===x?'checked':''}>${x}</label>`).join('')}</fieldset>${c.penName||c.genre?`<p class="muted">${esc([c.penName,c.genre].filter(Boolean).join(' · '))}</p>`:''}${c.links.map(x=>`<a class="map-link" href="${esc(x)}" target="_blank" rel="noopener noreferrer">${esc(x)}</a>`).join('')}<label>リンク（1行に1件）<textarea name="links" maxlength="8000">${esc(c.links.join('\n'))}</textarea></label><label>メモ<textarea name="note" maxlength="3000">${esc(c.note)}</textarea></label><h3>おしながき</h3><div class="map-menu-grid">${c.menus.map((src,i)=>`<div>${button('menu',`<img src="${src}" alt="おしながき ${i+1}">`,`data-id="${esc(c.id)}" data-index="${i}"`)}<label><input name="remove-menu-${i}" type="checkbox">この画像を削除</label></div>`).join('')}</div>${field('画像を追加（合計4枚まで）','menus','','file','accept="image/png,image/jpeg,image/webp" multiple')}<h3>買いたいもの</h3><p class="muted">頒布物名・価格・個数・購入済み。頒布物名を空にすると削除します。</p><div id="map-wants">${[...c.wants,{name:'',price:0,quantity:1,done:false}].map(wantRow).join('')}</div>${button('want-add','買いたいものを追加')}<div class="map-detail-actions">${id?button('place','マップで位置を指定',`data-id="${esc(c.id)}"`):''}${id?button('delete','サークルを削除',`data-id="${esc(c.id)}"`,'danger'):''}</div>`,async f=>{
  const name=f.get('name').trim(),hall=f.get('hall').trim();if(!name||!hall)throw Error('サークル名とホールを入力してください。');
  const links=f.get('links').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(links.some(x=>!validLink(x)))throw Error('リンクはhttpまたはhttpsのURLを入力してください。');
  const menus=c.menus.filter((_,i)=>!f.has(`remove-menu-${i}`));const files=f.getAll('menus').filter(f=>f.size);if(menus.length+files.length>4)throw Error('おしながき画像は4枚までです。');for(const file of files)menus.push(await readImage(file,1800));
  const wants=[];for(let i=0;f.has(`want-name-${i}`);i++){const name=f.get(`want-name-${i}`).trim();if(name)wants.push({id:c.wants[i]?.id||uid(),name,price:Number(f.get(`want-price-${i}`)),quantity:Number(f.get(`want-quantity-${i}`)),done:f.has(`want-done-${i}`)})}
  await mapEdit(d=>{let current=d.circles.find(x=>x.id===c.id);if(!current){current=c;d.circles.push(current)}if(current.hall!==hall){current.x=null;current.y=null}Object.assign(current,{name,hall,space:f.get('space').trim(),note:f.get('note'),color:f.get('color'),highlight:f.has('highlight'),status:f.get('status'),links,menus,wants})},e.id);
 });
}
function focusCircle(id){const e=api.getEvent(),c=data(e).circles.find(c=>c.id===id);if(!c)return;const s=state(e);if(s.hall!==c.hall){s.undo=[];s.redo=[]}s.edit=false;s.view='map';s.hall=c.hall;s.selected=id;s.focus=true;s.zoom=1;s.panX=s.panY=0;api.render();if(c.x==null)api.toast('位置未指定です。「詳細」からマップで位置を指定できます。')}
function upload(){openMapImport(api,state(api.getEvent()),readImage)}
function startMarker(c){const s=state(api.getEvent());s.edit=false;s.view='map';s.floating=false;s.open=false;s.place=null;s.hall=c.hall;s.selected=c.id;s.marker={id:c.id,x:c.x??.5,y:c.y??.5,radius:c.radius??.025}}
export function installMap(options){api=options;installMapEditGuard();

 document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-draw-tool]');if(!b)return;ev.preventDefault();const e=api.getEvent(),s=state(e),tool=b.dataset.drawTool;try{if(tool==='done'){s.edit=false;api.render()}else if(tool==='undo'||tool==='redo'){await mapEdit(d=>{const m=d.maps.find(m=>m.hall===s.hall);m.annotations ||= [];if(tool==='undo'&&s.undo.length){s.redo.push(structuredClone(m.annotations));m.annotations=s.undo.pop()}if(tool==='redo'&&s.redo.length){s.undo.push(structuredClone(m.annotations));m.annotations=s.redo.pop()}},e.id)}else{s.tool=tool;api.render()}}catch(err){api.toast(err.message)}});
 document.addEventListener('change',ev=>{const e=api.getEvent();if(!e)return;const s=state(e);if(ev.target.id==='map-draw-color')s.color=ev.target.value;if(ev.target.id==='map-draw-width')s.width=Number(ev.target.value)});
 document.addEventListener('input',ev=>{if(ev.target.id==='map-search'){state(api.getEvent()).query=ev.target.value;list()}});
 document.addEventListener('change',ev=>{if(ev.target.id==='map-marked'){const s=state(api.getEvent());s.marked=ev.target.checked;s.listScroll=0;list()}if(ev.target.matches('[data-circle-check]')){const e=api.getEvent(),id=ev.target.dataset.circleCheck,value=ev.target.checked;mapEdit(d=>{const c=d.circles.find(c=>c.id===id);if(c)c.highlight=value},e.id).catch(err=>api.toast(err.message))}});
 document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-map-action]');if(!b)return;ev.preventDefault();ev.stopPropagation();const e=api.getEvent();if(!e)return;const s=state(e),id=b.dataset.id;if(b.closest('.map-settings-menu'))document.querySelector('#modal').close();try{switch(b.dataset.mapAction){
  case 'settings':{const m=data(e).maps.find(m=>m.hall===s.hall&&m.image),own=data(e).circles.some(c=>c.own);api.modal('サークルマップの設定',`<div class="map-settings-menu"><h3>会場図</h3>${button('upload','会場図を登録')}${m?.sourcePdf?button('pdf-pages','PDFの別ページを追加'):''}${button('edit-map',s.edit?'閲覧に戻る':'会場図に書き込む',m?'':'disabled')}${button('manage-maps','マップを管理')}<h3>サークル一覧</h3>${button('add','サークルを追加')}${button('show-list','サークル一覧を重ねて表示')}</div>`);break}
  case 'view':s.marker=null;s.view=b.dataset.view;s.edit=false;s.place=null;api.render();break;
  case 'show-list':s.floating=true;s.open=true;api.render();break;
  case 'close-list':s.floating=false;api.render();break;
  case 'manage-maps':api.modal('マップを管理',`<div class="map-manage">${mapHalls(data(e)).map(h=>`<div><strong>${esc(hallLabel(h))}</strong>${button('rename-map','名前変更',`data-hall="${esc(h)}"`)}${button('delete-map','削除',`data-hall="${esc(h)}"`,'danger')}</div>`).join('')}</div>${button('add-map','マップを追加')}`);break;
  case 'add-map':api.modal('マップを追加',api.field('マップ名','hall-name','','text','required maxlength="80"'),async f=>{let hall;await mapEdit(d=>{hall=addHall(d,f.get('hall-name'))},e.id);s.hall=hall;s.edit=false;s.undo=[];s.redo=[];s.zoom=1;s.panX=s.panY=0;api.render()});break;
  case 'rename-map':{const old=b.dataset.hall;api.modal('マップ名を変更',api.field('マップ名','hall-name',old,'text','required maxlength="80"'),async f=>{let hall;await mapEdit(d=>{hall=renameHall(d,old,f.get('hall-name'))},e.id);s.hall=hall;api.render()});break}
  case 'delete-map':{const hall=b.dataset.hall;api.modal('マップを削除',`<p>${esc(hall)}の画像・書き込み・配置位置を削除します。サークル情報は残し、別のマップへ移します。最後の1つを削除した場合は空のマップを用意します。</p>${button('delete-map-confirm','削除する',`data-hall="${esc(hall)}"`,'danger')}`);break}
  case 'delete-map-confirm':{let hall;await mapEdit(d=>{hall=deleteHall(d,b.dataset.hall)},e.id);s.hall=hall;s.edit=false;s.undo=[];s.redo=[];s.place=null;s.selected=null;s.zoom=1;s.panX=s.panY=0;document.querySelector('#modal').close();api.render();break}
  case 'edit-map':s.marker=null;s.edit=!s.edit;s.view='map';s.floating=false;s.place=null;s.open=false;s.tool='pen';api.render();break;
  case 'hall':s.marker=null;s.edit=false;s.undo=[];s.redo=[];s.hall=b.dataset.hall;s.zoom=1;s.panX=s.panY=0;s.place=null;api.render();break;
  case 'toggle':s.open=!s.open;api.render();break;
  case 'in':case 'out':document.querySelector('.map-viewport')._zoom(b.dataset.mapAction==='in'?1.25:.8);break;
  case 'fit':s.zoom=1;s.panX=s.panY=0;document.querySelector('.map-viewport')._position();break;
  case 'upload':upload();break;
  case 'open-circle-list':s.view='circles';api.render();break;
  case 'pdf-pages':{const pdf=data(e).documents?.find(p=>p.id===data(e).maps.find(m=>m.hall===s.hall)?.sourcePdf?.id);if(pdf)openMapImport(api,s,readImage,pdf);break}
  case 'add':editor();break;case 'detail':editor(id);break;case 'focus':focusCircle(id);break;case 'pin':focusCircle(id);editor(id);break;
  case 'place':{const c=data(e).circles.find(c=>c.id===id);if(!data(e).maps.some(m=>m.hall===c.hall&&m.image))throw Error('このホールの会場図を先に登録してください。');startMarker(c);document.querySelector('#modal').close();api.render();break}
  case 'marker-save':{const draft=s.marker;if(!draft)break;await mapEdit(d=>{const c=d.circles.find(c=>c.id===draft.id);if(c){c.x=draft.x;c.y=draft.y;c.radius=draft.radius}},e.id);s.marker=null;api.render();break}
  case 'marker-cancel':s.marker=null;api.render();break;
  case 'cancel-place':s.place=null;api.render();break;
  case 'delete':api.modal('サークルを削除',`<p>登録した詳細・画像・位置を削除します。</p>${button('delete-confirm','削除する',`data-id="${esc(id)}"`,'danger')}`);break;
  case 'delete-confirm':await mapEdit(d=>d.circles=d.circles.filter(c=>c.id!==id),e.id);document.querySelector('#modal').close();break;
  case 'want-add':{const target=document.querySelector('#map-wants'),i=target.children.length;if(i>=60)throw Error('買いたいものは60件までです。');target.insertAdjacentHTML('beforeend',markup(wantRow({},i)));break}
  case 'menu':{const c=data(e).circles.find(c=>c.id===id),src=c?.menus[Number(b.dataset.index)];if(src)api.modal('おしながき',`<img class="map-menu-full" src="${src}" alt="${esc(c.name)}のおしながき">`);break}
 }}catch(err){api.toast(err.message);const error=document.querySelector('#modal[open] .error');if(error)error.textContent=t(err.message)}});
}

function mountFloating(s){
 floatObserver?.disconnect();const panel=document.querySelector('.map-list-floating'),workspace=document.querySelector('.map-workspace');if(!panel)return;
 const header=panel.querySelector('.map-panel-drag');let start=null;
 const place=()=>{if(s.floatX==null)return;const w=workspace.clientWidth,h=workspace.clientHeight;s.floatX=Math.max(0,Math.min(s.floatX,w-panel.offsetWidth));s.floatY=Math.max(0,Math.min(s.floatY,h-panel.offsetHeight));panel.style.left=s.floatX+'px';panel.style.top=s.floatY+'px';panel.style.right='auto';panel.style.bottom='auto'};
 place();floatObserver=new ResizeObserver(place);floatObserver.observe(workspace);
 header.addEventListener('pointerdown',ev=>{if(ev.button!==0)return;ev.preventDefault();const r=panel.getBoundingClientRect(),wr=workspace.getBoundingClientRect();start={x:ev.clientX,y:ev.clientY,left:r.left-wr.left,top:r.top-wr.top};header.setPointerCapture(ev.pointerId)});
 header.addEventListener('pointermove',ev=>{if(!start)return;ev.preventDefault();s.floatX=start.left+ev.clientX-start.x;s.floatY=start.top+ev.clientY-start.y;place()});
 header.addEventListener('pointerup',()=>start=null);header.addEventListener('pointercancel',()=>start=null);
 header.addEventListener('keydown',ev=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key))return;ev.preventDefault();const r=panel.getBoundingClientRect(),wr=workspace.getBoundingClientRect();s.floatX=r.left-wr.left+(ev.key==='ArrowRight'?20:ev.key==='ArrowLeft'?-20:0);s.floatY=r.top-wr.top+(ev.key==='ArrowDown'?20:ev.key==='ArrowUp'?-20:0);place()});
}
