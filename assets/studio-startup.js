// Studio boot only: a complete shell is revealed after real readiness milestones.
(()=>{
 const root=document.documentElement,read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 const query=new URLSearchParams(location.search),requested=query.get('lang');
 const language=['ro','en'].includes(requested)?requested:read('tikinteract_language')==='ro'?'ro':'en';
 const mode=read('tikinteract_mode')==='light'?'light':'dark',theme=read('tikinteract_brand')==='blue'?'blue':'burgundy';
 root.lang=language;root.dataset.mode=mode;root.dataset.theme=theme;root.dataset.workspace=query.get('workspace')==='ai'?'ai':'live';root.classList.toggle('dark',mode==='dark');
 root.dataset.uiPending='';root.setAttribute('aria-busy','true');
 const required=['language','layout','auth','navigation','workspace','user-layout','desktop','dock','appearance'],finished=new Set();
 let revealed=false,preparing=false;
 function progress(){root.style.setProperty('--studio-boot-progress',(required.filter(part=>finished.has(part)).length/required.length*100)+'%');}
 function reveal(reason){if(revealed)return;revealed=true;clearTimeout(fallback);root.style.setProperty('--studio-boot-progress','100%');root.dataset.uiRevealing='';delete root.dataset.uiPending;root.removeAttribute('aria-busy');root.dataset.uiReady=reason;window.dispatchEvent(new CustomEvent('tikinteract:ui-ready',{detail:{reason}}));setTimeout(()=>delete root.dataset.uiRevealing,180);}
 function check(){
  if(revealed||preparing||!required.every(part=>finished.has(part))||(window.tikInteractUser&&!window.TikInteractAccount?.getStatus()))return;
  preparing=true;Promise.race([document.fonts?.ready,new Promise(resolve=>setTimeout(resolve,1000))]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>reveal('ready'))));
 }
 const fallback=setTimeout(()=>reveal('fallback'),8000);
 window.TikInteractStartup=Object.freeze({language,mode,theme,ready(part){finished.add(part);progress();check();}});
 window.addEventListener('tikinteract:account-status',check);
 window.addEventListener('pageshow',event=>{if(event.persisted)reveal('restored');});
})();
