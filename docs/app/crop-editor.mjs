const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function cropRect(width,height,crop={}){
 const side=Math.min(width,height)/clamp(crop.zoom||1,1,4);
 return {x:(width-side)*clamp(crop.x??.5,0,1),y:(height-side)*clamp(crop.y??0,0,1),side};
}
const cache=new Map();
function load(data){
 if(!cache.has(data)){
  if(cache.size>20)cache.clear();
  cache.set(data,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='data:image/jpeg;base64,'+data}));
 }
 return cache.get(data);
}
export async function drawThumbnail(canvas,data,crop){
 if(!data)return;
 const image=await load(data);if(!canvas.isConnected)return;
 const rect=cropRect(image.naturalWidth,image.naturalHeight,crop);
 canvas.getContext('2d').drawImage(image,rect.x,rect.y,rect.side,rect.side,0,0,canvas.width,canvas.height);
}
export function createCropEditor(canvas,data,crop={}){
 let value={x:crop.x??.5,y:crop.y??0,zoom:crop.zoom??1},picture=null,token=0;
 const pointers=new Map();
 const draw=()=>{const ctx=canvas.getContext('2d');ctx.fillStyle='#e8eadf';ctx.fillRect(0,0,canvas.width,canvas.height);if(picture){const r=cropRect(picture.naturalWidth,picture.naturalHeight,value);ctx.drawImage(picture,r.x,r.y,r.side,r.side,0,0,canvas.width,canvas.height);ctx.strokeStyle='#ffffff70';ctx.lineWidth=1;for(const f of [1/3,2/3]){ctx.beginPath();ctx.moveTo(f*canvas.width,0);ctx.lineTo(f*canvas.width,canvas.height);ctx.moveTo(0,f*canvas.height);ctx.lineTo(canvas.width,f*canvas.height);ctx.stroke()}}};
 const zoom=factor=>{
  if(!picture)return;const w=picture.naturalWidth,h=picture.naturalHeight,old=cropRect(w,h,value);
  value.zoom=clamp(value.zoom*factor,1,4);const side=cropRect(w,h,value).side;
  value.x=w>side?clamp((old.x+old.side/2-side/2)/(w-side),0,1):.5;
  value.y=h>side?clamp((old.y+old.side/2-side/2)/(h-side),0,1):.5;draw();
 };
 const move=(dx,dy)=>{if(!picture)return;const w=picture.naturalWidth,h=picture.naturalHeight,side=cropRect(w,h,value).side,b=canvas.getBoundingClientRect();if(w>side)value.x=clamp(value.x-dx*side/b.width/(w-side),0,1);if(h>side)value.y=clamp(value.y-dy*side/b.height/(h-side),0,1);draw()};
 canvas.addEventListener('pointerdown',e=>{if(!picture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);canvas.focus();e.preventDefault()});
 canvas.addEventListener('pointermove',e=>{const last=pointers.get(e.pointerId);if(!last)return;const next={x:e.clientX,y:e.clientY};if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)[1];const oldDist=Math.hypot(last.x-other.x,last.y-other.y),newDist=Math.hypot(next.x-other.x,next.y-other.y);if(oldDist>0)zoom(newDist/oldDist)}else move(next.x-last.x,next.y-last.y);pointers.set(e.pointerId,next)});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>pointers.delete(e.pointerId));
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.002))},{passive:false});
 canvas.addEventListener('keydown',e=>{const d={ArrowLeft:[8,0],ArrowRight:[-8,0],ArrowUp:[0,8],ArrowDown:[0,-8]}[e.key];if(d){e.preventDefault();move(...d)}else if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?.9:1.1)}});
 async function setImage(next,settings={}){const current=++token;picture=null;value={x:settings.x??.5,y:settings.y??0,zoom:settings.zoom??1};draw();if(next){const image=await load(next);if(current===token){picture=image;draw()}}}
 setImage(data,crop);
 return {getCrop:()=>({...value}),setImage,zoom,reset:()=>{value={x:.5,y:0,zoom:1};draw()}};
}
