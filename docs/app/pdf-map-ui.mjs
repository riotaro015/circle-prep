import {openPdf,renderPdfPage,pdfData,isPdf,storedPdfFile} from './pdf-import.mjs';
import {markup,protect,t} from './i18n.mjs';
import {uid} from './core.mjs';
const user=v=>protect(String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
export function openMapImport(api,s,readImage,stored=null){
 const event=api.getEvent(),hall=s.hall,current=event.mapData?.maps.find(m=>m.hall===hall&&m.image);
 let doc=null,file=null,loading=false,failed=false,generation=0,preview=0,alive=true;
 api.modal('会場図を登録',`<p>画像またはPDFを選んでください。PDFはページを選んで登録できます。</p>${stored?'':api.field('画像・PDF','map-image','','file','accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" required')}<div id="pdf-import-panel"></div>${current&&!stored?'<p class="alert">会場図を変更すると、このホールの配置位置と書き込みを解除します。サークル詳細は残ります。</p>':''}<p class="muted">PDFの原本も端末内に保存します。ファイルは外部へ送信しません。</p>`,async f=>{
  if(loading)throw Error('PDFの読み込みが終わるまでお待ちください。');
  const selected=stored?file:f.get('map-image');if(!selected?.size)throw Error('画像またはPDFを選んでください。');
  if(!isPdf(selected)){
   const image=await readImage(selected);await api.changeEvent(e=>{e.mapData ||= {version:1,maps:[],circles:[]};replaceMap(e.mapData,hall,{hall,image,demo:false})},true,event.id);
  }else{
   if(!doc||failed)throw Error('PDFを読み込めませんでした。ファイルを確認してください。');
   const pages=[...dialog.querySelectorAll('[data-pdf-page]:checked')].map(x=>Number(x.value));
   if(!pages.length)throw Error('登録するページを選んでください。');
   const existing=event.mapData?.maps.filter(m=>stored||m.hall!==hall).length||0;
   if(pages.length+existing>6)throw Error('マップは6つまでです。');
   const original=stored||{id:uid(),name:selected.name.slice(0,200),pages:doc.numPages,data:await pdfData(selected)};
   const maps=[];for(const page of pages){status.textContent=t('PDFを処理しています…');maps.push({page,image:await renderPdfPage(doc,page)})}
   if(!alive)throw Error('登録を中止しました。');
   await api.changeEvent(e=>{
    const d=e.mapData ||= {version:1,maps:[],circles:[]};d.documents ||= [];
    if(!d.documents.some(x=>x.id===original.id))d.documents.push(original);
    for(const [i,map] of maps.entries()){
     let name=hall;if(i||stored){const base=selected.name.replace(/\.pdf$/i,'').slice(0,55)+' · P'+map.page;name=base;let n=2;while(d.maps.some(m=>m.hall===name)||d.circles.some(c=>c.hall===name))name=base+' ('+(n++)+')'}
     replaceMap(d,name,{hall:name,image:map.image,demo:false,sourcePdf:{id:original.id,page:map.page},...(original.attribution?{sourceAttribution:original.attribution}:{})});
    }
    d.documents=d.documents.filter(pdf=>d.maps.some(m=>m.sourcePdf?.id===pdf.id));
   },true,event.id);
  }
  s.undo=[];s.redo=[];s.zoom=1;s.panX=s.panY=0;s.edit=false;api.render();
 });
 const dialog=document.querySelector('#modal'),panel=dialog.querySelector('#pdf-import-panel'),status=document.createElement('p');status.className='pdf-import-status';status.setAttribute('role','status');panel.after(status);
 dialog.addEventListener('close',()=>{alive=false;generation++;doc?.destroy()},{once:true});
 async function showPage(number){const token=++preview;try{const image=await renderPdfPage(doc,number,700);if(alive&&token===preview){panel.querySelector('.pdf-preview-image').src=image;panel.querySelector('#pdf-preview-page').value=number}}catch(err){if(alive)status.textContent=t(err.message)}}
 async function load(selected){
  const token=++generation;failed=false;file=selected;loading=false;panel.innerHTML='';status.textContent='';if(!selected||!isPdf(selected))return;
  loading=true;status.textContent=t('PDFを読み込んでいます…');try{
   const loaded=await openPdf(selected);if(!alive||token!==generation){loaded.destroy();return}doc?.destroy();doc=loaded;
   panel.innerHTML=markup(`${current&&!stored?'<p class="alert">最初のページは現在のマップを置き換えます。配置位置と書き込みは解除されます。追加ページは別マップになります。</p>':''}<p><strong>${user(selected.name)}</strong> · ${doc.numPages}ページ</p><p>登録するページにチェックを入れてください。最大6マップまで登録できます。</p><div class="pdf-page-options">${Array.from({length:doc.numPages},(_,i)=>`<label><input type="checkbox" data-pdf-page value="${i+1}" ${i===0?'checked':''}>${t('ページ {number}').replace('{number}',i+1)}</label>`).join('')}</div><label>プレビューするページ<input id="pdf-preview-page" type="number" min="1" max="${doc.numPages}" value="1"></label><img class="pdf-preview-image" alt="${t('PDFページのプレビュー')}">`);
   status.textContent=t('ページを選んで保存してください。');await showPage(1);
  }catch(err){failed=true;if(alive)status.textContent=t(err.message)}finally{if(token===generation)loading=false}
 }
 panel.addEventListener('change',ev=>{if(ev.target.id==='pdf-preview-page'){const n=Number(ev.target.value);if(Number.isInteger(n)&&n>=1&&n<=doc.numPages)showPage(n)}if(ev.target.matches('[data-pdf-page]')&&ev.target.checked)showPage(Number(ev.target.value))});
 dialog.querySelector('[name=map-image]')?.addEventListener('change',ev=>load(ev.target.files[0]));
 if(stored)load(storedPdfFile(stored));
}
function replaceMap(d,hall,map){d.maps=d.maps.filter(m=>m.hall!==hall);d.maps.push(map);for(const c of d.circles.filter(c=>c.hall===hall)){c.x=null;c.y=null}if(d.documents)d.documents=d.documents.filter(pdf=>pdf.id===map.sourcePdf?.id||d.maps.some(m=>m.sourcePdf?.id===pdf.id))}
