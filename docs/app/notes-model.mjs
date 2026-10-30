import {uid,stamp} from './core.mjs';
export function validateNotes(notes){
 if(!Array.isArray(notes)||notes.length>1000)throw Error('メモの形式が正しくありません。');
 const ids=new Set();
 for(const n of notes){if(!n||typeof n.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(n.id)||ids.has(n.id)||typeof n.title!=='string'||n.title.length>120||typeof n.body!=='string'||n.body.length>20000||!n.title.trim()&&!n.body.trim()||typeof n.created_at!=='string'||!Number.isFinite(Date.parse(n.created_at))||typeof n.updated_at!=='string'||!Number.isFinite(Date.parse(n.updated_at)))throw Error('メモの内容が正しくありません。');ids.add(n.id)}
 return notes;
}
export function saveNote(event,info,id=null){
 const title=String(info.title??'').trim(),body=String(info.body??'').trim();
 if(!title&&!body)throw Error('タイトルか本文を入力してください。');
 event.notes ||= [];let n=id?event.notes.find(n=>n.id===id):null;
 if(id&&!n)throw Error('メモが見つかりません。');
 if(!n){n={id:uid(),created_at:stamp()};event.notes.unshift(n)}
 Object.assign(n,{title,body,updated_at:stamp()});validateNotes(event.notes);return n.id;
}
export function removeNote(event,id){event.notes=(event.notes||[]).filter(n=>n.id!==id)}
