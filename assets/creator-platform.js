import{ct,esc,ic,avatar}from'./creator-ui.js?v=4';
import './creator-metrics.js?v=1';
import {mountNotificationDropdown} from './studio-notifications.js?v=8';
import {initializeStudioWindows,openStudioWindow} from './studio-user-windows.js?v=9';
import {initializeStudioDestination} from './studio-destination.js?v=1';
const $=id=>document.getElementById(id),studio=document.body.dataset.page==='studio';
const label=key=>`<span data-cp="${key}">${ct(key)}</span>`;
function translateUI(){document.querySelectorAll('[data-cp]').forEach(el=>{el.textContent=ct(el.dataset.cp);});document.querySelectorAll('[data-cp-placeholder]').forEach(el=>{el.placeholder=ct(el.dataset.cpPlaceholder);});document.querySelectorAll('[data-cp-title]').forEach(el=>{el.title=ct(el.dataset.cpTitle);el.setAttribute('aria-label',ct(el.dataset.cpTitle));});}
// The current Studio shell lives in live-studio.html. Only bind its controls.
function workspace(){
 if(!studio)return;
 const controls=$('creator-orientation');
 if(controls&&!controls.tikInteractBound){
  controls.tikInteractBound=true;
  controls.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button)return;
   if(button.dataset.format){window.TikInteractStudioLayout?.setFormat(button.dataset.format);updateFormat();}
   else{const stage=document.querySelector('.studio-stage');if(document.fullscreenElement)document.exitFullscreen();else stage.requestFullscreen?.();}
  });
 }
 updateFormat();
}
function updateFormat(){const format=window.TikInteractStudioLayout?.getFormat?.()||'portrait';document.querySelectorAll('[data-format]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.format===format)));const note=$('creator-format-note');if(note)note.textContent=(format==='landscape'?ct('horizontal'):ct('vertical'))+' · '+ct('formatHint');}
async function openPanel(tab){if(tab==='community'){const{mountCommunity}=await import('./creator-community.js?v=1');mountCommunity($('creator-community-panel'));}if(tab==='analytics'){const{mountAnalytics}=await import('./creator-analytics.js?v=3');mountAnalytics($('creator-analytics-panel'));}if(tab==='account'){const{mountAccount}=await import('./creator-account.js?v=11');mountAccount($('creator-account-panel'));}if(studio){const heading=document.querySelector('.app-workspace-heading');if(heading)heading.hidden=['community','analytics','account'].includes(tab);}}
function profile(){const user=window.tikInteractUser,name=user?.user_metadata?.display_name||user?.user_metadata?.full_name||user?.email?.split('@')[0]||'TikInteract';const node=document.querySelector('[data-rail-name]');if(node)node.textContent=name;const photo=$('header-account-avatar-image')?.src||'';const av=document.querySelector('[data-rail-avatar]');if(av)av.innerHTML=avatar(name,photo);const top=$('studio-account-avatar');if(top)top.hidden=!user;}
function menu(){if(!studio)return;const menu=$('user-profile-menu');if(!menu)return;let button=menu.querySelector('[data-account-support]');if(!button){button=document.createElement('button');button.type='button';button.className='account-menu-button';button.dataset.accountSupport='';menu.insertBefore(button,menu.children[1]||null);}button.removeAttribute('data-open-support');button.onclick=event=>{event.stopPropagation();window.closeAccountMenu?.();openAccountMessages();};button.setAttribute('data-native-i18n','');button.innerHTML=ic('envelope')+label('messages')+'<span data-inbox-badge hidden class="cp-ticket"></span>';
 const actions=document.querySelector('.header-account-actions');if(actions&&!$('creator-inbox-bell')){const bell=document.createElement('button');bell.id='creator-inbox-bell';bell.type='button';bell.className='cp-header-bell';bell.setAttribute('data-cp-title','notifications');bell.innerHTML=ic('bell')+'<span data-inbox-badge hidden class="cp-unread-dot"></span>';actions.insertBefore(bell,actions.querySelector('[data-mode-toggle]')?.nextSibling||null);bell.hidden=!window.tikInteractUser;mountNotificationDropdown(bell);}if(actions&&!$('studio-account-avatar')){const photo=$('header-account-avatar');if(photo){const button=document.createElement('button');button.id='studio-account-avatar';button.type='button';button.setAttribute('data-cp-title','account');button.onclick=event=>window.TikInteractStudioWindows?.toggleMenu(event);button.hidden=!window.tikInteractUser;button.append(photo);actions.append(button);}}if(actions){const language=actions.querySelector(".language-picker");if(language)actions.insertBefore(language,$('studio-user-menu-wrap')||$('studio-account-avatar'));}}
function openAccountMessages(){if(!window.tikInteractUser){window.openAuthModal?.();return;}if(studio)return openStudioWindow('support');else window.switchView('account');import('./creator-account.js?v=11').then(module=>module.focusMessages());}
async function openAccountSection(section='profile',plan=''){if(!studio)return;return openStudioWindow(section==='subscription'?'subscription':section==='messages'?'support':'account',{section,plan});}
function initialize(){if(studio){workspace();profile();}menu();if(studio)initializeStudioWindows();translateUI();import('./creator-account.js?v=11').then(module=>{module.initializeAccount();if(!studio&&$('view-account'))module.mountAccount($('view-account'));});}
window.addEventListener('tikinteract:studio-tab',event=>openPanel(event.detail.tab));
window.addEventListener('tikinteract:config',workspace);
window.addEventListener('tikinteract:auth',()=>{profile();menu();const bell=$('creator-inbox-bell');if(bell)bell.hidden=!window.tikInteractUser;});
window.addEventListener('tikinteract:streamer-profile',()=>queueMicrotask(profile));
window.addEventListener('tikinteract:language',()=>{translateUI();updateFormat();});
window.addEventListener('tikinteract:view',event=>{if(event.detail.view==='account')import('./creator-account.js?v=11').then(module=>module.mountAccount($('view-account')));});
window.TikInteractCreator=Object.freeze({openAccountMessages,openAccountSection,refreshMenu:menu});
if(studio)initializeStudioDestination(openAccountSection);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
