import {t} from './i18n.mjs';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
export function timeField(label,name,value=''){
 const valid=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value||'');
 const [hour,minute]=(valid?value:'09:00').split(':').map(Number);
 const column=(part,count,selected,title)=>`<div class="time-wheel-column"><span class="muted">${esc(t(title))}</span><div class="time-wheel" role="listbox" tabindex="0" aria-label="${esc(t(title))}" data-part="${part}" data-value="${selected}">${Array.from({length:count},(_,n)=>`<button type="button" role="option" aria-selected="${n===selected}" tabindex="-1" data-value="${n}">${pad(n)}</button>`).join('')}</div></div>`;
 return `<div class="time-field"><div class="row spread"><span>${esc(t(label.replace('（未定なら空欄）','')||'時刻'))}</span><output class="time-wheel-value">${valid?value:esc(t('未定'))}</output></div><input type="hidden" name="${esc(name)}" value="${valid?value:''}"><div class="time-wheels">${column('hour',24,hour,'時')}<span class="time-colon">:</span>${column('minute',60,minute,'分')}</div><label class="row time-unknown"><input type="checkbox" ${valid?'':'checked'}>${esc(t('未定'))}</label></div>`;
}

export function initTimeWheels(root=document){
 for(const field of root.querySelectorAll('.time-field')){
  if(field.dataset.ready)continue;
  field.dataset.ready='true';
  const wheels=[...field.querySelectorAll('.time-wheel')],input=field.querySelector('input[type=hidden]'),unknown=field.querySelector('input[type=checkbox]'),output=field.querySelector('output');
  function commit(){
   input.value=unknown.checked?'':wheels.map(w=>pad(Number(w.dataset.value))).join(':');
   output.textContent=input.value||t('未定');
  }
  function select(wheel,index){
   index=Math.max(0,Math.min(wheel.children.length-1,index));
   wheel.dataset.value=index;
   for(const option of wheel.children)option.setAttribute('aria-selected',String(Number(option.dataset.value)===index));
   if(wheel.dataset.engaged==='true'){unknown.checked=false;commit()}
  }
  for(const wheel of wheels){
   const step=44;
   wheel.scrollTop=Number(wheel.dataset.value)*step;
   const engage=()=>{wheel.dataset.engaged='true'};
   wheel.addEventListener('pointerdown',engage);
   wheel.addEventListener('wheel',engage,{passive:true});
   wheel.addEventListener('scroll',()=>select(wheel,Math.round(wheel.scrollTop/step)),{passive:true});
   wheel.addEventListener('click',e=>{
    const option=e.target.closest('[role=option]');if(!option)return;
    engage();select(wheel,Number(option.dataset.value));wheel.scrollTop=Number(wheel.dataset.value)*step;
   });
   wheel.addEventListener('keydown',e=>{
    const delta={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5}[e.key];
    if(delta===undefined&&!['Home','End'].includes(e.key))return;
    e.preventDefault();engage();
    const next=e.key==='Home'?0:e.key==='End'?wheel.children.length-1:Number(wheel.dataset.value)+delta;
    select(wheel,next);wheel.scrollTop=Number(wheel.dataset.value)*step;
   });
  }
  unknown.addEventListener('change',()=>{
   // Reset interaction flags so a pending initialization/scroll cannot undo "undecided".
   for(const wheel of wheels)wheel.dataset.engaged='false';
   commit();
  });
 }
}
