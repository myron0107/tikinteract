// Reuse the same private SupportInbox component and RPCs as the Support dialog.
import {SupportInbox} from './support-center.js?v=2';
import {esc,ic,rpc} from './creator-ui.js?v=2';
import {localizeText} from './language-copy.js?v=6';
const states=new Map(),t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
const texts=new WeakMap(),attributes=new WeakMap();
const privateCopy='[translate=no],input,textarea,.si-ticket>strong,.si-ticket-preview,.si-message>p,.si-message header>strong,.si-thread-heading h3';
const phrase=(value,language)=>{const separator=value.indexOf(' · #');return separator>0?localizeText(value.slice(0,separator),language)+value.slice(separator):localizeText(value,language);};
function localize(host){
 const language=window.TikInteractLanguage?.get()||'ro';
 const translate=(value,saved)=>{if(!saved||(value!==saved.ro&&value!==saved.en)){const ro=phrase(value,'ro');saved={ro,en:phrase(ro,'en')};}return{state:saved,value:saved[language]};};
 const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);let text;
 while((text=walker.nextNode())){if(!text.nodeValue.trim()||text.parentElement.closest(privateCopy))continue;const next=translate(text.nodeValue,texts.get(text));texts.set(text,next.state);if(next.value!==text.nodeValue)text.nodeValue=next.value;}
 for(const el of host.querySelectorAll('[placeholder],[aria-label],[title]')){if(el.matches('[translate=no]'))continue;const saved=attributes.get(el)||new Map();attributes.set(el,saved);for(const attr of ['placeholder','aria-label','title']){const value=el.getAttribute(attr);if(value){const next=translate(value,saved.get(attr));saved.set(attr,next.state);if(next.value!==value)el.setAttribute(attr,next.value);}}}
}
function ensure(root){
 let state=states.get(root);if(state)return state;
 const host=document.createElement('div');host.dataset.accountSupportInbox='';host.hidden=true;
 state={root,host,owner:null,service:null,view:root.dataset.messageCenterView||'support',queued:false};states.set(root,state);
 state.observer=new MutationObserver(()=>{if(state.queued)return;state.queued=true;requestAnimationFrame(()=>{state.queued=false;localize(host);});});state.observer.observe(host,{subtree:true,childList:true,characterData:true});
 return state;
}
function start(state){
 const owner=window.tikInteractUser?.id;if(!owner)return;
 if(state.service&&state.owner===owner)return;
 state.service?.destroy();state.owner=owner;
 state.service=new SupportInbox({root:state.host,idPrefix:'studio-account',rpc:async(name,args)=>{if(owner!==window.tikInteractUser?.id)throw Error('Account changed');const data=await rpc(name,args);if(owner!==window.tikInteractUser?.id)throw Error('Account changed');return data;},onStats:()=>window.dispatchEvent(new Event('tikinteract:account-support-stats'))});
 state.service.start();localize(state.host);
}
export function selectAccountMessages(root){
 const state=ensure(root);state.view='support';delete root.dataset.messageCenterView;
 const visible=(root.classList.contains('account-single-page')||root.dataset.accountSection==='messages')&&!root.hidden&&!root.classList.contains('hidden');
 state.host.hidden=!visible;
 if(visible)start(state);
}
export function openSupportConversation(root,ticket){if(!root)return;selectAccountMessages(root);const state=ensure(root);state.service?.open(ticket);}
export function mountAccountMessages(root,panel){
 const state=ensure(root);panel.classList.add('account-message-center');
 const bar=document.createElement('div');bar.className='account-message-toolbar';
 bar.innerHTML='<strong>'+ic('comments')+t('Conversații cu echipa','Team conversations')+'</strong><button type="button" class="cp-btn cp-btn-primary" data-open-support>'+ic('plus')+t('Mesaj nou','New message')+'</button>';
 panel.append(bar,state.host);state.host.id='account-support-view';
 selectAccountMessages(root,state.view);localize(state.host);
}
window.addEventListener('tikinteract:studio-tab',()=>{for(const [root,state]of states)selectAccountMessages(root,state.view);});
window.addEventListener('tikinteract:studio-window',()=>{for(const [root,state]of states)selectAccountMessages(root,state.view);});
window.addEventListener('tikinteract:support',()=>{for(const state of states.values())if(state.service&&!state.host.hidden)state.service.refresh();});
window.addEventListener('tikinteract:auth',()=>{for(const [root,state]of states){if(state.owner!==window.tikInteractUser?.id){state.service?.destroy();state.service=null;state.owner=null;state.host.replaceChildren();}selectAccountMessages(root,state.view);}});
window.addEventListener('tikinteract:language',()=>{for(const state of states.values())localize(state.host);});
