// A tour of the floating desktop. No game starts, LIVE connects or paid actions.
(()=>{
const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
let dialog,index=-1,steps=[],snapshot,token=0,target,observer,origin;
const desktop=()=>window.TikInteractWidgetDesktop;
const showPage=page=>desktop().open(page);
const definitions=[
 {target:'.studio-app-rail',title:['Meniul tău, unde îți este comod','Your menu, wherever you need it'],copy:['Trage meniul de mânerul cu puncte. Minus îl restrânge; săgeata îl deschide. Poziția se păstrează.','Drag the dotted handle to move the menu. Minimize it with the minus and expand with the arrow. Its position is remembered.']},
 {target:'#studio-dock-utilities',title:['Cont și preferințe, la îndemână','Your account and preferences'],copy:['Diamantul arată creditele AI. Aici găsești aspectul, limba, notificările și contul. Mânerul din dreapta mută întreaga bară.','The diamond shows your AI credits. Appearance, language, notifications and account live here. The right handle moves the entire bar.']},
 {target:'.studio-workspace-switch',title:['LIVE și AI, două spații în același Studio','LIVE and AI, together in Studio'],copy:['Schimbă instrumentele din meniu cu cele două iconițe. LIVE pregătește transmisia; AI îți oferă generatorul, universurile și biblioteca.','Use these two icons to switch the menu tools. LIVE prepares your stream; AI offers generation, universes and your library.']},
 {page:'games',target:'#game-center-panel>.studio-widget-title',title:['Alege jocul pentru LIVE','Choose your LIVE game'],copy:['Apasă o copertă pentru a deschide jocul în Transmisie. Se deschide și meniul în care alegi panourile. Steluța păstrează favoritele.','Open a cover to launch the game in Stream, together with the panel picker. Use the star to keep favorites.']},
 {page:'studio',target:'.studio-widget-config',title:['Pregătește-ți spațiul','Prepare your workspace'],copy:['Alege doar panourile de care ai nevoie. Verde înseamnă afișat, roșu înseamnă ascuns. Poți reveni oricând din Transmisie.','Choose only the panels you need. Green means visible; red means hidden. Open Stream to change your selection anytime.']},
 {page:'studio',panel:'preview',target:'.studio-stage>.sle-panel-tools',title:['Ferestre pe care le așezi tu','Arrange windows your way'],copy:['Trage antetul unui panou pentru a-l muta. Mânerul fin din colțul dreapta-jos îl redimensionează; X îl ascunde. Jocul rămâne pornit.','Drag a panel header to move it. Resize with the small bottom-right grip; X hides it. The active game keeps running.']},
 {page:'studio',layout:true,target:'#studio-layout-manager',title:['Aranjamentul tău se păstrează','Your layout is remembered'],copy:['Pozițiile și dimensiunile se salvează automat. Aici poți salva imediat sau alege un profil salvat. Fereastra aceasta se poate muta și ea.','Positions and sizes save automatically. Save immediately or choose a saved profile here. This window can also be moved.']},
 {page:'audio',target:'#audio-center-panel>.studio-widget-title',title:['Sunete pregătite pentru reacții','Audio ready for every moment'],copy:['Caută sunete, adaugă favorite și controlează monitorizarea locală din antet. Afișează Favorite audio în Transmisie pentru acces rapid.','Search sounds, add favorites and control local monitoring in the header. Show Favorite audio in Stream for quick access.']},
 {page:'animations',target:'#studio-animations-panel>.studio-widget-title',title:['Biblioteca animațiilor LIVE','Your LIVE animation library'],copy:['Animațiile salvate și regulile de evenimente sunt aici. Favoritele pot fi afișate într-un panou separat din Transmisie.','Saved animations and event rules live here. Show favorites in their own Stream panel.']},
 {page:'ai',target:'#studio-animations-panel>.studio-widget-title',title:['Creează în AI Studio','Create in AI Studio'],copy:['Generatorul are fotografie, univers, descriere și calitate. Creditele sunt pentru generări AI. Turul nu generează videoclipuri și nu consumă credite.','The generator has photo, universe, prompt and quality controls. Credits are for AI generations. This tour generates nothing and uses no credits.']}
];
function position(){
 if(!dialog?.open||!target)return;const r=target.getBoundingClientRect(),w=innerWidth,h=innerHeight;
 const left=Math.max(6,Math.min(w-6,r.left-6)),top=Math.max(6,Math.min(h-6,r.top-6)),right=Math.max(left,Math.min(w-6,r.right+6)),bottom=Math.max(top,Math.min(h-6,r.bottom+6));
 const box=(id,x,y,width,height)=>Object.assign(document.getElementById(id).style,{left:x+'px',top:y+'px',width:Math.max(0,width)+'px',height:Math.max(0,height)+'px'});
 box('studio-tour-shade-top',0,0,w,top);box('studio-tour-shade-left',0,top,left,bottom-top);box('studio-tour-shade-right',right,top,w-right,bottom-top);box('studio-tour-shade-bottom',0,bottom,w,h-bottom);box('studio-tour-highlight',left,top,right-left,bottom-top);
 const tip=document.getElementById('studio-tour-tooltip'),tw=tip.offsetWidth,th=tip.offsetHeight,gap=14;
 let x=right+gap,y=top;if(w-right<tw+gap+12){x=left-tw-gap;if(x<12){x=left+(right-left-tw)/2;y=h-bottom>th+gap?bottom+gap:top-th-gap;}}
 tip.style.left=Math.max(12,Math.min(w-tw-12,x))+'px';tip.style.top=Math.max(12,Math.min(h-th-12,y))+'px';
}
async function step(next){
 if(next<0)return;if(next>=steps.length){dialog.close();return;}index=next;const current=++token,s=steps[index];
 const nextButton=document.getElementById('studio-tour-next');nextButton.disabled=true;
 if(s.page)await showPage(s.page);if(current!==token||!dialog.open)return;
 if(s.panel){await desktop().choose(s.panel,true);document.querySelector('.studio-widget-config header button').click();}
 if(s.layout)desktop().openLayoutManager();
 target=document.querySelector(s.target);if(!target?.getClientRects().length){nextButton.disabled=false;if(index+1<steps.length)return step(index+1);dialog.close();return;}
 observer?.disconnect();observer=new ResizeObserver(position);observer.observe(target);
 document.getElementById('studio-tour-title').textContent=t(...s.title);document.getElementById('studio-tour-description').textContent=t(...s.copy);document.getElementById('studio-tour-progress').textContent=(index+1)+' / '+steps.length;
 document.getElementById('studio-tour-prev').disabled=index===0;document.getElementById('studio-tour-prev').textContent=t('Înapoi','Back');nextButton.textContent=index===steps.length-1?t('Am înțeles','Done'):t('Următorul →','Next →');nextButton.disabled=false;
 target.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});requestAnimationFrame(position);nextButton.focus({preventScroll:true});
}
async function finish(){
 if(!snapshot)return;++token;observer?.disconnect();const previous=snapshot;snapshot=null;target=null;index=-1;
 try{await desktop().restore(previous.desktop);window.TikInteractStudioPersonalization.restoreLayout(previous.layout);window.TikInteractFloatingDock.collapse(previous.collapsed);if(previous.account)await window.TikInteractStudioWindows.open(previous.account);}
 finally{delete document.documentElement.dataset.studioTourActive;window.TikInteractStudioPersonalization.restoreLayout(previous.layout);await desktop().restore(previous.desktop);window.scrollTo({top:previous.scroll,behavior:'instant'});if(origin?.isConnected)origin.focus({preventScroll:true});}
}
function start(){
 if(dialog.open||snapshot||window.TikInteractStudioVisibility?.isVisible('guide')===false)return;
 origin=document.activeElement;snapshot={desktop:desktop().snapshot(),layout:window.TikInteractStudioPersonalization.getLayout(),collapsed:window.TikInteractFloatingDock.get().collapsed,account:document.getElementById('studio-user-dialog')?.open?window.TikInteractStudioWindows?.getView():null,scroll:scrollY};
 document.documentElement.dataset.studioTourActive='true';window.TikInteractFloatingDock.collapse(false);document.documentElement.dataset.dockMenu='live';
 if(document.getElementById('studio-dock-utilities').dataset.utilitiesCollapsed==='true')document.querySelector('[data-utilities-collapse]').click();
 steps=definitions.filter(s=>!s.page||window.TikInteractStudioVisibility?.isVisible(s.page==='ai'?'animations':s.page)!==false);dialog.showModal();step(0);
}
function init(){
 dialog=document.getElementById('studio-help-dialog');if(!dialog)return;dialog.dataset.nativeI18n='';
 document.getElementById('studio-tour-prev').onclick=()=>step(index-1);document.getElementById('studio-tour-next').onclick=()=>step(index+1);dialog.querySelector('.studio-help-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target.hasAttribute('data-tour-advance')){e.stopImmediatePropagation();step(index+1);}},{capture:true});dialog.addEventListener('close',finish);
 window.addEventListener('resize',position);window.addEventListener('scroll',position,{capture:true,passive:true});
 window.openStudioHelp=start;window.closeStudioHelp=()=>dialog.close();window.TikInteractStudioTour=Object.freeze({start,close:()=>dialog.close(),get:()=>({index,total:steps.length,target:target?.getAttribute('id')||target?.className,open:dialog.open})});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
