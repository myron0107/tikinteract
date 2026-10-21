/* Appearance only: the original dark styles remain the default. */
(()=>{
 const key='tikinteract_mode',brandKey='tikinteract_brand';let mode='dark',brand='burgundy';
 try{if(localStorage.getItem(key)==='light')mode='light';}catch{}
 try{if(localStorage.getItem(brandKey)==='blue')brand='blue';}catch{}
 const en=()=>window.TikInteractLanguage?.get()==='en';
 const studio=()=>document.documentElement.dataset.paletteScope==='studio'||document.body?.dataset.page==='studio';
 const theme=()=>studio()?brand:'burgundy';
 function render(){
  document.documentElement.dataset.mode=mode;document.documentElement.classList.toggle('dark',mode==='dark');
  document.documentElement.dataset.theme=theme();
  if(document.body){document.body.dataset.mode=mode;document.body.dataset.theme=theme();}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',mode==='light'?'#FFFFFF':'#101014');
  document.querySelectorAll('[data-mode-toggle]').forEach(button=>{const label=en()?(mode==='light'?'Switch to dark mode':'Switch to light mode'):(mode==='light'?'Activează modul întunecat':'Activează modul luminos');button.setAttribute('aria-pressed',String(mode==='light'));button.setAttribute('aria-label',label);button.title=label;button.innerHTML='<i class="fa-solid fa-'+(mode==='light'?'sun':'moon')+'" aria-hidden="true"></i>';});
  document.querySelectorAll('[data-studio-theme]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.studioTheme===theme()));});
 }
 function set(next){const change=typeof next==='string'?{mode:next}:next||{};if(['light','dark'].includes(change.mode)){mode=change.mode;try{localStorage.setItem(key,mode);}catch{}}if(studio()&&['burgundy','blue'].includes(change.theme)){brand=change.theme;try{localStorage.setItem(brandKey,brand);}catch{}}render();window.dispatchEvent(new CustomEvent('tikinteract:appearance',{detail:{mode,theme:theme()}}));}
 window.TikInteractAppearance=Object.freeze({get:()=>({mode,theme:theme()}),set,refresh:render});
 window.showHowItWorks=()=>{window.switchView?.('home');document.querySelector('[data-nav-item="how"]')?.classList.add('is-active');requestAnimationFrame(()=>document.getElementById('how-it-works')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}));};
 render();
 function init(){
  const actions=document.querySelector('.header-account-actions');
  if(actions&&!actions.querySelector('[data-mode-toggle]')){const button=document.createElement('button');button.type='button';button.className='appearance-toggle';button.dataset.modeToggle='';button.setAttribute('translate','no');actions.prepend(button);}
  const toggle=actions?.querySelector('[data-mode-toggle]'),language=actions?.querySelector('.language-picker');
  if(toggle&&language){actions.prepend(language);language.after(toggle);}
  if(studio()&&actions&&!actions.querySelector('.studio-palettes')){const group=document.createElement('div');group.className='studio-palettes';group.setAttribute('role','group');group.setAttribute('aria-label','Burgundy / Racing Blue');group.innerHTML='<button type="button" data-studio-theme="burgundy" aria-label="Burgundy" title="Burgundy"></button><button type="button" data-studio-theme="blue" aria-label="Racing Blue" title="Racing Blue"></button>';actions.prepend(group);}
  const palettes=actions?.querySelector('.studio-palettes');if(studio()&&language)actions.append(language);
  const bell=actions?.querySelector('#creator-inbox-bell');if(toggle&&bell)toggle.after(bell.closest('.studio-notifications')||bell);
  render();
 }
 document.addEventListener('click',event=>{if(event.target.closest('[data-mode-toggle]'))set(mode==='dark'?'light':'dark');const palette=event.target.closest('[data-studio-theme]');if(palette)set({theme:palette.dataset.studioTheme});});
 window.addEventListener('storage',event=>{if(event.key===key&&['light','dark'].includes(event.newValue)){mode=event.newValue;render();}if(event.key===brandKey&&studio()&&['burgundy','blue'].includes(event.newValue)){brand=event.newValue;render();}});
 window.addEventListener('tikinteract:language',render);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
