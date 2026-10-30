import {releaseKinds,releaseNames} from './release-categories.mjs';
export const categories=[...releaseKinds,'unclassified'];
export const categoryNames=releaseNames;
export const categoryFor=value=>categories.includes(value)?value:'unclassified';
export function jstParts(value){const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;const local=new Date(date.getTime()+9*3600000);return {day:local.toISOString().slice(0,10),minute:local.getUTCHours()*60+local.getUTCMinutes()}}
export const clock=minute=>String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
export function analyzeRegister(register,{interval=15,day='all'}={}){
 if(![5,15,30,60].includes(interval))throw Error('集計間隔が不正です。');
 const products=new Map(register.products.map(p=>[p.id,p])),cash=register.sales.filter(s=>!s.cancelled&&s.kind==='cash'),days=[...new Set(cash.map(s=>jstParts(s.at)?.day).filter(Boolean))].sort();
 const sales=day==='all'?cash:cash.filter(s=>jstParts(s.at)?.day===day),groups=new Map(),sets=new Map(),bins=new Map();let total=0,quantity=0,missingTime=0,fallback=0;
 for(const sale of sales){total+=sale.total;const kinds=new Set(),items=new Map();let bin=null;const when=jstParts(sale.at);if(when){const index=Math.floor(when.minute/interval)*interval;if(!bins.has(index))bins.set(index,{start:index,end:index+interval,count:0,quantity:0,total:0,categories:Object.fromEntries(categories.map(k=>[k,0]))});bin=bins.get(index);bin.count++;bin.total+=sale.total}else missingTime++;
 for(const line of sale.lines){const code=categoryFor(line.release_mark===undefined?products.get(line.product_id)?.release_mark:line.release_mark);if(line.release_mark===undefined)fallback++;kinds.add(code);items.set(line.product_id,line.name);quantity+=line.quantity;if(bin){bin.quantity+=line.quantity;bin.categories[code]+=line.quantity}}
 const key=categories.filter(k=>kinds.has(k)).join('+');if(!groups.has(key))groups.set(key,{kinds:categories.filter(k=>kinds.has(k)),count:0,total:0});const row=groups.get(key);row.count++;row.total+=sale.total;
 if(items.size>=2){const key=JSON.stringify([...items.keys()].sort());if(!sets.has(key))sets.set(key,{names:[...items].sort(([a],[b])=>a.localeCompare(b)).map(([,name])=>name),count:0,total:0});const row=sets.get(key);row.count++;row.total+=sale.total}
 }
 const rows=[...groups.values()].sort((a,b)=>b.total-a.total||b.count-a.count).map(r=>({...r,share:sales.length?r.count/sales.length:0,revenueShare:total?r.total/total:0}));
 const timeline=[];if(bins.size){const first=Math.min(...bins.keys()),last=Math.max(...bins.keys());for(let m=first;m<=last;m+=interval)timeline.push(bins.get(m)||{start:m,end:m+interval,count:0,quantity:0,total:0,categories:Object.fromEntries(categories.map(k=>[k,0]))})}
 const peak=timeline.reduce((best,bin)=>!best||bin.count>best.count?bin:best,null);
 return {days,day,interval,total,count:sales.length,quantity,average:sales.length?total/sales.length:0,patterns:rows,sets:[...sets.values()].sort((a,b)=>b.total-a.total||b.count-a.count),timeline,peak,missingTime,fallback,cancelled:register.sales.filter(s=>s.cancelled).length,gifts:register.sales.filter(s=>!s.cancelled&&s.kind==='gift').length};
}
