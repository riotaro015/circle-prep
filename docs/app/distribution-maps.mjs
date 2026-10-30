import {openPdf,renderPdfPage,pdfData} from './pdf-import.mjs';
import {t,language} from './i18n.mjs';
import {validLink} from './map-model.mjs';
const localFile=(value,ext)=>typeof value==='string'&&new RegExp('^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}\\.'+ext+'$').test(value);
let bundled;
export async function distributionMapFile(metadata){
 if(localFile(metadata.map_catalog,'json'))return metadata.map_catalog;
 if(!metadata.key)return null;
 bundled ||= fetch('./local-events.json').then(r=>{if(!r.ok)throw Error('同梱データを読み込めませんでした。');return r.json()});
 const catalog=await bundled,match=catalog.events?.find(e=>e.key===metadata.key);
 return localFile(match?.map_catalog,'json')?match.map_catalog:null;
}
export function citationText(source){if(!source)return '';const date=new Intl.DateTimeFormat(language(),{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(source.date+'T00:00:00Z'));return t('{date}時点の公式サイトより引用（二次配布）').replace('{date}',date)}
export async function loadDistributionMaps(filename){
 if(!localFile(filename,'json'))throw Error('配布マップの形式が違います。');
 const response=await fetch('./'+filename);if(!response.ok)throw Error('配布マップを読み込めませんでした。');
 const entry=await response.json(),source=entry.attribution;
 if(entry.version!==1||!localFile(entry.pdf,'pdf')||!Array.isArray(entry.maps)||!entry.maps.length||entry.maps.length>6||!source||!/^\d{4}-\d{2}-\d{2}$/.test(source.date)||!Number.isFinite(Date.parse(source.date))||!validLink(source.url)||entry.maps.some(m=>typeof m.hall!=='string'||!m.hall.trim()||m.hall.length>80||!Number.isInteger(m.page)||m.page<1)||new Set(entry.maps.map(m=>m.hall)).size!==entry.maps.length)throw Error('配布マップの形式が違います。');
 const pdf=await fetch('./'+entry.pdf);if(!pdf.ok)throw Error('配布マップを読み込めませんでした。');
 const file=new File([await pdf.arrayBuffer()],entry.name||entry.pdf,{type:'application/pdf'}),doc=await openPdf(file);
 try{
  const original={id:'distribution-'+filename.replace(/\.json$/,''),name:file.name.slice(0,200),pages:doc.numPages,data:await pdfData(file),attribution:source};
  const maps=[];for(const item of entry.maps){if(item.page>doc.numPages)throw Error('配布マップの形式が違います。');maps.push({hall:item.hall,image:await renderPdfPage(doc,item.page),demo:false,sourcePdf:{id:original.id,page:item.page},sourceAttribution:source})}
  return {original,maps,filename};
 }finally{await doc.destroy()}
}
export function mergeDistributionMaps(data,payload){
 if(data.distributionMapImported===payload.filename)return;
 const missing=payload.maps.filter(m=>!data.maps.some(old=>old.hall===m.hall&&old.image));
 const kept=data.maps.filter(m=>!missing.some(n=>n.hall===m.hall));
 if(kept.length+missing.length>6)throw Error('マップは6つまでです。');
 const used=missing.length>0;
 if(used){data.maps=kept;data.documents ||= [];if(!data.documents.some(d=>d.id===payload.original.id))data.documents.push(payload.original);data.maps.push(...missing)}
 for(const c of data.circles){if(c.x==null&&payload.maps.some(m=>m.hall===c.sourceHall)&&!data.maps.some(m=>m.hall===c.hall&&m.image))c.hall=c.sourceHall}
 data.maps=data.maps.filter(m=>m.image||data.circles.some(c=>c.hall===m.hall));
 data.distributionMapImported=payload.filename;
}
