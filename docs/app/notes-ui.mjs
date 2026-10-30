import {saveNote,removeNote} from './notes-model.mjs';
import {protect,t,language} from './i18n.mjs';
import {localIcons} from './local-icons.mjs';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const user=v=>protect(escape(v));
const button=(action,label,id='',cls='',title='')=>`<button type="button" data-note-action="${action}" data-id="${user(id)}" class="${cls}" ${title?`aria-label="${escape(t(title))}" title="${escape(t(title))}"`:''}>${label}</button>`;
let api;
export function notesScreen(event){const notes=event.notes||[];return `<section class="notes-screen"><header class="notes-heading"><h2>メモ <span>${notes.length}</span></h2>${button('add',localIcons.plus+'<span>メモを追加</span>','','primary note-add')}</header>${notes.length?`<div class="notes-board">${notes.map(n=>`<article class="note-card">${button('edit',`<span class="note-title">${n.title?user(n.title):t('無題のメモ')}</span>${n.body?`<span class="note-body">${user(n.body)}</span>`:''}`,n.id,'note-open')}<footer><time datetime="${user(n.updated_at)}">${user(new Intl.DateTimeFormat(language(),{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(n.updated_at)))}</time><div>${button('edit',localIcons.edit,n.id,'note-tool','メモを編集')}${button('delete',localIcons.trash,n.id,'note-tool note-delete','メモを削除')}</div></footer></article>`).join('')}</div>`:'<div class="notes-empty">メモはまだありません。</div>'}</section>`}
function edit(id){const event=api.getEvent(),n=id?(event.notes||[]).find(n=>n.id===id):null;if(id&&!n)return;
 api.modal(id?'メモを編集':'メモを追加',`<div class="note-editor">${api.field(t('タイトル（任意）'),'note-title',n?.title||'','text','maxlength="120"')}<label>${t('本文')}<textarea name="note-body" maxlength="20000" rows="8">${user(n?.body||'')}</textarea></label></div>`,async f=>api.changeEvent(e=>saveNote(e,{title:f.get('note-title'),body:f.get('note-body')},id),true,event.id));
 requestAnimationFrame(()=>document.querySelector('#modal [name=note-body]')?.focus({preventScroll:true}));
}
export function installNotes(options){api=options;document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-note-action]');if(!b)return;ev.preventDefault();ev.stopPropagation();const event=api.getEvent(),id=b.dataset.id;if(!event)return;try{switch(b.dataset.noteAction){
 case 'add':edit();break;case 'edit':edit(id);break;
 case 'delete':{const n=(event.notes||[]).find(n=>n.id===id);if(n)api.modal('メモを削除',`<p><strong>${n.title?user(n.title):t('無題のメモ')}</strong></p><p>このメモを削除しますか？</p><div class="note-confirm-actions">${button('cancel',t('キャンセル'))}${button('delete-confirm',t('削除'),id,'red')}</div>`);break}
 case 'cancel':document.querySelector('#modal').close();break;
 case 'delete-confirm':await api.changeEvent(e=>removeNote(e,id),true,event.id);document.querySelector('#modal').close();break;
 }}catch(err){api.toast(err.message)}})}
