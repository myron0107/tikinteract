// A compact view of the existing authenticated site inbox; no separate store.
import {mountNotifications,refreshInbox} from './creator-account.js?v=9';
import {ct,ic} from './creator-ui.js?v=2';
let wrapper,panel,bell;
function close({focus=false}={}){if(!panel)return;panel.hidden=true;bell.setAttribute('aria-expanded','false');if(focus)bell.focus();}
function position(){if(!panel||panel.hidden)return;panel.style.right='0px';const bounds=panel.getBoundingClientRect();if(bounds.left<8)panel.style.right=(bounds.left-8)+'px';}
export function mountNotificationDropdown(button){
 if(wrapper)return;bell=button;wrapper=document.createElement('div');wrapper.className='studio-notifications';bell.before(wrapper);wrapper.append(bell);
 panel=document.createElement('section');panel.id='studio-notifications-panel';panel.className='studio-notifications-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','studio-notifications-title');panel.setAttribute('data-native-i18n','');wrapper.append(panel);
 bell.setAttribute('aria-haspopup','dialog');bell.setAttribute('aria-controls',panel.id);bell.setAttribute('aria-expanded','false');
 mountNotifications(panel);labels();
 bell.onclick=()=>{if(!window.tikInteractUser){window.openAuthModal?.();return;}if(!panel.hidden){close();return;}window.TikInteractLanguage?.close();window.closeAccountMenu?.();panel.hidden=false;bell.setAttribute('aria-expanded','true');position();refreshInbox();panel.querySelector('[data-notifications-close]')?.focus({preventScroll:true});};
 document.addEventListener('click',event=>{if(!wrapper.contains(event.target))close();});
 panel.addEventListener('click',event=>{if(event.target.closest('[data-notifications-close]'))close({focus:true});if(event.target.closest('[data-reply]'))close();});
 wrapper.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopPropagation();close({focus:true});}if(event.key==='Tab')requestAnimationFrame(()=>{if(!wrapper.contains(document.activeElement))close();});});
 window.addEventListener('resize',position);window.addEventListener('tikinteract:studio-tab',()=>close());window.addEventListener('tikinteract:auth',()=>close());window.addEventListener('tikinteract:language',()=>{labels();position();});
}
function labels(){if(!panel)return;const heading=panel.querySelector('.cp-inbox-heading');if(!heading)return;heading.querySelector('h3').id='studio-notifications-title';heading.querySelector('h3').innerHTML=ic('bell')+ct('notifications')+' <span class="cp-inbox-count" data-inbox-count>0</span>';heading.querySelector('p')?.remove();let closeButton=heading.querySelector('[data-notifications-close]');if(!closeButton){closeButton=document.createElement('button');closeButton.type='button';closeButton.className='notification-close';closeButton.dataset.notificationsClose='';closeButton.innerHTML=ic('xmark');heading.append(closeButton);}closeButton.setAttribute('aria-label',window.TikInteractLanguage?.get()==='en'?'Close notifications':'Închide notificările');}
