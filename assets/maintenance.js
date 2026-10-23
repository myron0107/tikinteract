const pairs={
 title:['Mentenanță — TikInteract','Maintenance — TikInteract'],eyebrow:['REVENIM ÎN CURÂND','WE WILL BE BACK SOON'],heading:['Site în mentenanță','Site under maintenance'],
 intro:['Lucrăm la câteva îmbunătățiri. Ai o invitație? Folosește codul pentru a previzualiza platforma și Studio.','We are making a few improvements. Have an invitation? Use your code to preview the platform and Studio.'],
 codeLabel:['Codul tău de invitație','Your invitation code'],activate:['Activează invitația','Activate invitation'],hint:['Cod de unică folosință. Acces temporar, fără înregistrare.','Single-use code. Temporary access, no registration required.'],
 continue:['Continuă pe platformă','Continue to platform'],owner:['Acces proprietar','Owner access'],email:['E-mail','Email'],password:['Parolă','Password'],signIn:['Intră în cont','Sign in'],google:['Continuă cu Google','Continue with Google'],
 checking:['Verificăm accesul…','Checking access…'],ready:['Accesul tău este activ.','Your access is active.'],
 INVALID_INVITE:['Invitația este invalidă, expirată sau a fost deja folosită.','This invitation is invalid, expired or has already been used.'],RATE_LIMIT:['Prea multe încercări. Așteaptă un minut și încearcă din nou.','Too many attempts. Wait a minute and try again.'],OWNER_REQUIRED:['Acest cont nu are acces de proprietar.','This account does not have owner access.'],SETUP_REQUIRED:['Accesul de previzualizare nu este încă pregătit. Revino în curând.','Preview access is not ready yet. Please come back soon.'],SERVICE_UNAVAILABLE:['Accesul nu poate fi verificat acum. Încearcă din nou.','Access cannot be verified right now. Please try again.'],AUTH_ERROR:['Autentificarea nu a reușit. Verifică datele contului.','Sign-in failed. Check your account details.']
};
let language='en',client,busy=false,message='',messageError=false;
try{language=localStorage.getItem('tikinteract_language')==='ro'?'ro':'en';}catch{}
const t=key=>(pairs[key]||pairs.SERVICE_UNAVAILABLE)[language==='en'?1:0];
function render(){
 document.documentElement.lang=language;document.title=t('title');document.querySelectorAll('[data-copy]').forEach(el=>el.textContent=t(el.dataset.copy));
 document.querySelectorAll('[data-locale]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.locale===language)));
 const light=window.TikInteractAppearance.get().mode==='light',button=document.querySelector('[data-maintenance-mode]');
 const label=language==='en'?(light?'Switch to dark mode':'Switch to light mode'):(light?'Activează modul întunecat':'Activează modul luminos');button.title=label;button.setAttribute('aria-label',label);
 button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">'+(light?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>':'<path d="M20.8 13.1A8.8 8.8 0 0 1 10.9 3.2a9 9 0 1 0 9.9 9.9Z"/>')+'</svg>';
 const status=document.getElementById('maintenance-status');status.textContent=message?t(message):'';status.dataset.error=String(messageError);
}
function say(key,error=false){message=key;messageError=error;render();}
function destination(){const requested=new URLSearchParams(location.search).get('next')||location.pathname+location.search;try{const url=new URL(requested,location.origin);if(url.origin===location.origin&&/^\/(index\.html|live-studio\.html|admin\.html)$/.test(url.pathname))return url.pathname+url.search;}catch{}return '/index.html';}
async function api(action,body={},token){
 const r=await fetch('/api/maintenance',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,...body}),cache:'no-store',credentials:'same-origin'});
 const data=await r.json();if(!r.ok)throw Error(data.error||'SERVICE_UNAVAILABLE');return data;
}
async function withBusy(fn){if(busy)return;busy=true;document.querySelectorAll('form button,[data-owner-google]').forEach(b=>b.disabled=true);say('checking');try{await fn();}catch(error){say(pairs[error.message]?error.message:'SERVICE_UNAVAILABLE',true);}finally{busy=false;document.querySelectorAll('form button,[data-owner-google]').forEach(b=>b.disabled=false);}}
async function ownerAccess(session){if(!session?.access_token)throw Error('AUTH_ERROR');await api('owner',{},session.access_token);location.replace(destination());}
function languageSet(value){if(!['ro','en'].includes(value))return;language=value;try{localStorage.setItem('tikinteract_language',value);}catch{}render();window.dispatchEvent(new Event('tikinteract:language'));}
window.TikInteractLanguage=Object.freeze({get:()=>language,set:languageSet,locale:()=>language==='en'?'en-GB':'ro-RO'});
document.querySelectorAll('[data-locale]').forEach(b=>b.onclick=()=>languageSet(b.dataset.locale));
document.querySelector('[data-maintenance-mode]').onclick=()=>window.TikInteractAppearance.set(window.TikInteractAppearance.get().mode==='light'?'dark':'light');
window.addEventListener('tikinteract:appearance',render);
document.querySelector('[data-maintenance-year]').textContent=String(new Date().getFullYear());render();
// Fragments never reach access logs or Referer headers. Merely opening a link
// cannot consume a code; the visitor explicitly activates it using a POST.
const invitation=new URLSearchParams(location.hash.slice(1)).get('invite');
if(invitation){document.getElementById('preview-code').value=invitation.slice(0,100);history.replaceState(null,'',location.pathname+location.search);}
document.getElementById('preview-form').onsubmit=event=>{event.preventDefault();withBusy(async()=>{
 if(!client)throw Error('SERVICE_UNAVAILABLE');
 const data=await api('redeem',{code:document.getElementById('preview-code').value.trim()});
 const result=await client.auth.setSession(data.session);if(result.error)throw Error('SERVICE_UNAVAILABLE');
 location.replace(destination());
});};
document.getElementById('owner-form').onsubmit=event=>{event.preventDefault();withBusy(async()=>{
 if(!client)throw Error('SERVICE_UNAVAILABLE');const form=event.target;
 const {data,error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});
 form.elements.password.value='';if(error)throw Error('AUTH_ERROR');await ownerAccess(data.session);
});};
document.querySelector('[data-owner-google]').onclick=()=>withBusy(async()=>{
 if(!client)throw Error('SERVICE_UNAVAILABLE');const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/maintenance.html?next='+encodeURIComponent(destination())}});if(error)throw Error('AUTH_ERROR');
});
try{
 for(let n=0;n<80&&!window.supabase;n++)await new Promise(r=>setTimeout(r,100));
 if(!window.supabase)throw Error('SERVICE_UNAVAILABLE');
 const config=await(await fetch('/assets/supabase-config.json')).json();client=window.supabase.createClient(config.url,config.anonKey);
 const statusResponse=await fetch('/api/maintenance?action=status',{cache:'no-store'});
 const status=await statusResponse.json();if(!statusResponse.ok)throw Error(status.error||'SERVICE_UNAVAILABLE');
 const {data:{session}}=await client.auth.getSession();
 if(session?.user?.app_metadata?.site_preview&&!status.valid)await client.auth.signOut({scope:'local'});
 if(status.valid||(!status.enabled&&status.ready)){
  if(status.valid&&status.kind==='guest'&&!session){const restored=await api('resume');const result=await client.auth.setSession(restored.session);if(result.error)throw Error('SERVICE_UNAVAILABLE');}
  const link=document.getElementById('maintenance-continue');link.href=destination();link.hidden=false;say('ready');
 }else if(session&&!session.user?.app_metadata?.site_preview){try{await ownerAccess(session);}catch{/* Ordinary registered users still require an invitation. */}}
 if(status.ready===false)say('SETUP_REQUIRED');
}catch{say('SERVICE_UNAVAILABLE',true);}
