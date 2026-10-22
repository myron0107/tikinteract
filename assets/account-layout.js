import {ic} from './creator-ui.js?v=4';

const roots=new Set();
const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
const choice=(kind,value,label,icon='')=>`<button type="button" data-account-preference="${kind}" data-value="${value}" aria-pressed="false">${icon}${label}</button>`;

function preferences(){
 return `<section class="cp-panel account-preferences"><h3>${ic('sliders')}${t('Preferințe','Preferences')}</h3><p>${t('Alege cum arată spațiul tău.','Make this space your own.')}</p>
 <div class="account-preference-row"><span>${t('Aspect','Appearance')}</span><div role="group" aria-label="${t('Aspect','Appearance')}">${choice('mode','light',t('Luminos','Light'),ic('sun'))}${choice('mode','dark',t('Întunecat','Dark'),ic('moon'))}</div></div>
 <div class="account-preference-row"><span>${t('Paleta Studio','Studio palette')}</span><div role="group" aria-label="${t('Paleta Studio','Studio palette')}">${choice('theme','burgundy','Burgundy','<span class="account-swatch account-swatch-burgundy"></span>')}${choice('theme','blue','Racing Blue','<span class="account-swatch account-swatch-blue"></span>')}</div></div>
 <div class="account-preference-row"><span>${t('Limba','Language')}</span><div role="group" aria-label="${t('Limba','Language')}">${choice('language','ro','Română','<img src="assets/language-ro.svg" alt="" width="18" height="13">')}${choice('language','en','English','<img src="assets/language-en.svg" alt="" width="18" height="13">')}</div></div></section>`;
}

export function arrangeAccountLayout(root){
 if(document.body.dataset.page!=='studio')return;
 roots.add(root);root.classList.add('account-organized');root.classList.remove('account-single-page');
 const tabs=root.querySelector('.account-tabs'),profile=root.querySelector('#account-section-profile');
 const identity=profile.querySelector('.cp-profile-top');
 const summary=document.createElement('section');summary.className='account-summary';
 summary.setAttribute('aria-label',t('Sumarul contului','Account overview'));
 const details=document.createElement('div');details.className='account-summary-details';
 details.innerHTML=`<span class="account-summary-label">${t('CONT DE CREATOR','CREATOR ACCOUNT')}</span>`;
 details.append(identity);
 const access=document.createElement('button');access.type='button';access.className='account-summary-access';access.dataset.accountGo='subscription';
 access.innerHTML=`${ic('ticket')}<span><small>${t('Abonamentul tău','Your subscription')}</small><strong data-account-summary-plan>—</strong></span>${ic('arrow-right')}`;
 summary.append(details,access);tabs.before(summary);
 tabs.setAttribute('role','navigation');tabs.setAttribute('aria-label',t('Secțiunile contului','Account sections'));
 const sectionTitles={profile:t('Profil și preferințe','Profile and preferences'),subscription:t('Abonamentul meu','My subscription'),messages:t('Mesajele mele','My messages'),security:t('Securitate','Security')};
 const shortcuts={profile:t('Profil','Profile'),subscription:t('Abonament','Subscription'),messages:t('Mesaje','Messages'),security:t('Securitate','Security')};
 const icons={profile:'user',subscription:'ticket',messages:'envelope',security:'shield'};
 for(const button of tabs.querySelectorAll('[data-account-section-button]')){
  button.removeAttribute('role');button.removeAttribute('aria-selected');button.textContent=shortcuts[button.dataset.accountSectionButton];
 }
 for(const section of root.querySelectorAll('[data-account-section]')){
  const id=section.dataset.accountSection;section.classList.add('account-section-block');section.setAttribute('role','region');section.setAttribute('aria-labelledby','account-title-'+id);
  const header=document.createElement('header');header.className='account-section-heading';
  header.innerHTML=`<h3 id="account-title-${id}">${ic(icons[id])}${sectionTitles[id]}</h3>`;
  if(id==='messages'){
   header.insertAdjacentHTML('beforeend',`<p>${t('Conversațiile tale cu echipa de suport.','Your conversations with the support team.')}</p>`);
   header.append(section.querySelector('[data-open-support]'));section.querySelector('.account-message-toolbar').remove();
  }
  section.prepend(header);
 }
 const aside=document.createElement('div');aside.className='account-profile-aside';
 const oldPass=profile.querySelector('.cp-pass-card');oldPass.hidden=true;oldPass.classList.add('account-legacy-pass');
 aside.append(oldPass);aside.insertAdjacentHTML('beforeend',preferences());profile.append(aside);
 profile.querySelector('.cp-panel>h3').innerHTML=t('Detalii personale','Personal details');
 const form=profile.querySelector('[data-profile-form]');
 form.insertAdjacentHTML('afterbegin',`<p class="account-form-intro">${t('Numele afișat și contul TikTok asociat profilului tău.','Your display name and the TikTok account linked to your profile.')}</p>`);
 const security=root.querySelector('#account-section-security'),panel=security.querySelector('.cp-panel');
 panel.querySelector('h3').textContent=t('Acces la cont','Account access');
 const password=panel.querySelector('[data-account-password]'),signout=panel.querySelector('[onclick="logoutUser()"]'),status=panel.querySelector('[data-password-status]');
 const actions=document.createElement('div');actions.className='account-security-actions';
 for(const [button,title,copy,icon] of [[password,t('Parola contului','Account password'),t('Primești pe e-mail un link pentru resetare.','Receive a password reset link by email.'),'key'],[signout,t('Deconectare','Sign out'),t('Ieși din cont când ai terminat.','Sign out when you have finished.'),'right-from-bracket']]){
  const row=document.createElement('div');row.className='account-security-row';
  row.innerHTML=`${ic(icon)}<div><strong>${title}</strong><p>${copy}</p></div>`;row.append(button);actions.append(row);
 }
 panel.append(actions,status);
 const info=document.createElement('section');info.className='cp-panel account-security-info';
 info.innerHTML=`<h3>${ic('id-card')}${t('Datele contului','Account details')}</h3><dl><div><dt>${t('E-mail','Email')}</dt><dd data-account-security-email translate="no">—</dd></div><div><dt>${t('Conectare prin','Sign-in method')}</dt><dd data-account-provider>—</dd></div><div><dt>${t('Verificare e-mail','Email verification')}</dt><dd data-account-verification>—</dd></div><div><dt>${t('Membru din','Member since')}</dt><dd data-account-created>—</dd></div></dl>`;
 panel.after(info);
 if(!root.dataset.accountLayoutBound){
  root.dataset.accountLayoutBound='true';
  root.addEventListener('click',event=>{
   const go=event.target.closest('[data-account-go]');if(go)root.querySelector(`[data-account-section-button="${go.dataset.accountGo}"]`)?.click();
   const button=event.target.closest('[data-account-preference]');if(!button)return;
   const kind=button.dataset.accountPreference,value=button.dataset.value;
   if(kind==='language')window.TikInteractLanguage?.set(value);else window.TikInteractAppearance?.set({[kind]:value});
  });
  root.addEventListener('keydown',event=>{
   const button=event.target.closest('[data-account-section-button]');if(!button)return;
   const buttons=[...root.querySelectorAll('[data-account-section-button]')],index=buttons.indexOf(button);
   const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:null;
   if(next!==null){event.preventDefault();buttons[next].click();buttons[next].focus();}
  });

 }
 refreshAccountLayout(root);
}

export function refreshAccountLayout(root){
 if(!root?.classList.contains('account-organized'))return;
 const user=window.tikInteractUser,access=window.TikInteractPass?.getAccess();
 const plan=access?.plan==='play_pass_pro'?'Play Pass PRO':access?.plan==='play_pass'?'Play Pass':access?.plan==='free'?t('Gratuit','Free'):t('Se verifică…','Checking…');
 root.querySelector('[data-account-summary-plan]').textContent=plan;
 root.querySelector('.account-summary-access').dataset.plan=access?.plan||'unknown';
 const appearance=window.TikInteractAppearance?.get()||{},language=window.TikInteractLanguage?.get()||'ro';
 for(const button of root.querySelectorAll('[data-account-preference]'))button.setAttribute('aria-pressed',String(button.dataset.value===(button.dataset.accountPreference==='language'?language:appearance[button.dataset.accountPreference])));
 root.querySelector('[data-account-security-email]').textContent=user?.email||'—';
 const providers=user?.app_metadata?.providers||[user?.app_metadata?.provider].filter(Boolean);
 root.querySelector('[data-account-provider]').textContent=providers.map(value=>value==='google'?'Google':value==='email'?t('E-mail și parolă','Email and password'):value).join(', ')||'—';
 root.querySelector('[data-account-verification]').textContent=user?.email_confirmed_at?t('Confirmat','Verified'):user&&Object.hasOwn(user,'email_confirmed_at')?t('Neconfirmat','Unverified'):'—';
 root.querySelector('[data-account-created]').textContent=user?.created_at&&Number.isFinite(Date.parse(user.created_at))?new Intl.DateTimeFormat(window.TikInteractLanguage?.locale()||'ro-RO',{dateStyle:'medium'}).format(new Date(user.created_at)):'—';
}

window.addEventListener('tikinteract:appearance',()=>{for(const root of roots){if(root.isConnected)refreshAccountLayout(root);else roots.delete(root);}});
