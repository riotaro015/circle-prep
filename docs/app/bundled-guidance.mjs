// Update official guidance without replacing personal records or event settings.
const key='yaroufes-2026-autumn';
export function applyBundledGuidance(state,entries){
 const source=entries.find(m=>m.key===key);if(!source)return false;
 let changed=false;
 for(const event of state.events){
  const m=event.metadata;
  if((m.key||m.distribution?.key)!==key||m.guidance_revision===source.revision)continue;
  const previous=new Set(m.bundled_guide_titles||[]);
  const titles=new Set(source.guide.map(section=>section.title));
  const personal=(m.guide||[]).filter(section=>!previous.has(section.title)&&!titles.has(section.title)&&!(section.title==='参加案内'&&section.items.length===1&&section.items[0]==='入場時刻・搬入案内は主催者の最新案内をご確認ください。'));
  m.guide=[...structuredClone(source.guide),...personal];
  m.guide_sources=structuredClone(source.guide_sources||[]);
  m.bundled_guide_titles=[...titles];m.guidance_revision=source.revision;
  m.translations ||= {};
  for(const [locale,values] of Object.entries(source.translations||{}))m.translations[locale]={...(m.translations[locale]||{}),...values};
  if(!m.schedule?.length)m.schedule=structuredClone(source.schedule);
  changed=true;
 }
 // Refresh the picker too, retaining its acquisition date and the other events.
 if(state.preferences.catalogCache){
  const cached=state.preferences.catalogCache.events;
  const index=cached.findIndex(m=>m.key===key);
  if(index>=0&&cached[index].revision!==source.revision){cached[index]=structuredClone(source);changed=true}
 }
 return changed;
}
