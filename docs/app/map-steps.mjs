import {t} from './i18n.mjs';
export function mapProgress(data,hall){
 const image=!!data.maps.find(m=>m.hall===hall&&m.image),circles=data.circles.filter(c=>c.hall===hall),placed=circles.filter(c=>c.x!=null).length,own=circles.find(c=>c.own);
 return {image,circles:circles.length,placed,own,step:!image?1:!circles.length?2:own?.x!=null?0:3};
}
export function mapSteps(data,hall,button){const p=mapProgress(data,hall);
 const row=(n,title,done)=>`<span class="map-step-summary ${done?'done':''}"><b>STEP ${n}</b> ${t(title)}${done?' · '+t('登録済み'):''}</span>`;
 if(!p.image)return `<div class="map-onboarding"><p class="map-step-number">STEP 1</p><h2>会場図を登録</h2><p>画像またはPDFを選んでください。PDFはページを選んで登録できます。</p>${button('upload','画像・PDFを選ぶ','','primary')}<div class="map-step-next">${row(2,'サークルを登録',p.circles>0)}${row(3,'自分のサークル番号を入力',p.own?.x!=null)}</div><p class="muted">サークル登録と場所の指定は任意です。書き込みだけでも使えます。</p></div>`;
 if(!p.step)return '';
 return `<form class="map-own-form"><h3><b>STEP 3</b> 自分のサークル番号</h3><div class="map-own-input-row"><input name="own-space" aria-label="スペース番号" required maxlength="60" placeholder="G-05" autocomplete="off"><button type="submit" class="primary">丸を置く</button></div><p class="error" role="alert"></p></form>`;
}
