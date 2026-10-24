import {esc} from './creator-ui.js?v=4';
import {animationText as t} from './animations-client.js?v=2';
export function renderRuleForm(rule,clips,selectedClip){
 const option=(id,label,value)=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`;
 return `<form data-an-dialog-form="rule" data-id="${esc(rule?.id||'')}">
 <p>${t('Poți reda manual orice animație din Favorite, fără fan asociat. Aici alegi dacă pornește și automat la cadouri.','Play any animation manually from Favorites, without assigning a fan. Here you can also enable automatic gift triggers.')}</p>
 <label>${t('Când pornește','When to play')}<select name="type">${[
 ['manual',t('Doar manual, din Favorite','Manual only, from Favorites')],
 ['gift',t('Un anumit cadou','A specific gift')],
 ['threshold',t('Cadou / combo de minimum X monede','Gift / combo worth at least X coins')],
 ['user',t('Orice cadou de la un anumit utilizator','Any gift from a specific user')]
 ].map(([id,label])=>option(id,label,rule?.type||'manual')).join('')}</select></label>
 <label>${t('ID sau numele exact al cadoului','Gift ID or exact gift name')}<input name="gift" maxlength="100" value="${esc(rule?.gift||'')}" placeholder="5655 / Rose"></label>
 <label><span data-rule-user-label></span><input name="username" maxlength="25" value="${esc(rule?.username||'')}" placeholder="${t('Gol = orice utilizator','Empty = any user')}"></label>
 <label><span data-rule-threshold-label></span><input name="threshold" type="number" min="1" max="1000000" value="${rule?.threshold||1}"></label>
 <label>${t('Videoclip','Video')}<select name="clip">${clips.filter(c=>c.mime==='video/mp4').map(c=>option(c.id,c.title,rule?.clip||selectedClip||clips.find(c=>c.mime==='video/mp4')?.id)).join('')}</select></label>
 <button type="submit" class="an-button an-primary">${t('Salvează','Save')}</button></form>`;
}
export function bindRuleForm(form){
 const sync=()=>{
  const type=form.elements.type.value;
  for(const[name,visible]of [['gift',type==='gift'],['username',type!=='manual'],['threshold',['gift','threshold'].includes(type)]]){
   const input=form.elements[name];input.closest('label').hidden=!visible;input.disabled=!visible;
   input.required=name==='gift'&&visible||name==='username'&&type==='user'||name==='threshold'&&visible;
  }
  form.querySelector('[data-rule-user-label]').textContent=type==='user'?t('Username obligatoriu','Required username'):t('Doar pentru utilizatorul (opțional)','Only for this user (optional)');
  form.querySelector('[data-rule-threshold-label]').textContent=type==='gift'?t('Cantitate minimă din acest cadou','Minimum quantity of this gift'):t('Valoare minimă totală a cadoului / combo-ului, în monede','Minimum total gift / combo value in coins');
 };
 form.elements.type.onchange=sync;sync();
}
