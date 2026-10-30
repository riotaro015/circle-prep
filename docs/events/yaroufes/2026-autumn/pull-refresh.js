'use strict';
window.MenuPullRefresh={install({canStart,refresh}){
 const indicator=document.createElement('div');indicator.className='pull-refresh';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');document.body.append(indicator);
 let start=null,distance=0,loading=false,timer;
 const reset=()=>{start=null;distance=0;if(!loading)indicator.classList.remove('visible','ready')};
 const eligible=target=>canStart()&&scrollY<=2&&!document.querySelector('dialog[open]')&&!target.closest('input,textarea,select,button,a,[contenteditable=true]');
 document.addEventListener('touchstart',event=>{
  if(loading||event.touches.length!==1||!eligible(event.target)){reset();return}
  clearTimeout(timer);const touch=event.touches[0];start={x:touch.clientX,y:touch.clientY};distance=0;
 },{passive:true});
 document.addEventListener('touchmove',event=>{
  if(!start)return;
  if(event.touches.length!==1||!eligible(event.target)){reset();return}
  const touch=event.touches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;
  if(dy<0||Math.abs(dx)>Math.max(24,dy*.65)){reset();return}
  if(dy>0&&event.cancelable)event.preventDefault();
  distance=dy;if(dy<12){indicator.classList.remove('visible','ready');return}
  distance=dy;indicator.classList.add('visible');indicator.classList.toggle('ready',distance>=180);
  indicator.textContent=distance>=180?'離して更新':'下に引いて更新';
  indicator.style.setProperty('--pull',Math.min(54,dy*.25)+'px');
 },{passive:false});
 document.addEventListener('touchend',async()=>{
  if(!start)return;
  const ready=distance>=180&&canStart()&&scrollY<=2&&!document.querySelector('dialog[open]');start=null;distance=0;
  if(!ready){reset();return}
  loading=true;indicator.textContent='更新しています…';indicator.classList.add('visible','loading');indicator.classList.remove('ready');
  try{await refresh();indicator.textContent='更新しました'}
  catch{indicator.textContent='更新できませんでした。通信を確認してください。'}
  finally{loading=false;indicator.classList.remove('loading');timer=setTimeout(reset,3000)}
 },{passive:true});
 document.addEventListener('touchcancel',reset,{passive:true});
 addEventListener('pagehide',()=>{clearTimeout(timer);reset()});
}};
