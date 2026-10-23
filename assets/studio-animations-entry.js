import './animations-live-bridge.js?v=2';
let modulePromise;
export async function openAnimations({mode=window.TikInteractWorkspaces?.getMode()||'live',...options}={}){
 if(window.TikInteractStudioVisibility?.isVisible('animations')===false)return;
 const root=document.getElementById('studio-animations-panel');
 try{
  modulePromise ||= import('./studio-animations-live.js?v=4');
  const module=await modulePromise;await module.mountAnimations(root);if(mode===(window.TikInteractWorkspaces?.getMode()||'live'))module.setAnimationWorkspace(mode,options);
 }catch{modulePromise=null;root.textContent=window.TikInteractLanguage?.get()==='en'?'Animations could not load. Try again.':'Animațiile nu s-au putut încărca. Încearcă din nou.';}
}
export async function openAnimationCredits(){
 const root=document.getElementById('studio-animations-panel');
 modulePromise ||= import('./studio-animations-live.js?v=4');
 const module=await modulePromise;await module.mountAnimations(root);module.showAnimationCredits();
}
window.addEventListener('tikinteract:studio-tab',event=>{if(event.detail.tab==='animations')openAnimations();});
if(new URLSearchParams(location.search).has('animations'))window.addEventListener('tikinteract:ui-ready',()=>{window.setLiveStudioTab?.('animations');},{once:true});
