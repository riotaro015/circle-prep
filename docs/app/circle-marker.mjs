export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function markerStyle(c){return `left:${c.x*100}%;top:${c.y*100}%;width:${(c.radius??.025)*200}%;--pin-color:${c.own?'#d74755':c.color}`}
export function mountMarkerEditor(plane,draft,t){
 if(!plane||!draft)return;
 const node=document.createElement('div');node.className='map-marker-editor';node.setAttribute('role','group');node.setAttribute('aria-label',t('丸の位置と大きさを調整'));
 const handle=document.createElement('button');handle.type='button';handle.className='map-marker-resize';handle.setAttribute('aria-label',t('丸の大きさを変更'));node.append(handle);plane.append(node);
 const paint=()=>{node.style.cssText=markerStyle({...draft,own:true})};paint();let gesture=null;
 node.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(gesture)return;const r=plane.getBoundingClientRect();gesture={id:e.pointerId,resize:e.target===handle,x:e.clientX,y:e.clientY,ox:draft.x,oy:draft.y,radius:draft.radius,r};node.setPointerCapture(e.pointerId)});
 node.addEventListener('pointermove',e=>{e.stopPropagation();if(!gesture||gesture.id!==e.pointerId)return;e.preventDefault();const g=gesture;if(g.resize){const cx=g.r.left+draft.x*g.r.width,cy=g.r.top+draft.y*g.r.height;draft.radius=clamp(Math.hypot(e.clientX-cx,e.clientY-cy)/g.r.width,.006,.3)}else{draft.x=clamp(g.ox+(e.clientX-g.x)/g.r.width,0,1);draft.y=clamp(g.oy+(e.clientY-g.y)/g.r.height,0,1)}paint()});
 node.addEventListener('pointerup',e=>{e.stopPropagation();if(gesture?.id===e.pointerId)gesture=null});
 node.addEventListener('pointercancel',e=>{e.stopPropagation();if(gesture?.id===e.pointerId){draft.x=gesture.ox;draft.y=gesture.oy;draft.radius=gesture.radius??draft.radius;gesture=null;paint()}});
 node.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});
 node.tabIndex=0;node.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();e.stopPropagation();if(e.key==='+')draft.radius=clamp(draft.radius*1.15,.006,.3);else if(e.key==='-')draft.radius=clamp(draft.radius/1.15,.006,.3);else{draft.x=clamp(draft.x+(e.key==='ArrowRight'?.005:e.key==='ArrowLeft'?-.005:0),0,1);draft.y=clamp(draft.y+(e.key==='ArrowDown'?.005:e.key==='ArrowUp'?-.005:0),0,1)}paint()});
}
