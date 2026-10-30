const languages=[['日本語','ja'],['English','en'],['한국어','ko'],['简体中文','zh-Hans'],['繁體中文','zh-Hant']];
let catalog={},locale='ja',templates=[];
export {languages};
export async function initializeLanguage(code='ja'){const r=await fetch(new URL('./catalog.json',import.meta.url));if(!r.ok)throw Error('Language catalog unavailable');catalog=await r.json();setLanguage(code)}
export function setLanguage(code){locale=languages.some(([,v])=>v===code)?code:'ja';document.documentElement.lang=locale;document.documentElement.dataset.language=locale;templates=Object.entries(catalog[locale]||{}).filter(([key])=>/\{\w+\}/.test(key)).sort(([a],[b])=>b.replace(/\{\w+\}/g,'').length-a.replace(/\{\w+\}/g,'').length).map(([key,value])=>{const names=[];const parts=key.split(/(\{\w+\})/g).map(part=>{const match=part.match(/^\{(\w+)\}$/);if(match){names.push(match[1]);return '(.+?)'}return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')});return {pattern:new RegExp('^'+parts.join('')+'$'),names,value}})}
export function language(){return locale}
export function t(text){
 const exact=catalog[locale]?.[text];if(exact!==undefined)return exact;
 for(const {pattern,names,value} of templates){const match=String(text).match(pattern);if(match)return value.replace(/\{(\w+)\}/g,(token,name)=>match[names.indexOf(name)+1]??token)}
 return text;
}
// Escaped user values are protected until all source UI text is translated.
export function protect(text){return '\uE000'+Array.from(text).map(c=>c.codePointAt(0).toString(16)).join('.')+'\uE001'}
const restore=text=>text.replace(/\uE000([0-9a-f.]*)\uE001/g,(_,s)=>s?s.split('.').map(v=>String.fromCodePoint(parseInt(v,16))).join(''):'');
export function markup(value){
 const fragment=document.createElement('template');fragment.innerHTML=value;
 const walk=document.createTreeWalker(fragment.content,NodeFilter.SHOW_TEXT);
 let node;while(node=walk.nextNode()){const text=node.nodeValue,clean=text.trim();if(clean)node.nodeValue=text.replace(clean,t(clean))}
 for(const el of fragment.content.querySelectorAll('*'))for(const attr of ['aria-label','title','placeholder','alt'])if(el.hasAttribute(attr)){const value=el.getAttribute(attr);el.setAttribute(attr,t(value))}
 return restore(fragment.innerHTML);
}
const installed=new WeakSet();
export function localizedElement(element){
 if(!element||installed.has(element))return element;installed.add(element);
 const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
 Object.defineProperty(element,'innerHTML',{get(){return html.get.call(this)},set(value){html.set.call(this,markup(value))}});
 const text=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
 Object.defineProperty(element,'textContent',{get(){return text.get.call(this)},set(value){text.set.call(this,restore(t(value)))}});
 return element;
}
