import {t} from './i18n.mjs';
const flag='circle-prep-offline-disabled';
const supported=()=>/^https?:$/.test(location.protocol)&&'serviceWorker'in navigator&&'caches'in window;
const scope=new URL('./',import.meta.url).href;
let status='未保存',working=false,initialized=false,startup=Promise.resolve();
const disabled=()=>localStorage.getItem(flag)==='1';
function show(value){status=value;refresh()}
function refresh(){
 for(const node of document.querySelectorAll('[data-offline-status]'))node.textContent=t(status);
 for(const node of document.querySelectorAll('[data-offline-action]'))node.disabled=working;
}
export function offlineCard(){
 if(!supported())return '';
 return `<section class="offline-controls"><h3>${t('オフライン')}</h3><p class="muted">${t('アプリと同梱の会場図をこのブラウザーに保存し、通信なしで開けます。外部リンクと更新には通信が必要です。')}</p><p data-offline-status role="status" aria-live="polite">${t(status)}</p><div class="toolbar"><button type="button" data-offline-action="save" ${working?'disabled':''}>${t('オフラインに保存')}</button><button type="button" data-offline-action="delete" ${working?'disabled':''}>${t('保存を削除')}</button></div><p class="muted">${t('保存を削除しても、イベント・荷物・メモ・レジの記録は残ります。')}</p></section>`;
}
function settled(worker){
 if(!worker||['installed','activated','redundant'].includes(worker.state))return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{worker.removeEventListener('statechange',check);reject(Error('timeout'))},120000);
  function check(){if(['installed','activated','redundant'].includes(worker.state)){clearTimeout(timer);worker.removeEventListener('statechange',check);resolve()}}
  worker.addEventListener('statechange',check);check();
 });
}
async function workerFor(registration){
 let worker=registration.installing||registration.waiting||registration.active;
 await settled(worker);
 if(worker?.state==='redundant')worker=registration.waiting||registration.active;
 if(!worker||worker.state==='redundant')throw Error('worker');
 return worker;
}
async function message(worker,type){
 return new Promise((resolve,reject)=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('timeout'))},120000);
  channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data.error?reject(Error('cache')):resolve(event.data)};
  worker.postMessage({type},[channel.port2]);
 });
}
async function save(){
 localStorage.removeItem(flag);
 show('オフライン用データを保存しています…');
 const registration=await navigator.serviceWorker.register('./sw.js');
 await registration.update().catch(()=>{});
 const result=await message(await workerFor(registration),'OFFLINE_SAVE');
 if(!result.saved)throw Error('incomplete');
 await navigator.storage?.persist?.().catch(()=>false);
 show('オフラインで使えます');
}
async function remove(){
 // Opt out before waiting for an in-progress install, so reload cannot start it again.
 localStorage.setItem(flag,'1');show('保存を削除しています…');
 const registrations=(await navigator.serviceWorker.getRegistrations()).filter(r=>r.scope===scope);
 for(const registration of registrations){await settled(registration.installing);await registration.unregister()}
 for(const key of await caches.keys())if(key.startsWith('circle-prep-app-'))await caches.delete(key);
 show('未保存');
}
export async function initializeOffline(){
 if(initialized||!supported())return;initialized=true;
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-offline-action]');if(!button||working)return;
  if(button.dataset.offlineAction==='delete'&&!confirm(t('オフライン用データを削除しますか？記録は残ります。次に開くときは通信が必要です。')))return;
  working=true;refresh();
  try{await startup;await (button.dataset.offlineAction==='save'?save():remove())}
  catch{show(button.dataset.offlineAction==='save'?'保存できませんでした。通信と空き容量を確認して再試行してください。':'削除できませんでした。もう一度お試しください。')}
  finally{working=false;refresh()}
 });
 startup=(async()=>{try{
  if(disabled()){show('未保存');return}
  const registration=await navigator.serviceWorker.getRegistration(scope);
  if(!registration){show('未保存');return}
  // Keep existing installations updated; fresh visitors explicitly choose Save.
  await registration.update().catch(()=>{});
  const result=await message(await workerFor(registration),'OFFLINE_STATUS');
  show(result.saved?'オフラインで使えます':'未保存');
 }catch{show('未保存')}})();
 await startup;
}
