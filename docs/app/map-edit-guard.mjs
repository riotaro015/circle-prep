// Keep editing input on the canvas and its drawing controls, including keyboard focus.
const locked=new Set();
const editing=()=>document.querySelector('.map-viewport.editing');
export function syncMapEditGuard(){
 for(const node of locked)node.inert=false;
 locked.clear();
 const viewport=editing();if(!viewport)return;
 const workspace=viewport.closest('.map-workspace');
 for(let branch=workspace;branch?.parentElement&&branch!==document.body;branch=branch.parentElement){
  for(const sibling of branch.parentElement.children){
   if(sibling!==branch&&!sibling.inert){sibling.inert=true;locked.add(sibling)}
  }
 }
 const selection=window.getSelection();selection?.removeAllRanges();
 if(!workspace.contains(document.activeElement))workspace.querySelector('[data-draw-tool][aria-pressed=true], [data-draw-tool=done]')?.focus({preventScroll:true});
}
export function installMapEditGuard(){
 const block=event=>{
  const viewport=editing();if(!viewport)return;
  const target=event.target;
  const toolbar=target.closest?.('.map-edit-toolbar');
  const canvas=viewport.contains(target)&&!target.closest?.('button,a,input,select');
  const browserAction=['selectstart','dragstart','contextmenu'].includes(event.type);
  if(browserAction||(!toolbar&&!canvas)||(canvas&&['keydown','keyup'].includes(event.type)&&event.key!=='Tab')){
   if(event.cancelable)event.preventDefault();
   event.stopImmediatePropagation();
  }
 };
 for(const type of ['pointerdown','click','dblclick','keydown','keyup','wheel','selectstart','dragstart','contextmenu']){
  document.addEventListener(type,block,{capture:true,passive:false});
 }
}
