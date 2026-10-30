// Long press owns the gesture only after the hold; ordinary swipes keep scrolling.
export function installBagDrag(api){
 let pending=null,drag=null,suppressUntil=0,raf=0;
 const clear=()=>{if(pending)clearTimeout(pending.timer);pending=null};
 const block=e=>{if(drag||Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}};
 document.addEventListener('click',block,true);
 document.addEventListener('contextmenu',e=>{if(e.target.closest('[data-bag-item]'))e.preventDefault()});
 function begin(row,x,y){
  if(drag||!row.isConnected)return;
  const list=row.parentElement,rect=row.getBoundingClientRect();
  const ghost=row.cloneNode(true);ghost.classList.add('bag-drag-ghost');ghost.removeAttribute('data-bag-item');ghost.style.width=rect.width+'px';ghost.setAttribute('aria-hidden','true');
  const bin=document.createElement('div');bin.className='bag-drag-trash';bin.innerHTML=api.trash;bin.setAttribute('role','status');bin.setAttribute('aria-label',api.tr('持ち物を削除'));
  document.body.append(ghost,bin);row.classList.add('bag-drag-origin');document.body.classList.add('bag-dragging');
  drag={row,list,ghost,bin,id:row.dataset.bagItem,bid:list.dataset.bagId,eid:api.getEvent().id,dx:x-rect.left,dy:y-rect.top,x,y,over:false,scroller:row.closest('.content')};
  clear();navigator.vibrate?.(25);move(x,y);raf=requestAnimationFrame(scroll);
 }
 function move(x,y){
  if(!drag)return;const d=drag;d.x=x;d.y=y;d.ghost.style.left=(x-d.dx)+'px';d.ghost.style.top=(y-d.dy)+'px';
  const r=d.bin.getBoundingClientRect();d.over=x>=r.left-16&&x<=r.right+16&&y>=r.top-16&&y<=r.bottom+16;d.bin.classList.toggle('over',d.over);
  if(!d.over){const rows=[...d.list.querySelectorAll('[data-bag-item]')].filter(r=>r!==d.row);const before=rows.find(r=>{const b=r.getBoundingClientRect();return y<b.top+b.height/2});d.list.insertBefore(d.row,before||null)}
 }
 function scroll(){if(!drag)return;const d=drag,b=d.scroller?.getBoundingClientRect();if(b&&!d.over){const speed=d.y<b.top+60?-9:d.y>b.bottom-60?9:0;if(speed){d.scroller.scrollTop+=speed;move(d.x,d.y)}}raf=requestAnimationFrame(scroll)}
 async function finish(cancel=false){
  clear();if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(raf);suppressUntil=Date.now()+500;
  const order=[...d.list.querySelectorAll('[data-bag-item]')].map(r=>r.dataset.bagItem);
  d.ghost.remove();d.bin.remove();d.row.classList.remove('bag-drag-origin');document.body.classList.remove('bag-dragging');
  const top=d.scroller?.scrollTop||0;
  try{if(!cancel)await api.changeEvent(e=>{const b=e.bags.find(b=>b.id===d.bid);if(!b)return;if(d.over)b.items=b.items.filter(i=>i.id!==d.id);else{const rank=new Map(order.map((id,i)=>[id,i]));b.items.sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity))}},false,d.eid)}catch(e){api.toast(e.message)}
  api.render();const scroller=document.querySelector('.content');if(scroller)scroller.scrollTop=top;
 }
 function down(target,x,y,mouse=false){clear();const row=target.closest('[data-bag-item]');if(!row||target.closest('button,input,a')||drag)return;pending={row,x,y,mouse,timer:setTimeout(()=>begin(row,x,y),450)}}
 function motion(x,y,e){if(drag){if(e.cancelable)e.preventDefault();move(x,y)}else if(pending&&Math.hypot(x-pending.x,y-pending.y)>9){if(pending.mouse){const p=pending;begin(p.row,p.x,p.y);if(e.cancelable)e.preventDefault();move(x,y)}else clear()}}
 document.addEventListener('touchstart',e=>{if(e.touches.length!==1){finish(true);return}const t=e.touches[0];down(e.target,t.clientX,t.clientY)},{passive:true});
 document.addEventListener('touchmove',e=>{if(e.touches.length!==1){finish(true);return}const t=e.touches[0];motion(t.clientX,t.clientY,e)},{passive:false});
 document.addEventListener('touchend',e=>{if(drag&&e.cancelable)e.preventDefault();finish()},{passive:false});
 document.addEventListener('touchcancel',()=>finish(true));
 document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0)down(e.target,e.clientX,e.clientY,true)});
 document.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')motion(e.clientX,e.clientY,e)});
 document.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse')finish(true)});
 document.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')finish()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')finish(true)});
 addEventListener('blur',()=>finish(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true)});
}
