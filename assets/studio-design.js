/* Studio presentation only. Account, transport, media, games and billing remain owned by their existing modules. */
(()=>{
 const root=document.documentElement;
 const skins={live:[['ice','Glacier', '#b6d7ff','#72b1ff'],['signal','Crimson', '#f27a91','#f2aa8a'],['racing','Electric','#85abff','#c8a2ff']],ai:[['lumen','Lumen','#f3ca91','#ed9ba8'],['orbit','Iris','#c0a5ff','#e5a2dd'],['aurora','Lagoon','#7bdcdb','#a3bfff']]};
 const extraSkins=[['ocean','Ocean','#83c6f3','#8fa7d9'],['mint','Mint','#7fd9b3','#9bd7d1'],['amethyst','Amethyst','#b9a0ee','#d8a8d9'],['rosewood','Rosewood','#df9fb5','#b9a7d7'],['sage','Sage','#b5c893','#9fc8bb'],['steel','Steel','#a8bfd5','#b9c3d1'],['graphite','Graphite','#bfc4ce','#9aa4b6'],['midnight','Midnight','#a1aedb','#9dbccf']];
 skins.live.push(...extraSkins);skins.ai.push(...extraSkins);
 const defaults={live:'ice',ai:'lumen'};
 const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 const mode=()=>root.dataset.dockMenu?root.dataset.dockMenu==='ai'?'ai':'live':root.dataset.workspace==='ai'?'ai':'live';
 const key=m=>'tikinteract_studio_skin_v2_'+m;
 const saved={live:read(key('live')),ai:read(key('ai'))};
 const enabledKey=m=>'tikinteract_studio_palette_enabled_'+m;
 const enabled={live:read(enabledKey('live'))!=='false',ai:read(enabledKey('ai'))!=='false'};
 const selected=m=>skins[m].some(s=>s[0]===saved[m])?saved[m]:defaults[m];
 const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
 let tab='home',dock='games';
 const copy={'dock-games':['Jocuri','Games'],'dock-audio':['Sunete','Sounds'],'dock-animations':['Animații','Animations'],'dock-hint':['BIBLIOTECA RAPIDĂ','QUICK LIBRARY'],'scene-label':['SCENA TA LIVE','YOUR LIVE STAGE'],'scene-title':['Fă loc unui LIVE diferit.','Make room for a different LIVE.'],'scene-description':['Alege un joc și transformă reacțiile publicului în acțiune.','Choose a game and turn your audience’s reactions into action.'],'scene-start':['Adaugă un joc în scenă','Add a game to your stage'],'game-free':['GRATUIT','FREE'],'sounds-all':['Toate sunetele','All sounds'],'sounds-effects':['Efecte și reacții','Effects and reactions'],'sounds-music':['Muzică','Music']};
 copy['nav-home']=['Acasă','Home'];
 const pages={home:['Acasă','Home','',''],studio:['Transmisie','Stream','Tot ce ai nevoie pentru următorul LIVE.','Everything you need for your next LIVE.'],games:['Jocurile tale. Publicul tău.','Your games. Your audience.','Alege jocul. Restul se întâmplă în LIVE.','Choose a game. Let your LIVE do the rest.'],audio:['Dă tonul LIVE-ului.','Set the tone of your LIVE.','Reacții, efecte și momente care se aud.','Reactions, effects and moments worth hearing.'],animations:['Animații','Animations','','']};
 function applySkin(){root.dataset.studioSkin=selected(mode());root.dataset.studioPalette=enabled[mode()]?'on':'off';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',root.dataset.mode==='light'?'#f6f7fa':'#0b0f16');}
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
  if(palette){palette.innerHTML=`<div class="sd-palette-heading"><strong>${t('Aspectul studioului','Studio appearance')}</strong><span>${current==='ai'?'AI Studio':'LIVE Studio'}</span></div><p class="sd-interface-label">${t('Paleta interfeței','Interface palette')}</p><button type="button" class="sd-palette-neutral" data-design-palette-enabled role="switch" aria-checked="${!enabled[current]}"><span>${t('Fără paletă','No palette')}<small>${t('Interfață neutră, fundalul rămâne vizibil.','Neutral interface, your background stays visible.')}</small></span><i aria-hidden="true"></i></button><div class="sd-palette-options">${skins[current].map(([id,name,a,b])=>`<button type="button" data-design-skin="${id}" aria-pressed="${enabled[current]&&selected(current)===id}" style="--swatch-a:${a};--swatch-b:${b}"><span class="sd-palette-preview"><i></i><i></i><i></i></span><span>${name}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>`).join('')}</div><p>${t('Fundalul și paleta se salvează separat pentru LIVE și AI.','Background and palette are saved separately for LIVE and AI.')}</p>`;}
  window.TikInteractStudioBackgrounds?.render(palette);
 }
 window.TikInteractStudioDesign=Object.freeze({get:(workspace=mode())=>({workspace,skin:selected(workspace==='ai'?'ai':'live'),enabled:enabled[workspace==='ai'?'ai':'live']}),palettes:workspace=>skins[workspace==='ai'?'ai':'live'].map(([id,label,color,secondary])=>({id,label,color,secondary})),setPaletteEnabled(value,workspace=mode()){if(!['live','ai'].includes(workspace))return;enabled[workspace]=Boolean(value);try{localStorage.setItem(enabledKey(workspace),String(enabled[workspace]));}catch{}paint();window.dispatchEvent(new CustomEvent('tikinteract:studio-appearance'));},setSkin(id,workspace=mode()){if(!['live','ai'].includes(workspace)||!skins[workspace].some(s=>s[0]===id))return;saved[workspace]=id;enabled[workspace]=true;try{localStorage.setItem(key(workspace),id);localStorage.setItem(enabledKey(workspace),'true');}catch{}paint();window.dispatchEvent(new CustomEvent('tikinteract:studio-appearance'));}});
 applySkin();
 function init(){
  paint();window.TikInteractStartup?.ready('appearance');
  document.querySelector('.studio-dock-heading')?.addEventListener('click',e=>{const b=e.target.closest('[data-design-dock]');if(b){dock=b.dataset.designDock;paint();}});
  document.querySelector('.studio-sound-categories')?.addEventListener('click',e=>{const b=e.target.closest('[data-design-audio-category]');if(!b)return;const select=document.getElementById('audio-sound-category');select.value=b.dataset.designAudioCategory;select.dispatchEvent(new Event('change',{bubbles:true}));for(const n of document.querySelectorAll('[data-design-audio-category]'))n.setAttribute('aria-pressed',String(n===b));});
  document.querySelector('[data-design-palette-toggle]')?.addEventListener('click',()=>{const panel=document.querySelector('[data-design-palette-panel]');if(!panel)return;const show=panel.hidden;paint();panel.hidden=!show;document.querySelector('[data-design-palette-toggle]').setAttribute('aria-expanded',String(show));if(show)panel.querySelector('[data-studio-appearance-mode][aria-pressed=true]')?.focus({preventScroll:true});});
  document.querySelector('[data-design-palette-panel]')?.addEventListener('click',e=>{if(e.target.closest('[data-design-palette-enabled]')){window.TikInteractStudioDesign.setPaletteEnabled(!enabled[mode()]);document.querySelector('[data-design-palette-enabled]')?.focus({preventScroll:true});return;}const b=e.target.closest('[data-design-skin]');if(b){window.TikInteractStudioDesign.setSkin(b.dataset.designSkin);document.querySelector(`[data-design-skin="${b.dataset.designSkin}"]`)?.focus({preventScroll:true});}});
  document.addEventListener('click',e=>{if(!e.composedPath().some(node=>node instanceof Element&&node.matches('.studio-palettes')))closePalette();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('[data-design-palette-panel]')?.hidden){e.preventDefault();closePalette(true);}});
  let workspace=mode(),aiTab='';
  new MutationObserver(()=>{const next=mode();if(workspace===next)return;workspace=next;paint();closePalette();}).observe(root,{attributes:true,attributeFilter:['data-workspace','data-dock-menu']});
  window.addEventListener('tikinteract:studio-tab',e=>{if(!pages[e.detail.tab])return;const changed=tab!==e.detail.tab;tab=e.detail.tab;paint();if(changed)window.scrollTo({top:0,behavior:'instant'});});
  window.addEventListener('tikinteract:animation-view',e=>{if(e.detail.tab!==aiTab){aiTab=e.detail.tab;window.scrollTo({top:0,behavior:'instant'});}});
  window.addEventListener('tikinteract:language',paint);
  window.addEventListener('tikinteract:appearance',applySkin);
  window.addEventListener('storage',e=>{const workspace=['live','ai'].find(m=>key(m)===e.key);if(workspace){saved[workspace]=e.newValue;paint();}const enabledWorkspace=['live','ai'].find(m=>enabledKey(m)===e.key);if(enabledWorkspace){enabled[enabledWorkspace]=e.newValue!=='false';paint();}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
