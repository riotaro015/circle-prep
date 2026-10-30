import {emptyState,migrateState,validateState} from './core.mjs';
const demoMode=new URLSearchParams(location.search).has('demo')||/\/preview\/(?:index\.html)?$/.test(location.pathname||'');
let demoState;
async function demo(){return demoState ||= await (await import('./demo.mjs')).makeDemo()}
let database;
export async function openDB(){
 return database ||= new Promise((resolve,reject)=>{
  const r=indexedDB.open(new URLSearchParams(location.search).has('test')?'bestia-circle-prep-test':'bestia-circle-prep',2);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state')};
  r.onblocked=()=>reject(new Error('アプリを開いている他のタブを閉じて、再読み込みしてください。'));
  r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result)};r.onerror=()=>reject(r.error);
 });
}
export async function readState(){
 if(demoMode)return structuredClone(await demo());
 const db=await openDB();return new Promise((resolve,reject)=>{
  const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),r=store.get('main');let state,error;
  r.onsuccess=()=>{try{const original=r.result;state=original?migrateState(original):emptyState();
   if(original&&original.version!==state.version){store.put(original,'before-stable-ids-v2');store.put(state,'main')}
  }catch(e){error=e;tx.abort()}};
  tx.oncomplete=()=>resolve(state);tx.onerror=()=>reject(error||tx.error);tx.onabort=()=>reject(error||tx.error);
 });
}
export async function changeState(callback){
 if(demoMode){const state=structuredClone(await demo());const result=callback(state);demoState=state;return {state:structuredClone(state),result}}
 const db=await openDB();return new Promise((resolve,reject)=>{
  const t=db.transaction('state','readwrite'),store=t.objectStore('state'),r=store.get('main');let state,result,error;
  r.onsuccess=()=>{try{const original=r.result;state=original?migrateState(original):emptyState();result=callback(state);validateState(state);if(original&&original.version!==state.version)store.put(original,'before-stable-ids-v2');store.put(state,'main')}catch(e){error=e;t.abort()}};
  t.oncomplete=()=>resolve({state,result});t.onerror=()=>reject(error||t.error);t.onabort=()=>reject(error||t.error||new Error('保存に失敗しました。'));
 });
}

export async function migrationSnapshot(onlyExists=false){
 if(demoMode)return onlyExists?false:null;
 const db=await openDB();return new Promise((resolve,reject)=>{
  const tx=db.transaction('state','readonly'),store=tx.objectStore('state');
  const request=onlyExists?store.getKey('before-stable-ids-v2'):store.get('before-stable-ids-v2');
  request.onsuccess=()=>resolve(onlyExists?request.result!==undefined:request.result||null);request.onerror=()=>reject(request.error);
 });
}
