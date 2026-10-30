(function(global){
 'use strict';const KEY='yarou-menus-shopping-v1';
 function create(circles,storage){const index=new Map();for(const c of circles)for(const item of [...c.items,...(c.legacy_items||[])])if(!index.has(item.item_id))index.set(item.item_id,{item,circle:c.id,name:c.name,space:c.space,hall:c.hall});
 const state={};let persistent=!!storage;
 try{const saved=JSON.parse(storage?.getItem(KEY)||'{}');for(const [id,row] of Object.entries(saved||{}))if(index.has(id)&&row&&Number.isInteger(row.quantity)&&row.quantity>0&&row.quantity<=999)state[id]={quantity:row.quantity,bought:row.bought===true};}catch{persistent=false}
 function save(){try{storage?.setItem(KEY,JSON.stringify(state))}catch{persistent=false}}
 function setQuantity(id,quantity){if(!index.has(id)||!Number.isInteger(quantity)||quantity<0||quantity>999)return false;if(!quantity)delete state[id];else state[id]={quantity,bought:quantity<=(state[id]?.quantity||0)&&(state[id]?.bought||false)};save();return true}
 function setBought(id,bought){if(!state[id])return;state[id].bought=!!bought;save()}
 function entries(){return Object.entries(state).map(([id,row])=>{const base=index.get(id),known=Number.isSafeInteger(base.item.price_yen)&&base.item.price_yen>=0;return {id,...base,...row,known,subtotal:known?base.item.price_yen*row.quantity:null}})}
 function summary(){return entries().reduce((a,row)=>{a.quantity+=row.quantity;if(row.known){a.total+=row.subtotal;if(row.bought)a.bought+=row.subtotal}else a.unknown+=row.quantity;return a},{quantity:0,total:0,bought:0,unknown:0})}
 return {index,setQuantity,setBought,entries,summary,quantity:id=>state[id]?.quantity||0,isBought:id=>state[id]?.bought||false,isPersistent:()=>persistent};
 }global.MenuShopping={create};
})(window);
