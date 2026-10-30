// Mozilla PDF.js is bundled locally; files never leave the device.
let library;
export const isPdf=file=>file?.type==='application/pdf'||/\.pdf$/i.test(file?.name||'');
export async function openPdf(file){
 if(!file?.size||file.size>10*1024*1024)throw Error('PDFは10MB以下を選んでください。');
 if(!Promise.withResolvers)Promise.withResolvers=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
 if(!library)library=(async()=>{globalThis.pdfjsWorker=await import('./vendor/pdfjs/legacy/build/pdf.worker.mjs');return import('./vendor/pdfjs/legacy/build/pdf.mjs')})();
 const pdfjs=await library;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,isEvalSupported:false,disableFontFace:true});
 try{const doc=await task.promise;if(doc.numPages>200){await doc.destroy();throw Error('PDFは200ページ以下を選んでください。')}return doc}
 catch(err){await task.destroy();if(err.name==='PasswordException')throw Error('パスワード付きPDFは解除してから登録してください。');if(err.message==='PDFは200ページ以下を選んでください。')throw err;throw Error('PDFを読み込めませんでした。ファイルを確認してください。')}
}
export async function renderPdfPage(doc,number,max=4096){
 const page=await doc.getPage(number),natural=page.getViewport({scale:1});
 const scale=Math.min(max/Math.max(natural.width,natural.height),6),viewport=page.getViewport({scale});
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
 try{await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
  for(const quality of [.9,.78,.62]){const image=canvas.toDataURL('image/jpeg',quality);if(image.length<=2500000)return image}
  throw Error('PDFのページ画像が大きすぎます。PDFのサイズを小さくしてください。');
 }finally{canvas.width=canvas.height=1;page.cleanup()}
}
export const pdfData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve('data:application/pdf;base64,'+String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('PDFを読み込めませんでした。ファイルを確認してください。'));reader.readAsDataURL(file)});
export function storedPdfFile(document){const raw=atob(document.data.split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return new File([bytes],document.name,{type:'application/pdf'})}
