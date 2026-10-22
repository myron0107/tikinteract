import {esc,ic} from './creator-ui.js?v=4';

const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
const accountModule=()=>import('./creator-account.js?v=9');
const titles={account:['Contul meu','My account'],subscription:['Abonamentul meu','My subscription'],analytics:['Statistici','Analytics'],support:['Suport','Support'],help:['Ghid Studio','Studio guide'],community:['Comunitate','Community']};
const icons={account:'user',subscription:'ticket',analytics:'chart-line',support:'comments',help:'circle-question',community:'users'};
let dialog,menu,wrap,trigger,content,accountRoot,view=null,pane='profile',request=0,opener,restoreFocus=true,adminUser=null,identity=null,selectingAccount=false;
const panels=new Map();

function closeMenu({focus=false}={}){
 if(!menu)return;menu.hidden=true;trigger?.setAttribute('aria-expanded','false');if(focus)trigger?.focus({preventScroll:true});
}
function positionMenu(){
 if(!menu||menu.hidden)return;menu.style.right='0px';const box=menu.getBoundingClientRect();if(box.left<8)menu.style.right=(box.left-8)+'px';
}
function renderMenu(){
 if(!menu)return;const user=window.tikInteractUser;wrap.hidden=!user;if(!user){closeMenu();return;}
 const access=window.TikInteractPass?.getAccess(),name=user.user_metadata?.display_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Creator';
 const plan=access?.plan==='play_pass_pro'?'Play Pass PRO':access?.plan==='play_pass'?'Play Pass':access?.plan==='free'?t('Gratuit','Free'):'—';
 const planId=['free','play_pass','play_pass_pro'].includes(access?.plan)?access.plan:'unknown';
 const current=document.activeElement?.dataset?.studioUserView;
 menu.innerHTML=`<div class="sw-menu-identity"><div><strong translate="no">${esc(name)}</strong><span class="sw-menu-plan" data-plan="${planId}">${planId!=='unknown'?ic('ticket'):''}<span>${plan}</span></span></div><small translate="no">${esc(user.email||'')}</small></div><div class="sw-menu-items">${['account','subscription','analytics','support'].map(id=>`<button type="button" role="menuitem" data-studio-user-view="${id}">${ic(icons[id])}<span>${t(...titles[id])}</span>${ic('chevron-right')}</button>`).join('')}</div><div class="sw-menu-footer"><a href="admin.html" role="menuitem" data-sw-admin hidden>${ic('user-shield')}<span>${t('Administrare','Administration')}</span></a><button type="button" role="menuitem" data-sw-signout>${ic('right-from-bracket')}<span>${t('Deconectare','Sign out')}</span></button></div>`;
 const admin=menu.querySelector('[data-sw-admin]');admin.hidden=adminUser!==user.id;
 trigger.title=t('Meniul contului','Account menu');trigger.setAttribute('aria-label',trigger.title);
 if(current&&!menu.hidden)menu.querySelector(`[data-studio-user-view="${current}"]`)?.focus({preventScroll:true});positionMenu();
}
export function toggleStudioUserMenu(event){
 event?.stopPropagation();if(!window.tikInteractUser){window.openAuthModal?.();return;}
 if(!menu.hidden){closeMenu({focus:true});return;}
 document.querySelector('[data-notifications-close]')?.click();window.TikInteractLanguage?.close();window.closeAccountMenu?.();renderMenu();menu.hidden=false;trigger.setAttribute('aria-expanded','true');positionMenu();menu.querySelector('[role=menuitem]')?.focus({preventScroll:true});
}
function syncWindow(){
 if(!dialog||!view)return;dialog.dataset.view=view;dialog.dataset.settingsPane=pane;
 dialog.querySelector('[data-sw-title]').textContent=t(...titles[view]);dialog.querySelector('[data-sw-icon]').innerHTML=ic(icons[view]);
 const close=dialog.querySelector('[data-sw-close]');close.title=t('Închide','Close');close.setAttribute('aria-label',close.title);
 const aside=dialog.querySelector('[data-sw-settings]');aside.hidden=view!=='account';
 aside.innerHTML=`<small>${t('SETĂRI CONT','ACCOUNT SETTINGS')}</small>${[['profile','user',t('Profil','Profile')],['preferences','sliders',t('Preferințe','Preferences')],['security','shield',t('Securitate','Security')]].map(([id,icon,label])=>`<button type="button" data-sw-settings-pane="${id}" aria-current="${pane===id?'page':'false'}">${ic(icon)}<span>${label}</span></button>`).join('')}`;
 const links=dialog.querySelector('[data-sw-support-links]');links.hidden=view!=='support';links.innerHTML=`<button type="button" data-sw-open="community">${ic('users')}${t('Comunitate','Community')}<small>PRO</small></button>`;
 const back=dialog.querySelector('[data-sw-back]');back.hidden=view!=='community';back.title=t('Înapoi la suport','Back to support');back.setAttribute('aria-label',back.title);
 if(accountRoot){accountRoot.dataset.settingsPane=pane;const heading=accountRoot.querySelector('#account-title-profile');if(heading)heading.innerHTML=ic(pane==='preferences'?'sliders':'user')+t(pane==='preferences'?'Preferințe':'Profil',pane==='preferences'?'Preferences':'Profile');}
}
function notifyWindow(open){window.dispatchEvent(new CustomEvent('tikinteract:studio-window',{detail:{view,open}}));}
function hiddenPanels(){for(const root of panels.values()){root.hidden=true;root.classList.add('hidden');}}
function ensureDialog(){
 if(dialog)return;
 dialog=document.createElement('dialog');dialog.id='studio-user-dialog';dialog.className='sw-dialog';dialog.setAttribute('aria-labelledby','studio-user-window-title');dialog.setAttribute('data-native-i18n','');
 dialog.innerHTML=`<div class="sw-frame"><header class="sw-window-header"><button type="button" data-sw-back hidden>${ic('arrow-left')}</button><span data-sw-icon></span><h2 id="studio-user-window-title" data-sw-title></h2><button type="button" data-sw-close>${ic('xmark')}</button></header><div class="sw-support-links" data-sw-support-links hidden></div><div class="sw-window-body"><nav class="sw-settings-nav" data-sw-settings hidden></nav><div class="sw-window-content" data-sw-content><p class="sw-loading" data-sw-loading hidden></p></div></div></div>`;
 document.body.append(dialog);content=dialog.querySelector('[data-sw-content]');
 dialog.addEventListener('click',event=>{
  if(event.target===dialog||event.target.closest('[data-sw-close]'))closeStudioWindow();
  const setting=event.target.closest('[data-sw-settings-pane]');if(setting)openStudioWindow('account',{section:setting.dataset.swSettingsPane});
  const link=event.target.closest('[data-sw-open]');if(link)openStudioWindow(link.dataset.swOpen);
  if(event.target.closest('[data-sw-back]'))openStudioWindow('support');
  if(event.target.closest('[onclick="openStudioHelp()"]')){closeStudioWindow({focus:false});}
 });
 dialog.addEventListener('close',()=>{if(dialog.open)return;request++;hiddenPanels();notifyWindow(false);view=null;document.body.classList.remove('sw-modal-open');if(restoreFocus&&opener?.isConnected)opener.focus({preventScroll:true});});
}
export function closeStudioWindow({focus=true}={}){
 request++;closeMenu();if(!dialog?.open)return;restoreFocus=focus;dialog.close();
}
export async function openStudioWindow(target,{section='profile',plan=''}={}){
 if(!Object.hasOwn(titles,target))return;
 if(!window.tikInteractUser){window.openAuthModal?.();return;}
 ensureDialog();const own=window.tikInteractUser.id,current=++request;
 closeMenu();document.querySelector('[data-notifications-close]')?.click();window.TikInteractLanguage?.close();
 const switching=dialog.open;if(!switching)opener=trigger;view=target;pane=['profile','preferences','security'].includes(section)?section:'profile';
 hiddenPanels();syncWindow();const loading=content.querySelector('[data-sw-loading]');loading.textContent=t('Se încarcă…','Loading…');loading.hidden=false;content.setAttribute('aria-busy','true');
 if(!dialog.open){dialog.showModal();document.body.classList.add('sw-modal-open');}
 try{
  let root;
  if(['account','subscription','support'].includes(target)){
   const account=await accountModule();if(current!==request||own!==window.tikInteractUser?.id)return;
   root=document.getElementById('creator-account-panel');accountRoot=root;content.append(root);panels.set('account',root);root.hidden=false;root.classList.remove('hidden');
   const key=target==='subscription'?'subscription':target==='support'?'messages':pane==='security'?'security':'profile';
   selectingAccount=true;try{account.mountAccount(root);account.openAccountSection(key,plan);}finally{selectingAccount=false;}root.dataset.settingsPane=pane;
  }else{
   root=document.getElementById(target==='analytics'?'creator-analytics-panel':target==='community'?'creator-community-panel':'studio-help-panel');
   if(!root)throw Error('PANEL_UNAVAILABLE');content.append(root);panels.set(target,root);root.hidden=false;root.classList.remove('hidden');
   if(target==='analytics'){const module=await import('./creator-analytics.js?v=3');if(current!==request||own!==window.tikInteractUser?.id)return;module.mountAnalytics(root);}
   if(target==='community'){const module=await import('./creator-community.js?v=1');if(current!==request||own!==window.tikInteractUser?.id)return;module.mountCommunity(root);}
  }
  if(current!==request||own!==window.tikInteractUser?.id)return;
  syncWindow();content.scrollTop=0;notifyWindow(true);dialog.querySelector('[data-sw-close]').focus({preventScroll:true});
 }catch{
  if(current===request){loading.hidden=false;loading.textContent=t('Panoul nu s-a putut încărca. Închide și încearcă din nou.','The panel could not load. Close it and try again.');}
 }finally{if(current===request){content.removeAttribute('aria-busy');if(loading.textContent===t('Se încarcă…','Loading…'))loading.hidden=true;}}
}
function localizeRailFooter(){
 const footer=document.querySelector('.sw-rail-footer');if(!footer)return;
 const help=footer.querySelector('[data-sw-rail-help]'),back=footer.querySelector('a');
 for(const [item,name]of [[help,t('Ghid Studio','Studio guide')],[back,t('Înapoi la site','Back to website')]]){
  if(item){item.title=name;item.setAttribute('aria-label',name);item.querySelector('span').textContent=name;}
 }
 if(help)help.onclick=()=>openStudioWindow('help');
}
export function initializeStudioWindows(){
 if(document.body.dataset.page!=='studio'||wrap)return;
 trigger=document.getElementById('studio-account-avatar');if(!trigger)return;
 ensureDialog();wrap=document.createElement('div');wrap.id='studio-user-menu-wrap';wrap.className='sw-menu-wrap';trigger.before(wrap);wrap.append(trigger);
 menu=document.createElement('div');menu.id='studio-profile-dropdown';menu.className='sw-profile-dropdown';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('data-native-i18n','');wrap.append(menu);
 trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-controls',menu.id);trigger.setAttribute('aria-expanded','false');trigger.onclick=toggleStudioUserMenu;
 const legacy=document.getElementById('user-profile-menu');
 const syncAdmin=()=>{if(legacy?.querySelector('[data-platform-admin-link]'))adminUser=window.tikInteractUser?.id||null;else adminUser=null;renderMenu();};
 if(legacy)new MutationObserver(syncAdmin).observe(legacy,{childList:true,subtree:true});
 menu.addEventListener('click',event=>{const button=event.target.closest('[data-studio-user-view]');if(button)openStudioWindow(button.dataset.studioUserView);if(event.target.closest('[data-sw-signout]')){closeMenu();closeStudioWindow({focus:false});window.logoutUser?.();}});
 wrap.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!menu.hidden){event.preventDefault();closeMenu({focus:true});return;}
  if(menu.hidden)return;const items=[...menu.querySelectorAll('[role=menuitem]')].filter(el=>!el.hidden),index=items.indexOf(document.activeElement);
  const next=event.key==='ArrowDown'?(index+1)%items.length:event.key==='ArrowUp'?(index+items.length-1)%items.length:event.key==='Home'?0:event.key==='End'?items.length-1:null;
  if(next!==null){event.preventDefault();items[next]?.focus();}
  if(event.key==='Tab')requestAnimationFrame(()=>{if(!wrap.contains(document.activeElement))closeMenu();});
 });
 document.addEventListener('click',event=>{if(!wrap.contains(event.target))closeMenu();});window.addEventListener('resize',positionMenu);
 localizeRailFooter();
 const nativeTab=window.setLiveStudioTab;
 window.setLiveStudioTab=(tab,options)=>{if(['account','analytics','community','help'].includes(tab))return openStudioWindow(tab);closeStudioWindow({focus:false});return nativeTab?.(tab,options);};
 window.addEventListener('tikinteract:auth',()=>{
  const next=window.tikInteractUser?.id||null;if(next!==identity){identity=next;adminUser=null;closeStudioWindow({focus:false});closeMenu();}renderMenu();
 });
 window.addEventListener('tikinteract:access',renderMenu);
 window.addEventListener('tikinteract:language',()=>{renderMenu();syncWindow();localizeRailFooter();});
 window.addEventListener('tikinteract:account-mounted',()=>{if(dialog.open){accountRoot=document.getElementById('creator-account-panel');syncWindow();}});
 window.addEventListener('tikinteract:account-section',event=>{
  if(!dialog.open||selectingAccount)return;const key=event.detail.section,target=key==='subscription'?'subscription':key==='messages'?'support':'account';
  if(view!==target)openStudioWindow(target,{section:key});
 });
 identity=window.tikInteractUser?.id||null;syncAdmin();renderMenu();
 window.TikInteractStudioWindows=Object.freeze({open:openStudioWindow,close:closeStudioWindow,toggleMenu:toggleStudioUserMenu,getView:()=>view});
}
