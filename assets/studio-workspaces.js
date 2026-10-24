import {openAnimations,openAnimationCredits} from './studio-animations-entry.js?v=9';
import {loadAnimationState} from './animations-state.js?v=3';
const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
const labels={generator:['Generator AI','AI generator'],universes:['Universuri','Universes'],library:['Biblioteca mea','My library'],credits:['Credite AI','AI credits'],guide:['Ghid AI','AI guide'],history:['Istoric generări','Generation history']};
let mode=document.documentElement.dataset.workspace==='ai'?'ai':'live',aiTab=new URLSearchParams(location.search).get('ai')||'generator',opening=0,wallet=null,accountOwner=window.tikInteractUser?.id||null;
if(!labels[aiTab])aiTab='generator';
function paint(){
 document.documentElement.dataset.workspace=mode;
 for(const b of document.querySelectorAll('.studio-workspace-switch button[data-workspace]')){
  b.setAttribute('aria-pressed',String(b.dataset.workspace===mode));
  if(b.dataset.workspace==='ai')b.disabled=window.TikInteractStudioVisibility?.isVisible('animations')===false;
 }
 for(const b of document.querySelectorAll('[data-ai-tab]')){
  const key=b.dataset.aiTab,selected=(aiTab==='history'?'credits':aiTab)===key;
  b.setAttribute('aria-current',selected?'page':'false');b.querySelector('span').textContent=t(...labels[key]);b.title=t(...labels[key]);b.setAttribute('aria-label',b.title);
 }
 const title=document.getElementById('studio-current-section');if(mode==='ai'&&title)title.textContent='AI Studio / '+t(...labels[aiTab]);
 const number=document.querySelector('[data-credit-balance]'),label=document.querySelector('[data-credit-label]');
 if(number)number.textContent=wallet?new Intl.NumberFormat(t('ro-RO','en-GB')).format(Number(wallet.included)+Number(wallet.purchased)):'—';
 if(label)label.textContent=t('credite AI','AI credits');
 for(const button of document.querySelectorAll('[data-credit-topup],[data-credit-view]')){button.title=t('Credite AI și reîncărcare','AI credits and top-ups');button.setAttribute('aria-label',button.title);if(button.hasAttribute('data-credit-topup'))button.disabled=!wallet;}
}
async function open(next,{tab,clip,configure=false,history:recordHistory=true}={}){
 if(next==='ai'&&window.TikInteractStudioVisibility?.isVisible('animations')===false)return;
 const current=++opening;mode=next==='ai'?'ai':'live';if(mode==='ai'&&labels[tab])aiTab=tab;paint();
 const url=new URL(location.href);if(mode==='ai'){url.searchParams.set('workspace','ai');url.searchParams.set('ai',aiTab);}else{url.searchParams.delete('workspace');url.searchParams.delete('ai');}
 if(recordHistory)window.history.pushState({},'',url);
 if(mode==='ai'){
  const wanted=aiTab;if(document.getElementById('studio-animations-panel')?.classList.contains('hidden'))window.setLiveStudioTab?.('animations',{focus:false,preserveWindow:true});await openAnimations({mode:'ai',tab:wanted});
 }else{
  window.startTikInteractStudio?.();window.setLiveStudioTab?.(tab||'studio',{focus:false,preserveWindow:true});
  if(tab==='animations')await openAnimations({mode:'live',tab:configure?'events':'library',...(configure?{clip}:{highlight:clip})});
 }
 if(current!==opening)return;window.dispatchEvent(new CustomEvent('tikinteract:workspace',{detail:{mode}}));paint();
}
window.TikInteractWorkspaces=Object.freeze({getMode:()=>mode,open});
async function refreshWallet(){const own=window.tikInteractUser?.id;if(!own){wallet=null;paint();return;}try{const data=await loadAnimationState();if(own!==window.tikInteractUser?.id)return;wallet=data.wallet;paint();}catch{if(own===window.tikInteractUser?.id){wallet=null;paint();}}}
async function init(){
 document.querySelectorAll('.studio-workspace-switch button[data-workspace]').forEach(b=>b.onclick=()=>open(b.dataset.workspace));
 document.querySelectorAll('[data-ai-tab]').forEach(b=>b.onclick=()=>open('ai',{tab:b.dataset.aiTab}));
 document.querySelector('[data-credit-view]')?.addEventListener('click',()=>open('ai',{tab:'credits'}));
 document.querySelector('[data-credit-topup]')?.addEventListener('click',()=>openAnimationCredits());
 document.getElementById('studio-ai-nav')?.addEventListener('keydown',e=>{const buttons=[...document.querySelectorAll('[data-ai-tab]')],index=buttons.indexOf(e.target);if(index<0)return;let next=e.key==='ArrowDown'?(index+1)%buttons.length:e.key==='ArrowUp'?(index+buttons.length-1)%buttons.length:e.key==='Home'?0:e.key==='End'?buttons.length-1:null;if(next!==null){e.preventDefault();buttons[next].focus();}});
 document.querySelector('.studio-app-rail')?.addEventListener('click',e=>{
  const button=e.target.closest('[data-studio-tab],.cp-rail-brand,[data-sw-rail-help]');
  if(mode==='ai'&&button){mode='live';document.documentElement.dataset.workspace='live';const u=new URL(location.href);u.searchParams.delete('workspace');u.searchParams.delete('ai');history.replaceState({},'',u);paint();window.startTikInteractStudio?.();if(button.dataset.studioTab==='animations')openAnimations({mode:'live',tab:'library'});}
 },{capture:true});
 paint();refreshWallet();if(mode==='ai')await open('ai',{tab:aiTab,history:false});window.TikInteractStartup?.ready('workspace');
}
window.addEventListener('tikinteract:animation-state',e=>{wallet=e.detail.wallet;paint();});
window.addEventListener('tikinteract:animation-error',()=>{wallet=null;paint();});
window.addEventListener('tikinteract:animation-view',e=>{if(e.detail.workspace==='ai'&&labels[e.detail.tab])aiTab=e.detail.tab;paint();});
window.addEventListener('tikinteract:auth',()=>{const next=window.tikInteractUser?.id||null;if(next===accountOwner)return;accountOwner=next;wallet=null;paint();refreshWallet();if(mode==='ai'&&next)queueMicrotask(()=>open('ai',{tab:aiTab,history:false}));});
window.addEventListener('tikinteract:config',()=>queueMicrotask(()=>{if(mode==='ai'&&window.TikInteractStudioVisibility?.isVisible('animations')===false)open('live',{history:false});paint();}));
window.addEventListener('tikinteract:language',paint);
window.addEventListener('popstate',()=>{const q=new URLSearchParams(location.search);open(q.get('workspace')==='ai'?'ai':'live',{tab:q.get('ai'),history:false});});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
