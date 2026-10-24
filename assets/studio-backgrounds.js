/* Studio-only wallpaper preferences. No backend, game, overlay or public-site changes. */
(()=>{
 const root=document.documentElement;
 const base=new URL('./studio-backgrounds/',document.currentScript.src);
 const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
 const workspace=()=>root.dataset.dockMenu==='ai'?'ai':'live';
 const key=m=>'tikinteract_studio_background_v1_'+m;
 const choices=[
  {id:'neutral',ro:'Implicit',en:'Default',kind:'minimal'},
  {id:'navy',ro:'Bleumarin',en:'Navy',kind:'minimal'},
  {id:'plum',ro:'Prună',en:'Plum',kind:'minimal'},
  {id:'sage',ro:'Salvie',en:'Sage',kind:'minimal'},
  {id:'soft-graphite',ro:'Grafit',en:'Graphite',kind:'metallic'},
  {id:'metal-silver',ro:'Argintiu',en:'Silver',kind:'metallic'},
  {id:'soft-blue',ro:'Oțel albastru',en:'Blue steel',kind:'metallic'},
  {id:'soft-mint',ro:'Titan',en:'Titanium',kind:'metallic'},
  {id:'arcade-hub',ro:'Hub arcade',en:'Arcade hub',kind:'landscape',themed:true},
  {id:'crystal-world',ro:'Univers de cristal',en:'Crystal universe',kind:'landscape',themed:true},
  {id:'cosmic-orbit',ro:'Orbită cosmică',en:'Cosmic orbit',kind:'landscape',themed:true},
  {id:'stardust',ro:'Praf de stele',en:'Stardust',kind:'landscape',themed:true}
 ];
 const canonical=id=>({'moonlit-lake':'arcade-hub','alpine-valley':'crystal-world','neon-city':'arcade-hub','floating-islands':'crystal-world','ruby-arena':'stardust'}[id]||id);
 const valid=id=>choices.some(c=>c.id===id)||id==='color';
 const hex=value=>/^#[0-9a-f]{6}$/i.test(value||'');
 const read=m=>{try{const value=JSON.parse(localStorage.getItem(key(m))),id=canonical(value?.id);if(value&&valid(id))return{id,color:hex(value.color)?value.color:'#202229'};}catch{}return{id:'neutral',color:'#202229'};};
 const saved={live:read('live'),ai:read('ai')};
 const imageURL=(choice,thumbnail=false)=>new URL(choice.id+(choice.themed?'-'+(root.dataset.mode==='light'?'light':'dark'):'')+(thumbnail?'-thumb':'')+'.webp',base).href;
 function apply(){
  const state=saved[workspace()],choice=choices.find(c=>c.id===state.id);
  root.dataset.studioBackground=state.id;
  root.dataset.studioBackgroundKind=choice?.kind||'color';
  root.dataset.studioBackgroundPaired=String(!!choice?.themed);
  root.style.setProperty('--studio-custom-background',state.color);
  if(choice?.kind==='landscape')root.style.setProperty('--studio-wallpaper-image',`url("${imageURL(choice)}")`);
  else root.style.removeProperty('--studio-wallpaper-image');
 }
 const check='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
 function card(c,state){return `<button type="button" data-studio-background="${c.id}" aria-pressed="${state.id===c.id}"><span class="sd-background-preview" data-background-preview="${c.id}">${c.kind==='landscape'?`<img src="${imageURL(c,true)}"${c.themed?' data-background-paired':''} width="360" height="203" loading="lazy" decoding="async" alt="">`:''}${check}</span><span>${t(c.ro,c.en)}</span></button>`;}
 function render(panel=document.querySelector('[data-design-palette-panel]')){
  if(!panel)return;
  panel.querySelector('[data-studio-appearance-backgrounds]')?.remove();
  const section=document.createElement('div');section.dataset.studioAppearanceBackgrounds='';
  const state=saved[workspace()];
  section.innerHTML=`<fieldset class="sd-appearance-section"><legend>${t('Temă','Theme')}</legend><div class="sd-appearance-themes"><button type="button" data-studio-appearance-mode="light" aria-pressed="${root.dataset.mode==='light'}"><i class="fa-regular fa-sun" aria-hidden="true"></i>${t('Luminos','Light')}</button><button type="button" data-studio-appearance-mode="dark" aria-pressed="${root.dataset.mode!=='light'}"><i class="fa-regular fa-moon" aria-hidden="true"></i>${t('Întunecat','Dark')}</button></div></fieldset><fieldset class="sd-appearance-section"><legend>${t('Fundal','Background')}</legend><p>${t('Colorat','Colorful')}</p><div class="sd-background-options">${choices.filter(c=>c.kind==='minimal').map(c=>card(c,state)).join('')}</div><div class="sd-custom-color"><label for="studio-background-color">${t('Culoarea ta','Your color')}</label><input type="color" id="studio-background-color" value="${state.color}"><button type="button" data-studio-custom-color aria-pressed="${state.id==='color'}">${t('Aplică','Apply')}</button></div><p>${t('Peisaje ilustrate','Illustrated landscapes')}</p><div class="sd-background-options sd-background-landscapes">${choices.filter(c=>c.kind==='landscape').map(c=>card(c,state)).join('')}</div></fieldset>`;
  const metallic=document.createElement('div');metallic.className='sd-background-metallic';
  const title=document.createElement('p');title.textContent=t('Metalic','Metallic');
  metallic.innerHTML=`<div class="sd-background-options">${choices.filter(c=>c.kind==='metallic').map(c=>card(c,state)).join('')}</div>`;metallic.prepend(title);
  section.querySelector('.sd-custom-color').after(metallic);
  const heading=panel.querySelector('.sd-palette-heading');if(heading)heading.after(section);else panel.prepend(section);
 }
 function save(){try{localStorage.setItem(key(workspace()),JSON.stringify(saved[workspace()]));}catch{}apply();render();window.dispatchEvent(new CustomEvent('tikinteract:studio-background'));}
 const api={
  get:(m=workspace())=>({...saved[m==='ai'?'ai':'live']}),
  options:()=>choices.map(c=>({...c})),
  set(id,m=workspace()){id=canonical(id);if(!['live','ai'].includes(m)||!valid(id))return false;saved[m].id=id;try{localStorage.setItem(key(m),JSON.stringify(saved[m]));}catch{}apply();render();window.dispatchEvent(new CustomEvent('tikinteract:studio-background'));return true;},
  setColor(color){if(!hex(color))return false;saved[workspace()]={id:'color',color};save();return true;},
  render
 };
 window.TikInteractStudioBackgrounds=Object.freeze(api);apply();
 function init(){
  render();
  document.querySelector('[data-design-palette-panel]')?.addEventListener('click',e=>{
   const button=e.target.closest('button[data-studio-background]');
   if(button){api.set(button.dataset.studioBackground);document.querySelector(`button[data-studio-background="${button.dataset.studioBackground}"]`)?.focus({preventScroll:true});return;}
   const theme=e.target.closest('[data-studio-appearance-mode]');if(theme){window.TikInteractAppearance?.set({mode:theme.dataset.studioAppearanceMode});document.querySelector(`[data-studio-appearance-mode="${theme.dataset.studioAppearanceMode}"]`)?.focus({preventScroll:true});return;}
   if(e.target.closest('[data-studio-custom-color]')){api.setColor(document.getElementById('studio-background-color').value);document.querySelector('[data-studio-custom-color]')?.focus({preventScroll:true});}
  });
  new MutationObserver(()=>{apply();render();}).observe(root,{attributes:true,attributeFilter:['data-dock-menu','data-mode']});
  window.addEventListener('tikinteract:appearance',()=>{apply();render();});
  window.addEventListener('storage',event=>{const m=['live','ai'].find(m=>key(m)===event.key);if(m){saved[m]=read(m);apply();render();}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
