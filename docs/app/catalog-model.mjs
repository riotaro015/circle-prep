export const japanDate=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function groupCatalog(events,acquiredAt){
 const day=japanDate(new Date(acquiredAt));
 const groups={upcoming:[],past:[],undated:[]};
 events.forEach((event,index)=>{const row={event,index};groups[!event.date?'undated':event.date<day?'past':'upcoming'].push(row)});
 groups.upcoming.sort((a,b)=>a.event.date.localeCompare(b.event.date));groups.past.sort((a,b)=>b.event.date.localeCompare(a.event.date));
 return groups;
}
