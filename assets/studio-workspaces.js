import {openAnimations} from './studio-animations-entry.js?v=5';
const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
let mode=document.documentElement.dataset.workspace==='ai'?'ai':'live',opening=0;
function paint(){
 document.documentElement.dataset.workspace=mode;
 for(const b of document.querySelectorAll('[data-workspace]')){
  b.setAttribute('aria-pressed',String(b.dataset.workspace===mode));
  if(b.dataset.workspace==='ai')b.disabled=window.TikInteractStudioVisibility?.isVisible('animations')===false;
 }
 const label=document.getElementById('studio-current-section');if(mode==='ai'&&label)label.textContent='AI STUDIO';
 const caption=document.getElementById('workspace-caption');if(caption)caption.textContent=t('Un cont. Două spații de lucru.','One account. Two workspaces.');
}
async function open(next,{tab,clip,history:recordHistory=true}={}){
 if(next==='ai'&&window.TikInteractStudioVisibility?.isVisible('animations')===false)return;
 const current=++opening;
  mode=next==='ai'?'ai':'live';paint();
  const url=new URL(location.href);if(mode==='ai')url.searchParams.set('workspace','ai');else url.searchParams.delete('workspace');
  if(recordHistory)window.history.pushState({},'',url);
  if(mode==='ai'){
   window.setLiveStudioTab?.('animations',{focus:false,preserveWindow:true});await openAnimations({mode:'ai',tab});
  }else{
   window.startTikInteractStudio?.();window.setLiveStudioTab?.(tab||'studio',{focus:false,preserveWindow:true});
   if(tab==='animations')await openAnimations({mode:'live',tab:clip?'events':'library',clip});
  }
  if(current!==opening)return;window.dispatchEvent(new CustomEvent('tikinteract:workspace',{detail:{mode}}));paint();
}
window.TikInteractWorkspaces=Object.freeze({getMode:()=>mode,open});
async function init(){
 document.querySelectorAll('[data-workspace]').forEach(b=>b.onclick=()=>open(b.dataset.workspace));paint();
 document.querySelector('.studio-app-rail')?.addEventListener('click',e=>{
  const button=e.target.closest('[data-studio-tab],.cp-rail-brand,[data-sw-rail-help]');
  if(mode==='ai'&&button){mode='live';document.documentElement.dataset.workspace='live';const u=new URL(location.href);u.searchParams.delete('workspace');history.replaceState({},'',u);paint();window.startTikInteractStudio?.();if(button.dataset.studioTab==='animations')openAnimations({mode:'live'});}
 },{capture:true});
 if(mode==='ai')await open('ai',{history:false});window.TikInteractStartup?.ready('workspace');
}
window.addEventListener('tikinteract:auth',()=>{if(mode==='ai'&&window.tikInteractUser)queueMicrotask(()=>open('ai',{history:false}));});
window.addEventListener('tikinteract:config',()=>queueMicrotask(()=>{if(mode==='ai'&&window.TikInteractStudioVisibility?.isVisible('animations')===false)open('live',{history:false});paint();}));
window.addEventListener('tikinteract:language',paint);
window.addEventListener('popstate',()=>open(new URLSearchParams(location.search).get('workspace')==='ai'?'ai':'live',{history:false}));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
