// Load this isolated DEMO only when the user chooses ANIMATIONS in Studio.
let modulePromise;
window.addEventListener('tikinteract:studio-tab',event=>{
    if(event.detail.tab!=='animations'||window.TikInteractStudioVisibility?.isVisible('animations')===false)return;
    const root=document.getElementById('studio-animations-panel');
    modulePromise ||= import('./studio-animations.js?v=1');
    modulePromise.then(module=>module.mountAnimations(root)).catch(()=>{
        modulePromise=null;
        root.textContent=window.TikInteractLanguage?.get()==='en'?'The DEMO could not load. Choose another section and try again.':'DEMO nu s-a putut încărca. Alege altă secțiune și încearcă din nou.';
    });
});
