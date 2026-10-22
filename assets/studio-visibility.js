import {studioVisibility} from './platform-schema.js?v=2';
const main=['studio','games','audio','animations'];
let visible=studioVisibility(),configured=false;
const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
const isVisible=key=>visible[key==='help'?'guide':key]!==false;
function openDefault(){const next=main.find(isVisible);if(next)window.setLiveStudioTab?.(next,{focus:false,preserveWindow:true});return !!next;}
export function applyStudioVisibility(config){
 if(document.body.dataset.page!=='studio')return;
 const previous=JSON.stringify(visible);
 visible=studioVisibility(config);configured=true;
 if(previous!==JSON.stringify(visible)&&document.getElementById('studio-help-dialog')?.open)window.closeStudioHelp?.();
 window.TikInteractStudioVisibility ||= Object.freeze({isVisible,openDefault});
 for(const key of Object.keys(visible)){
  const selectors=key==='guide'?'[data-sw-rail-help]':key==='website'?'.sw-rail-footer>a':`[data-studio-tab="${key}"],[data-studio-link="${key}"]`;
  for(const node of document.querySelectorAll(selectors)){
   node.toggleAttribute('data-studio-nav-hidden',!visible[key]);
   if(node.matches('.studio-app-rail [data-studio-tab],[data-sw-rail-help],.sw-rail-footer>a'))node.hidden=!visible[key];
  }
 }
 const empty=document.getElementById('studio-navigation-empty');
 const active=document.querySelector('.studio-app-nav [aria-selected=true]')?.dataset.studioTab;
 if(!active||!isVisible(active)){
  if(!openDefault()){
   for(const button of document.querySelectorAll('.studio-app-nav [data-studio-tab]')){
    button.classList.remove('is-active');button.setAttribute('aria-selected','false');document.getElementById(button.getAttribute('aria-controls'))?.classList.add('hidden');
   }
   if(empty)empty.hidden=false;
   document.getElementById('view-live')?.classList.remove('is-studio-mode');
   window.dispatchEvent(new CustomEvent('tikinteract:studio-tab',{detail:{tab:'unavailable'}}));
  }
 }
 if(empty){empty.hidden=main.some(isVisible);empty.querySelector('h2').textContent=t('Secțiunile Studio sunt momentan ascunse','Studio sections are currently hidden');empty.querySelector('p').textContent=t('Contul tău rămâne accesibil din fotografia de profil.','Your account is still available through your profile photo.');}
 if(!visible.guide&&window.TikInteractStudioWindows?.getView()==='help')window.TikInteractStudioWindows.close();
}
window.addEventListener('tikinteract:language',()=>{if(configured)applyStudioVisibility(window.TikInteractPlatform?.getConfig());});
