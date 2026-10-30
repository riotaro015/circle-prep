import {releaseCodes} from './release-categories.mjs';
import {validateNotes} from './notes-model.mjs';
import {validateMap,validLink} from './map-model.mjs';
import {validRecordIcon} from './record-icons.mjs';
// Record identifiers, not authentication tokens. HTTP LAN previews may lack randomUUID.
let idSequence=0;
export function uid(){
 const provider=globalThis.crypto;
 if(typeof provider?.randomUUID==='function')return provider.randomUUID().replaceAll('-','');
 if(typeof provider?.getRandomValues==='function'){
  const bytes=new Uint8Array(16);provider.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 }
 // Older browsers: timestamp + per-session sequence + random suffix.
 return Date.now().toString(16).padStart(12,'0')+(++idSequence).toString(16).padStart(6,'0')+Array.from({length:14},()=>Math.floor(Math.random()*16).toString(16)).join('');
}
export const stamp=()=>new Date().toISOString();
export const emptyRegister=()=>({version:2,products:[],sales:[],adjustments:[],updated_at:stamp()});
export const emptyState=()=>({version:2,events:[],active:null,preferences:{size:16,start:'home'}});
const fail=message=>{throw new Error(message)};
export const int=(v,min=0)=>Number.isSafeInteger(v)&&v>=min;
export function validateRegister(d){
 if(!d||d.version!==2)fail('レジの形式が正しくありません。');
 for(const key of ['products','sales','adjustments']){
  if(!Array.isArray(d[key])||d[key].length>100000)fail('レジの記録が正しくありません。');
  const ids=new Set();for(const r of d[key]){if(!r||typeof r.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(r.id)||ids.has(r.id))fail('記録IDが不正です。');ids.add(r.id)}
 }
 const balances=new Map(d.products.map(p=>[p.id,0]));
 for(const p of d.products){
  if(typeof p.name!=='string'||!p.name.trim()||!int(p.price)||!int(p.stock)||typeof p.active!=='boolean'||typeof p.image!=='string'||p.image.length>8000000)fail('頒布物情報が不正です。');
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(p.image)||p.image.length%4)fail('頒布物画像が不正です。');
  if(!releaseCodes.includes(p.release_mark||''))fail('頒布物マークが不正です。');
  if(p.thumbnail&&(!Number.isFinite(p.thumbnail.x)||p.thumbnail.x<0||p.thumbnail.x>1||!Number.isFinite(p.thumbnail.y)||p.thumbnail.y<0||p.thumbnail.y>1||!Number.isFinite(p.thumbnail.zoom)||p.thumbnail.zoom<1||p.thumbnail.zoom>4))fail('画像の切り抜きが不正です。');
 }
 for(const a of d.adjustments){
  if(!balances.has(a.product_id)||!Number.isSafeInteger(a.delta)||!int(a.stock_after)||typeof a.reason!=='string'||!a.reason.trim()||typeof a.at!=='string')fail('在庫調整が不正です。');
  balances.set(a.product_id,balances.get(a.product_id)+a.delta);
 }
 for(const s of d.sales){
  if(!['cash','gift'].includes(s.kind)||typeof s.cancelled!=='boolean'||!Array.isArray(s.lines)||!s.lines.length)fail('会計記録が不正です。');
  let total=0;for(const l of s.lines){
   if(!balances.has(l.product_id)||!int(l.quantity,1)||!int(l.price)||typeof l.name!=='string')fail('会計明細が不正です。');
   if(l.release_mark!==undefined&&!releaseCodes.includes(l.release_mark))fail('頒布物マークが不正です。');total+=l.price*l.quantity;if(!s.cancelled)balances.set(l.product_id,balances.get(l.product_id)-l.quantity);
  }
  if(s.kind==='gift')total=0;
  if(!int(total)||!int(s.total)||s.total!==total||!int(s.paid)||s.paid<total||!int(s.change)||s.change!==s.paid-total||['at','cancelled_at','recipient'].some(k=>typeof s[k]!=='string'))fail('会計金額が不正です。');
  if(s.kind==='gift'&&(!s.recipient.trim()||s.paid!==0))fail('取り置きの相手が未入力です。');
 }
 if(d.products.some(p=>balances.get(p.id)!==p.stock))fail('在庫と頒布履歴が一致しません。');
 return d;
}
export function checkout(d,cart,paid,kind='cash',recipient='',requestId=uid()){
 if(d.sales.some(s=>s.id===requestId))return d.sales.find(s=>s.id===requestId);
 if(!['cash','gift'].includes(kind)||!int(paid)||kind==='cash'&&paid>=100000)fail('お預かりは100,000円未満で入力してください。');
 if(kind==='gift'&&!recipient.trim())fail('渡した相手を入力してください。');
 const lines=Object.entries(cart).filter(([,q])=>q>0).map(([id,q])=>{
  const p=d.products.find(p=>p.id===id);
  if(!p||!p.active||!int(q,1)||q>p.stock)fail('在庫が不足しています。頒布物を選び直してください。');
  return {product_id:id,name:p.name,price:p.price,quantity:q,release_mark:p.release_mark||''};
 });
 if(!lines.length)fail('頒布物を選んでください。');
 const total=kind==='cash'?lines.reduce((n,l)=>n+l.price*l.quantity,0):0;
 if(!int(total)||kind==='cash'&&paid<total)fail('お預かりが不足しています。');
 for(const l of lines)d.products.find(p=>p.id===l.product_id).stock-=l.quantity;
 const received=kind==='gift'?0:paid;
 const sale={id:requestId,kind,lines,total,paid:received,change:received-total,recipient:kind==='gift'?recipient.trim():'',at:stamp(),cancelled:false,cancelled_at:''};
 d.sales.push(sale);d.updated_at=stamp();return sale;
}
export function cancelSale(d,id){
 const s=d.sales.find(s=>s.id===id);if(!s||s.cancelled)fail('この会計は取消済みです。');
 for(const l of s.lines)d.products.find(p=>p.id===l.product_id).stock+=l.quantity;
 s.cancelled=true;s.cancelled_at=stamp();d.updated_at=stamp();
}
export function saveProduct(d,info,id=null){
 if(!info.name.trim()||!int(info.price)||!int(info.stock))fail('頒布物名・価格・在庫を確認してください。');
 let p=d.products.find(p=>p.id===id);const old=p?.stock||0;
 if(!p){p={id:uid()};d.products.push(p)}
 Object.assign(p,info);
 if(!id||old!==p.stock)d.adjustments.push({id:uid(),product_id:p.id,delta:p.stock-old,stock_after:p.stock,reason:id?'在庫編集':'初期在庫',at:stamp()});
 validateRegister(d);return p.id;
}
// 会計に出てくる頒布物を消すと売上の記録と在庫の辻褄が合わなくなる。その場合は消さずに非表示にしてもらう。
export function removeProduct(d,id){
 const p=d.products.find(p=>p.id===id);if(!p)fail('頒布物が見つかりません。');
 if(d.sales.some(s=>s.lines.some(l=>l.product_id===id)))fail('会計の記録がある頒布物は削除できません。「頒布一覧に表示」を外してください。');
 d.products=d.products.filter(x=>x.id!==id);
 d.adjustments=d.adjustments.filter(a=>a.product_id!==id);
 d.updated_at=stamp();validateRegister(d);return d;
}
// 電卓の1キー分。お預かりは6桁まで受ける（100,000円以上はError!表示にして確定させないため）。
export function keypad(paid,key,total=0){
 if(key==='C')return 0;
 if(key==='back')return Math.floor(paid/10);
 if(key==='exact')return total;
 if(/^\+\d{1,6}$/.test(key)){const next=paid+Number(key.slice(1));return next<1000000?next:paid}
 if(!/^\d{1,2}$/.test(key))return paid;
 const next=Number(String(paid)+key);
 return next<1000000?next:paid;
}
// 開催日の翌日以降か。日付は YYYY-MM-DD 同士なので文字列比較でよい。
export const eventOver=(date,today)=>Boolean(date)&&today>date;
export function registerTransfer(d){return {format:'kemoket-register-transfer',transfer_version:2,currency:'JPY',exported_at:stamp(),data:structuredClone(d)}}
export function parseTransfer(payload){if(payload?.format!=='kemoket-register-transfer'||![1,2].includes(payload.transfer_version)||payload.currency!=='JPY'||typeof payload.exported_at!=='string')fail('対応するレジファイルではありません。');return validateRegister(migrateRegister(payload.data))}
export function metadata(source){
 if(!source||typeof source.name!=='string'||!source.name.trim()||source.name.length>40)fail('イベント名は1〜40文字で入力してください。');
 const day=source.date||null,time=source.entry_time||null;
 if(day&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day))fail('開催日が正しくありません。');
 if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail('入場時刻が正しくありません。');
 if(source.map_catalog!==undefined&&(typeof source.map_catalog!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}\.json$/.test(source.map_catalog)))fail('配布マップの形式が違います。');
 if(source.map_attribution!==undefined){const a=source.map_attribution;if(!a||typeof a.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!Number.isFinite(Date.parse(a.date))||typeof a.url!=='string'||a.url.length>1000||!validLink(a.url))fail('引用元の形式が違います。')}
 const translations=source.translations??{};
 if(!translations||typeof translations!=='object'||Array.isArray(translations)||Object.keys(translations).length>5)fail('翻訳データの形式が正しくありません。');
 for(const [code,entries] of Object.entries(translations)){
  if(!['ja','en','ko','zh-Hans','zh-Hant'].includes(code)||!entries||typeof entries!=='object'||Array.isArray(entries)||Object.keys(entries).length>500)fail('翻訳データの形式が正しくありません。');
  for(const [key,value] of Object.entries(entries))if(!key.trim()||key.length>3000||typeof value!=='string'||!value.trim()||value.length>3000)fail('翻訳データの形式が正しくありません。');
 }
 return {...source,name:source.name.trim(),date:day,entry_time:time,translations};
}
export function parseCatalog(payload){
 if(payload?.format!=='circle-event-catalog'||payload.version!==1||!Array.isArray(payload.events)||!payload.events.length||payload.events.length>100)fail('配布データの形式が違います。');
 const keys=new Set();return payload.events.map(source=>{
  const m=metadata(source);
  for(const k of ['key','revision'])if(typeof m[k]!=='string'||!m[k]||m[k].length>100)fail('配布IDが不正です。');
  if(keys.has(m.key))fail('配布IDが重複しています。');keys.add(m.key);
  if(typeof (m.venue||'')!=='string'||(m.venue||'').length>200)fail('会場が不正です。');
  if(!Array.isArray(m.guide)||m.guide.length>40||!Array.isArray(m.schedule)||m.schedule.length>100)fail('案内が不正です。');
  for(const s of m.guide)if(typeof s.title!=='string'||s.title.length>100||!Array.isArray(s.items)||s.items.length>100||s.items.some(x=>typeof x!=='string'||x.length>3000))fail('注意事項が不正です。');
  for(const s of m.schedule){metadata({name:'予定',entry_time:s.start});if(!s.start)fail('開始時刻が必要です。');metadata({name:'予定',entry_time:s.end});if(s.end&&s.end<=s.start)fail('終了時刻が不正です。');if(typeof s.title!=='string'||s.title.length>120||typeof s.note!=='string'||s.note.length>500)fail('予定の文章が不正です。')}
  return m;
 });
}
export function addEvent(state,m){const e={id:uid(),metadata:metadata(m),bags:[],tasks:[],notes:[],register:emptyRegister()};applyParticipationTemplate(e,m.participation_style);state.events.push(e);state.active=e.id;return e}
export function validateState(s){
 if(s?.version!==2||!Array.isArray(s.events)||s.events.length>100||!s.preferences||![14,16,18].includes(s.preferences.size))fail('バックアップの形式が違います。');
 if(!['home','bags','tasks','register','map','notes','settings'].includes(s.preferences.start))fail('開始画面が不正です。');
 if(s.preferences.catalogCache){const c=s.preferences.catalogCache;if(!c||typeof c.fetchedAt!=='string'||!Number.isFinite(Date.parse(c.fetchedAt))||typeof c.source!=='string'||c.source.length>100)fail('配布データの取得記録が不正です。');parseCatalog({format:'circle-event-catalog',version:1,events:c.events})}const ids=new Set();for(const e of s.events){
  if(typeof e.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(e.id)||ids.has(e.id))fail('イベントIDが不正です。');ids.add(e.id);metadata(e.metadata);if(e.notes!==undefined)validateNotes(e.notes);if(e.mapData)validateMap(e.mapData);if(e.metadata.guide||e.metadata.schedule)parseCatalog({format:'circle-event-catalog',version:1,events:[{...e.metadata,key:e.metadata.key||'custom',revision:e.metadata.revision||'1',guide:e.metadata.guide||[],schedule:e.metadata.schedule||[]}]});validateRegister(e.register);
  if(!Array.isArray(e.bags)||e.bags.length>5||!Array.isArray(e.tasks)||e.tasks.length>10000)fail('荷物・タスクの形式が違います。');
  for(const b of e.bags){if(typeof b.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(b.id)||typeof b.name!=='string'||!Array.isArray(b.items)||b.items.length>10000)fail('バッグの形式が違います。');for(const i of b.items)if(typeof i.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(i.id)||typeof i.name!=='string'||typeof i.done!=='boolean')fail('持ち物の形式が違います。')}
  for(const t of e.tasks)if(typeof t.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(t.id)||typeof t.name!=='string'||typeof t.done!=='boolean')fail('タスクの形式が違います。');
  for(const row of [...e.tasks,...e.bags.flatMap(b=>b.items)])if(!validRecordIcon(row))fail('アイコンの設定が正しくありません。');
 }
 if(s.events.length&&!ids.has(s.active))fail('選択中のイベントが不正です。');return s;
}

export const markCode=value=>({'新':'new','新刊':'new','準新':'recent','準新刊':'recent','既':'backlist','既刊':'backlist','グッズ':'goods','無配':'free','その他':'other'}[value]??value);
export const markLabel=value=>({'new':'新','recent':'準新刊','backlist':'既','goods':'グッズ','free':'無配','other':'その他'}[value]??value);
export function migrateRegister(original){
 if(!original||![1,2].includes(original.version))fail('レジの形式が正しくありません。');
 const data=structuredClone(original);if(data.version===2)return data;
 const maps={};
 for(const kind of ['products','sales','adjustments']){
  if(!Array.isArray(data[kind]))fail('レジの記録が正しくありません。');
  const seen=new Set();maps[kind]=new Map();
  for(const row of data[kind]){
   if(!row||typeof row.id!=='string'||!row.id||seen.has(row.id))fail('記録IDが不正です。');seen.add(row.id);
   maps[kind].set(row.id,/^[A-Za-z0-9_-]{1,100}$/.test(row.id)?row.id:uid());
  }
  if(new Set(maps[kind].values()).size!==seen.size)fail('記録IDが不正です。');
  for(const row of data[kind])row.id=maps[kind].get(row.id);
 }
 for(const p of data.products)if('release_mark'in p)p.release_mark=markCode(p.release_mark);
 for(const a of data.adjustments)a.product_id=maps.products.get(a.product_id)??a.product_id;
 for(const sale of data.sales)for(const line of sale.lines)line.product_id=maps.products.get(line.product_id)??line.product_id;
 data.version=2;return data;
}
export function migrateState(original){
 if(!original||![1,2].includes(original.version))fail('バックアップの形式が違います。');
 const state=structuredClone(original);if(state.version===2)return validateState(state);
 if(!Array.isArray(state.events))fail('バックアップの形式が違います。');
 for(const e of state.events)e.register=migrateRegister(e.register);
 state.version=2;return validateState(state);
}


export function removeEvent(state,id){
 if(!state.events.some(e=>e.id===id))throw Error('イベントが見つかりません。');
 state.events=state.events.filter(e=>e.id!==id);
 if(state.active===id)state.active=state.events[0]?.id??null;
 return state;
}

export function applyParticipationTemplate(e,style){
 if(!['travel','local','empty',undefined].includes(style))throw Error('参加スタイルを選んでください。');
 if(!style||style==='empty')return e;
 const item=name=>({id:uid(),name,done:false,morning:['スマホ','財布','充電器'].includes(name)});
 const bag=(name,names,shipping=false)=>({id:uid(),name,shipping,destination:'',tracking:'',items:names.map(item)});
 const personal=['スマホ','財布','モバイルバッテリー','充電器','飲み物','参加案内・入場証'];
 const supplies=['新刊','既刊','グッズ','見本誌','敷き布','お品書き','値札','ポスター','ポスタースタンド','陳列用品','釣り銭','頒布用の袋','ペン','テープ','はさみ','クリップ'];
 e.bags=[bag('当日バッグ',personal)];
 if(style==='travel')e.bags.push(bag('スーツケース',['交通券・予約の控え','宿泊予約の控え','着替え','洗面用品','常備薬']),bag('会場発送',supplies,true));
 else e.bags.push(bag('頒布物・設営用品',supplies));
 const names=['参加案内を確認する','頒布物の数量を確認する','釣り銭を準備する','荷造りする','当日朝の最終確認'];
 if(style==='travel')names.push('交通・宿泊の予約を確認する','宅配搬入を使うか確認する（使う場合は発送期限を確認）');
 e.tasks=names.map(name=>({id:uid(),name,done:false,date:null,time:null,icon:'',icon_color:'#007aff'}));
 return e;
}
