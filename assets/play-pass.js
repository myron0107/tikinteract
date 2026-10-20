const PLAN_NAMES={free:'FREE',play_pass:'PLAY PASS',play_pass_pro:'PLAY PASS PRO'};
let access=null,identity=null,request=0,serverOffset=0,checking=false,timer,redeeming=false;
const ui=()=>document.getElementById('pp-account-status');
const date=value=>new Date(value).toLocaleString((window.TikInteractLanguage?.locale() || 'ro-RO'),{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
export function accessError(error){
 const message=error?.message||error?.code||'';
 if(/PGRST202|schema cache|does not exist/.test(error?.code+' '+message))return 'Activarea cheilor nu este încă disponibilă. Încearcă din nou mai târziu.';
 if(message.includes('ACCESS_ACCOUNT_REQUIRED'))return 'Intră într-un cont cu e-mail confirmat ca să activezi cheia.';
 if(message.includes('ACCESS_RATE_LIMIT'))return 'Ai încercat de prea multe ori. Încearcă din nou peste 15 minute.';
 if(message.includes('ACCESS_KEY_INVALID'))return 'Cheia nu este validă pentru acest cont. Verifică dacă este corectă, disponibilă și neexpirată.';
 return 'Nu am putut verifica accesul. Verifică legătura și încearcă din nou.';
}
function canAccess(plan){
 if(plan==='free')return true;
 if(!access||identity!==window.tikInteractUser?.id)return false;
 const now=Date.now()+serverOffset;
 return access.periods?.some(p=>Date.parse(p.startsAt)<=now&&Date.parse(p.endsAt)>now&&(p.plan==='play_pass_pro'||p.plan===plan))===true;
}
function notify(){render();window.dispatchEvent(new Event('tikinteract:access'));}
function render(){
 const name=checking?'Se verifică…':access?PLAN_NAMES[access.plan]:'FREE';
 document.querySelectorAll('[data-account-pass]').forEach(el=>{el.textContent=name;el.dataset.plan=access?.plan||'free';});
 const accountDescription=document.getElementById('account-pass-description');if(accountDescription)accountDescription.textContent=access?.validUntil?'Acces valabil până la '+date(access.validUntil)+'. Fără reînnoire automată.':'Activează o cheie în PLAY PASS pentru a adăuga acces în cont.';
 const root=ui();if(!root)return;const title=root.querySelector('strong'),copy=root.querySelector('p');root.hidden=false;
 if(!window.tikInteractUser){title.textContent='Accesul tău, în contul tău.';copy.textContent='Intră în cont pentru a activa o cheie și a vedea perioada de acces.';}
 else if(checking){title.textContent='Verificăm accesul…';copy.textContent='Se încarcă perioada asociată contului tău.';}
 else if(!access){title.textContent='Accesul nu a putut fi verificat';copy.textContent='Poți folosi jocurile gratuite. Încearcă din nou activarea pentru a verifica o cheie.';}
 else{title.textContent=PLAN_NAMES[access.plan]+' · '+(access.plan==='free'?'planul tău actual':'activ în cont');copy.textContent=access.validUntil?'Valabil până la '+date(access.validUntil)+'. Fără reînnoire automată.':'Jocurile gratuite rămân disponibile. Activează o cheie pentru Play Pass sau PRO.';}
 const periods=document.getElementById('pp-account-periods');if(periods){periods.replaceChildren();if(access?.periods){const now=Date.now()+serverOffset;for(const p of access.periods.filter(p=>Date.parse(p.startsAt)>now)){const row=document.createElement('span');row.textContent=PLAN_NAMES[p.plan]+' programat: '+date(p.startsAt)+' → '+date(p.endsAt);periods.append(row);}}}
 document.querySelectorAll('[data-pp-plan]').forEach(button=>{const plan=button.dataset.ppPlan;button.textContent=plan==='free'?'Deschide LIVE Studio':canAccess(plan)?'Vezi accesul meu':'Activează cu o cheie';});
}
async function refresh(){
 const client=window.tikInteractSupabase,user=window.tikInteractUser,id=user?.id,current=++request;
 if(!id||!client){identity=id||null;access=null;checking=false;clearTimeout(timer);notify();return null;}
 if(identity!==id){identity=id;access=null;checking=true;notify();}
 try{
  const {data,error}=await client.rpc('get_my_access');if(current!==request||id!==window.tikInteractUser?.id)return null;if(error)throw error;
  if(!data||!Object.hasOwn(PLAN_NAMES,data.plan)||!Array.isArray(data.periods)||!Number.isFinite(Date.parse(data.serverNow)))throw Error('Invalid access response');
  access=data;serverOffset=Date.parse(data.serverNow)-Date.now();checking=false;clearTimeout(timer);
  const ends=data.periods.flatMap(p=>[Date.parse(p.startsAt),Date.parse(p.endsAt)]).filter(t=>t>Date.now()+serverOffset);
  if(ends.length)timer=setTimeout(refresh,Math.min(2147483000,Math.max(100,Math.min(...ends)-Date.now()-serverOffset+100)));
  notify();return data;
 }catch(error){if(current!==request)return null;access=null;checking=false;notify();return null;}
}
async function redeem(event){
 event.preventDefault();if(redeeming)return;const form=event.target,status=document.getElementById('pp-redeem-status'),input=form.elements.code;
 if(!window.tikInteractUser){status.textContent='Intră în cont, apoi activează cheia aici.';status.dataset.error='false';window.openAuthModal?.();return;}
 const code=input.value.trim();if(!code){input.focus();return;}const client=window.tikInteractSupabase,userId=window.tikInteractUser.id;
 redeeming=true;form.querySelector('button').disabled=true;status.textContent='Verificăm cheia…';status.dataset.error='false';
 try{
  if(!client)throw Error('Client unavailable');const {data,error}=await client.rpc('redeem_access_key',{p_code:code});
  if(userId!==window.tikInteractUser?.id)return;if(error)throw error;if(!data?.ok)throw Error(data?.code||'Unavailable');
  input.value='';await refresh();status.textContent=data.alreadyRedeemed?'Ai activat deja această cheie în contul tău. Perioada nu a fost adăugată de două ori.':'Cheie activată. Accesul a fost adăugat în contul tău.';status.dataset.error='false';
 }catch(error){if(userId===window.tikInteractUser?.id){status.textContent=accessError(error);status.dataset.error='true';}}
 finally{redeeming=false;form.querySelector('button').disabled=false;}
}
function initialize(){
 document.getElementById('pp-redeem-form')?.addEventListener('submit',redeem);
 document.querySelectorAll('[data-pp-plan]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.ppPlan==='free'){window.switchView?.('live');return;}const active=canAccess(button.dataset.ppPlan),section=document.getElementById(active?'pp-account-status':'pp-access-key');section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});if(!active)document.getElementById('pp-code').focus({preventScroll:true});}));
 refresh();
}
window.TikInteractPass=Object.freeze({canAccess,getAccess:()=>access?JSON.parse(JSON.stringify(access)):null,refresh});
window.addEventListener('tikinteract:auth',()=>{const id=window.tikInteractUser?.id||null;if(identity!==id){request++;access=null;clearTimeout(timer);document.getElementById('pp-redeem-status')?.replaceChildren();const code=document.getElementById('pp-code');if(code)code.value='';}refresh();});
window.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
setInterval(()=>{if(!document.hidden&&window.tikInteractUser)refresh();},30000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
