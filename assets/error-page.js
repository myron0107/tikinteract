import './language.js?v=8';
const copy={
 title:['Pagina nu a fost găsită — TikInteract','Page not found — TikInteract'],
 eyebrow:['EROARE 404','ERROR 404'],heading:['Pagina nu a fost găsită.','Page not found.'],
 description:['Pagina pe care o cauți nu există sau nu mai este disponibilă.','The page you are looking for does not exist or is no longer available.'],
 home:['Înapoi acasă','Back to home'],games:['Vezi jocurile','Explore games'],rights:['Toate drepturile rezervate.','All rights reserved.'],
 brand:['TikInteract / Acasă','TikInteract / Home'],navigation:['Continuă pe TikInteract','Continue on TikInteract']
};
function render(){
 const en=window.TikInteractLanguage?.get()==='en',t=key=>copy[key][en?1:0];
 document.title=t('title');
 document.querySelectorAll('[data-error-copy]').forEach(el=>{el.textContent=t(el.dataset.errorCopy);});
 document.querySelectorAll('[data-error-label]').forEach(el=>{el.setAttribute('aria-label',t(el.dataset.errorLabel));});
 const button=document.querySelector('[data-error-mode]'),light=window.TikInteractAppearance.get().mode==='light';
 const label=en?(light?'Switch to dark mode':'Switch to light mode'):(light?'Activează modul întunecat':'Activează modul luminos');
 button.setAttribute('aria-label',label);button.title=label;
 button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">'+(light?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>':'<path d="M20.8 13.1A8.8 8.8 0 0 1 10.9 3.2a9 9 0 1 0 9.9 9.9Z"/>')+'</svg>';
}
document.querySelector('[data-error-year]').textContent=String(new Date().getFullYear());
document.querySelector('[data-error-mode]').addEventListener('click',()=>window.TikInteractAppearance.set(window.TikInteractAppearance.get().mode==='light'?'dark':'light'));
window.addEventListener('tikinteract:language',render);window.addEventListener('tikinteract:appearance',render);render();
