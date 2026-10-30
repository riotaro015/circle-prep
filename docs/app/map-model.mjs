import {validateAnnotations} from './map-annotations.mjs';
import {uid} from './core.mjs';
export const emptyMap=()=>({version:1,maps:[],circles:[]});
export const validLink=s=>{try{return ['https:','http:'].includes(new URL(s).protocol)}catch{return false}};
export function validateMap(data){
 if(!data||data.version!==1||!Array.isArray(data.maps)||data.maps.length>6||!Array.isArray(data.circles)||data.circles.length>1000)throw Error('マップデータの形式が違います。');
 const text=(s,n)=>typeof s==='string'&&s.length<=n;
 const image=s=>text(s,2500000)&&/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
 const halls=new Set();let bytes=0,own=0;const ids=new Set();
 const documents=data.documents||[];if(!Array.isArray(documents)||documents.length>6)throw Error('PDFの保存データが不正です。');const pdfIds=new Set();let pdfBytes=0;const attribution=a=>a&&typeof a.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&Number.isFinite(Date.parse(a.date))&&typeof a.url==='string'&&a.url.length<=1000&&validLink(a.url);
 for(const pdf of documents){if(!pdf||!text(pdf.id,100)||!/^[A-Za-z0-9_-]+$/.test(pdf.id)||pdfIds.has(pdf.id)||!text(pdf.name,200)||!Number.isInteger(pdf.pages)||pdf.pages<1||pdf.pages>200||!text(pdf.data,14000000)||!/^data:application\/pdf;base64,[A-Za-z0-9+/]+={0,2}$/.test(pdf.data))throw Error('PDFの保存データが不正です。');if(pdf.attribution&&!attribution(pdf.attribution))throw Error('引用元の形式が違います。');pdfIds.add(pdf.id);pdfBytes+=pdf.data.length}

 for(const m of data.maps){if(!text(m.hall,80)||!m.hall.trim()||halls.has(m.hall)||(m.image!==null&&!image(m.image))||typeof m.demo!=='boolean')throw Error('会場図の形式が違います。');if(m.annotations!==undefined)validateAnnotations(m.annotations);if(m.sourcePdf){const pdf=documents.find(p=>p.id===m.sourcePdf.id);if(!pdf||!Number.isInteger(m.sourcePdf.page)||m.sourcePdf.page<1||m.sourcePdf.page>pdf.pages)throw Error('PDFの保存データが不正です。')}if(m.sourceAttribution&&!attribution(m.sourceAttribution))throw Error('引用元の形式が違います。');halls.add(m.hall);bytes+=m.image?.length||0}
 for(const c of data.circles){
  if(!text(c.id,100)||!/^[A-Za-z0-9_-]+$/.test(c.id)||ids.has(c.id)||!text(c.name,120)||!c.name.trim()||!text(c.space,60)||!text(c.hall,80)||!c.hall.trim())throw Error('サークル情報が不正です。');ids.add(c.id);
  if(c.x!=null||c.y!=null){if(!Number.isFinite(c.x)||c.x<0||c.x>1||!Number.isFinite(c.y)||c.y<0||c.y>1)throw Error('マップの位置が不正です。')}
  if(!['未訪問','あとで行く','訪問済み'].includes(c.status)||typeof c.own!=='boolean'||typeof c.highlight!=='boolean'||!/^#[0-9a-fA-F]{6}$/.test(c.color)||!text(c.note,3000))throw Error('サークルの設定が不正です。');
  if(c.radius!==undefined&&(!Number.isFinite(c.radius)||c.radius<.006||c.radius>.3))throw Error('丸の大きさが不正です。');
  if(c.own)own++;
  if(!Array.isArray(c.links)||c.links.length>8||c.links.some(s=>!text(s,1000)||!validLink(s)))throw Error('リンクを確認してください。');
  if(!Array.isArray(c.menus)||c.menus.length>4||c.menus.some(s=>!image(s)))throw Error('おしながき画像は4枚までです。');bytes+=c.menus.reduce((n,s)=>n+s.length,0);
  if(!Array.isArray(c.wants)||c.wants.length>60||c.wants.some(w=>!text(w.id,100)||!text(w.name,200)||!Number.isSafeInteger(w.price)||w.price<0||w.price>999999||!Number.isSafeInteger(w.quantity)||w.quantity<1||w.quantity>999||typeof w.done!=='boolean'))throw Error('買いたいものの入力を確認してください。');
 }
 if(own>1)throw Error('自分のスペースはイベントごとに1件です。');
 if(bytes+pdfBytes>30000000)throw Error('PDFと画像の保存量が多すぎます。不要なマップを削除してください。');
 if(bytes>15000000)throw Error('マップとおしながきの画像が多すぎます。不要な画像を削除してください。');
 return data;
}
export function newCircle(info={}){return {id:uid(),name:'',space:'',hall:'大展示',x:null,y:null,status:'未訪問',own:false,highlight:true,color:'#d96a8b',note:'',links:[],menus:[],wants:[],...info}}
export function importCircles(data,rows){
 let count=0;const targetHall=mapHalls(data)[0];
 for(const row of rows){if(data.circles.some(c=>c.id===row.id||c.hall===row.hall&&c.space===row.space&&c.name===row.name))continue;
  data.circles.push(newCircle({...row,hall:mapHalls(data).includes(row.hall)?row.hall:targetHall,sourceHall:row.hall,x:null,y:null,highlight:false}));count++;
 }
 validateMap(data);return count;
}
export function setOwn(data,id,value){for(const c of data.circles)c.own=c.id===id?value:value?false:c.own}
export function setPosition(data,id,x,y){const c=data.circles.find(c=>c.id===id);if(!c)throw Error('サークルが見つかりません。');c.x=x;c.y=y;validateMap(data)}
export const mapHalls=data=>{const halls=[...new Set([...data.maps.map(m=>m.hall),...data.circles.map(c=>c.hall)])];return halls.length?halls:['マップ1']};

export function addHall(data,name){name=String(name).trim();if(!name||name.length>80)throw Error('マップ名は1〜80文字で入力してください。');if(mapHalls(data).includes(name)&&data.maps.length)throw Error('同じ名前のマップがあります。');if(data.maps.length>=6)throw Error('マップは6つまでです。');if(data.maps.some(m=>m.hall===name))throw Error('同じ名前のマップがあります。');if(!data.maps.length&&!data.circles.length&&name!=='マップ1')data.maps.push({hall:'マップ1',image:null,demo:false,annotations:[]});data.maps.push({hall:name,image:null,demo:false,annotations:[]});validateMap(data);return name}
export function renameHall(data,old,name){name=String(name).trim();if(!name||name.length>80)throw Error('マップ名は1〜80文字で入力してください。');if(name!==old&&mapHalls(data).includes(name))throw Error('同じ名前のマップがあります。');for(const m of data.maps)if(m.hall===old)m.hall=name;for(const c of data.circles)if(c.hall===old)c.hall=name;if(!data.maps.some(m=>m.hall===name))data.maps.push({hall:name,image:null,demo:false,annotations:[]});validateMap(data);return name}
export function deleteHall(data,hall){const rest=mapHalls(data).filter(h=>h!==hall),target=rest[0]||'マップ1';data.maps=data.maps.filter(m=>m.hall!==hall);if(data.documents)data.documents=data.documents.filter(p=>data.maps.some(m=>m.sourcePdf?.id===p.id));for(const c of data.circles)if(c.hall===hall){c.hall=target;c.x=null;c.y=null}if(!rest.length&&!data.maps.length)data.maps.push({hall:target,image:null,demo:false,annotations:[]});validateMap(data);return target}


// Distribution metadata may reference only a bundled JSON file in this app.
export const circleCatalogFile=metadata=>typeof metadata?.circle_catalog==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}\.json$/.test(metadata.circle_catalog)?metadata.circle_catalog:null;
