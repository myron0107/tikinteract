import './animations-live-bridge.js?v=1';
// Lazy-load the panel; event forwarding remains active independently.
let modulePromise;
window.addEventListener('tikinteract:studio-tab',event=>{
    if(event.detail.tab!=='animations'||window.TikInteractStudioVisibility?.isVisible('animations')===false)return;
    const root=document.getElementById('studio-animations-panel');
    modulePromise ||= import('./studio-animations-live.js?v=1');
    modulePromise.then(module=>module.mountAnimations(root)).catch(()=>{
        modulePromise=null;
        root.textContent=window.TikInteractLanguage?.get()==='en'?'Animations could not load. Choose another section and try again.':'Animațiile nu s-au putut încărca. Alege altă secțiune și încearcă din nou.';
    });
});
if(new URLSearchParams(location.search).has('animations'))window.addEventListener('tikinteract:ui-ready',()=>{window.setLiveStudioTab?.('animations');},{once:true});
