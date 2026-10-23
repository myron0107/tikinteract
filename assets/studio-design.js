/* Studio presentation only. Account, transport, media, games and billing remain owned by their existing modules. */
(()=>{
 const root=document.documentElement;
 const skins={live:[['ice','Glacier', '#b6d7ff','#72b1ff'],['signal','Crimson', '#f27a91','#f2aa8a'],['racing','Electric','#85abff','#c8a2ff']],ai:[['lumen','Lumen','#f3ca91','#ed9ba8'],['orbit','Iris','#c0a5ff','#e5a2dd'],['aurora','Lagoon','#7bdcdb','#a3bfff']]};
 const defaults={live:'ice',ai:'lumen'};
 const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 const mode=()=>root.dataset.dockMenu?root.dataset.dockMenu==='ai'?'ai':'live':root.dataset.workspace==='ai'?'ai':'live';
 const key=m=>'tikinteract_studio_skin_v2_'+m;
 const saved={live:read(key('live')),ai:read(key('ai'))};
 const selected=m=>skins[m].some(s=>s[0]===saved[m])?saved[m]:defaults[m];
 const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
 let tab='home',dock='games';
 const copy={'dock-games':['Jocuri','Games'],'dock-audio':['Sunete','Sounds'],'dock-animations':['Animații','Animations'],'dock-hint':['BIBLIOTECA RAPIDĂ','QUICK LIBRARY'],'scene-label':['SCENA TA LIVE','YOUR LIVE STAGE'],'scene-title':['Fă loc unui LIVE diferit.','Make room for a different LIVE.'],'scene-description':['Alege un joc și transformă reacțiile publicului în acțiune.','Choose a game and turn your audience’s reactions into action.'],'scene-start':['Adaugă un joc în scenă','Add a game to your stage'],'game-free':['GRATUIT','FREE'],'sounds-all':['Toate sunetele','All sounds'],'sounds-effects':['Efecte și reacții','Effects and reactions'],'sounds-music':['Muzică','Music']};
 copy['nav-home']=['Acasă','Home'];
 const pages={home:['Acasă','Home','',''],studio:['Transmisie','Stream','Tot ce ai nevoie pentru următorul LIVE.','Everything you need for your next LIVE.'],games:['Jocurile tale. Publicul tău.','Your games. Your audience.','Alege jocul. Restul se întâmplă în LIVE.','Choose a game. Let your LIVE do the rest.'],audio:['Dă tonul LIVE-ului.','Set the tone of your LIVE.','Reacții, efecte și momente care se aud.','Reactions, effects and moments worth hearing.'],animations:['Animații','Animations','','']};
 function applySkin(){root.dataset.studioSkin=selected(mode());document.querySelector('meta[name="theme-color"]')?.setAttribute('content',root.dataset.mode==='light'?'#f6f7fa':'#0b0f16');}
 function closePalette(focus=false){const panel=document.querySelector('[data-design-palette-panel]'),button=document.querySelector('[data-design-palette-toggle]');if(panel)panel.hidden=true;button?.setAttribute('aria-expanded','false');if(focus)button?.focus({preventScroll:true});}
 function paint(){
  applySkin();const current=mode(),item=pages[tab]||pages.studio;
  document.body.dataset.studioView=tab;
  root.dataset.studioDock=dock;
  for(const n of document.querySelectorAll('[data-design-copy]'))if(copy[n.dataset.designCopy])n.textContent=t(...copy[n.dataset.designCopy]);
  const home=document.getElementById('studio-home-tab');if(home){home.title=t('Acasă','Home');home.setAttribute('aria-label',home.title);}
  for(const b of document.querySelectorAll('[data-design-dock]'))b.setAttribute('aria-pressed',String(b.dataset.designDock===dock));
  const title=document.querySelector('[data-design-title]'),description=document.querySelector('[data-design-description]');
  if(title)title.textContent=t(item[0],item[1]);if(description)description.textContent=t(item[2],item[3]);
  const eyebrow=document.querySelector('[data-design-eyebrow]');if(eyebrow)eyebrow.textContent='LIVE STUDIO / '+t(...({studio:['TRANSMISIE','STREAM'],games:['JOCURI','GAMES'],audio:['PANOU DE SUNETE','SOUND PAD'],animations:['ANIMAȚII','ANIMATIONS']}[tab]||['STUDIO','STUDIO']));
  const caption=document.querySelector('[data-design-rail-caption]');if(caption)caption.textContent=current==='ai'?t('SPAȚIU DE CREAȚIE','CREATIVE SPACE'):t('SPAȚIU LIVE','LIVE WORKSPACE');
  const name=document.querySelector('[data-design-brand-caption]');if(name)name.textContent=current==='ai'?'AI STUDIO':'LIVE STUDIO';
  const toggle=document.querySelector('[data-design-palette-toggle]');if(toggle){toggle.title=t('Aspectul studioului','Studio appearance');toggle.setAttribute('aria-label',toggle.title);}
  const palette=document.querySelector('[data-design-palette-panel]');
  if(palette){palette.innerHTML=`<div class="sd-palette-heading"><strong>${t('Alege atmosfera','Choose your atmosphere')}</strong><span>${current==='ai'?'AI Studio':'LIVE Studio'}</span></div><div class="sd-palette-options">${skins[current].map(([id,name,a,b])=>`<button type="button" data-design-skin="${id}" aria-pressed="${selected(current)===id}" style="--swatch-a:${a};--swatch-b:${b}"><span class="sd-palette-preview"><i></i><i></i><i></i></span><span>${name}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>`).join('')}</div><p>${t('Palete separate pentru LIVE și AI. Modul luminos se schimbă din butonul cu soare.','Separate palettes for LIVE and AI. Switch light mode with the sun button.')}</p>`;}
 }
 window.TikInteractStudioDesign=Object.freeze({get:(workspace=mode())=>({workspace,skin:selected(workspace==='ai'?'ai':'live')}),palettes:workspace=>skins[workspace==='ai'?'ai':'live'].map(([id,label,color,secondary])=>({id,label,color,secondary})),setSkin(id,workspace=mode()){if(!['live','ai'].includes(workspace)||!skins[workspace].some(s=>s[0]===id))return;saved[workspace]=id;try{localStorage.setItem(key(workspace),id);}catch{}paint();window.dispatchEvent(new CustomEvent('tikinteract:studio-appearance'));}});
 applySkin();
 function init(){
  paint();
  document.querySelector('.studio-dock-heading')?.addEventListener('click',e=>{const b=e.target.closest('[data-design-dock]');if(b){dock=b.dataset.designDock;paint();}});
  document.querySelector('.studio-sound-categories')?.addEventListener('click',e=>{const b=e.target.closest('[data-design-audio-category]');if(!b)return;const select=document.getElementById('audio-sound-category');select.value=b.dataset.designAudioCategory;select.dispatchEvent(new Event('change',{bubbles:true}));for(const n of document.querySelectorAll('[data-design-audio-category]'))n.setAttribute('aria-pressed',String(n===b));});
  document.querySelector('[data-design-palette-toggle]')?.addEventListener('click',()=>{const panel=document.querySelector('[data-design-palette-panel]');if(!panel)return;const show=panel.hidden;paint();panel.hidden=!show;document.querySelector('[data-design-palette-toggle]').setAttribute('aria-expanded',String(show));if(show)panel.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});});
  document.querySelector('[data-design-palette-panel]')?.addEventListener('click',e=>{const b=e.target.closest('[data-design-skin]');if(b){window.TikInteractStudioDesign.setSkin(b.dataset.designSkin);document.querySelector(`[data-design-skin="${b.dataset.designSkin}"]`)?.focus({preventScroll:true});}});
  document.addEventListener('click',e=>{if(!e.composedPath().some(node=>node instanceof Element&&node.matches('.studio-palettes')))closePalette();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('[data-design-palette-panel]')?.hidden){e.preventDefault();closePalette(true);}});
  let workspace=mode(),aiTab='';
  new MutationObserver(()=>{const next=mode();if(workspace===next)return;workspace=next;paint();closePalette();}).observe(root,{attributes:true,attributeFilter:['data-workspace','data-dock-menu']});
  window.addEventListener('tikinteract:studio-tab',e=>{if(!pages[e.detail.tab])return;const changed=tab!==e.detail.tab;tab=e.detail.tab;paint();if(changed)window.scrollTo({top:0,behavior:'instant'});});
  window.addEventListener('tikinteract:animation-view',e=>{if(e.detail.tab!==aiTab){aiTab=e.detail.tab;window.scrollTo({top:0,behavior:'instant'});}});
  window.addEventListener('tikinteract:language',paint);
  window.addEventListener('tikinteract:appearance',applySkin);
  window.addEventListener('storage',e=>{const workspace=['live','ai'].find(m=>key(m)===e.key);if(workspace){saved[workspace]=e.newValue;paint();}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
