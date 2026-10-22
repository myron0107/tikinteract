import {esc,ic} from './creator-ui.js?v=4';
const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
let root,config={available:false,test:true},loaded=false,pending=false,chosen='play_pass',message='',error=false,epoch=0,history=[],identity=null,requestId=null,returnStarted=false;
const returnParams=new URLSearchParams(location.search),returned=returnParams.get('billing'),sessionId=returnParams.get('session_id');
const copy={
 BILLING_LOGIN_REQUIRED:['Intră în cont pentru a continua.','Sign in to continue.'],
 BILLING_ACCOUNT_REQUIRED:['Folosește un cont înregistrat, cu e-mail confirmat.','Use a registered account with a confirmed email.'],
 BILLING_PRICE_CHANGED:['Prețul s-a schimbat. Reîncarcă pagina și verifică noul tarif.','The price changed. Reload the page and check the new price.'],
 BILLING_RATE_LIMIT:['Ai încercat prea des. Reîncearcă peste 15 minute.','Too many attempts. Try again in 15 minutes.'],
 BILLING_CHECKOUT_EXPIRED:['Sesiunea de plată a expirat. Încearcă din nou.','Checkout expired. Please try again.'],
 BILLING_SETUP_REQUIRED:['Plata online nu este disponibilă încă. Poți folosi o cheie de acces.','Online payments are not available yet. You can redeem an access key.']
};
const failurePair=code=>copy[code]||['Nu am putut confirma plata. Reîncearcă sau contactează suportul.','We could not confirm the payment. Retry or contact support.'];
const failures=code=>t(...failurePair(code));
const labels={paid:['Plătit','Paid'],test_paid:['Test','Test'],refunded:['Rambursat','Refunded'],disputed:['În dispută','Disputed']};
const money=(amount,currency)=>new Intl.NumberFormat(window.TikInteractLanguage?.locale()||'ro-RO',{style:'currency',currency:currency.toUpperCase()}).format(amount/100);
function draw(){
 const host=root?.querySelector('[data-billing-host]');if(!host)return;
 const plans=window.TikInteractPlatform?.getConfig()?.plans.filter(p=>p.enabled&&p.id!=='free'&&p.priceCents>0)||[];
 if(!plans.some(p=>p.id===chosen))chosen=plans[0]?.id||'';
 host.innerHTML=`<section class="billing-panel"><div class="billing-heading">${ic('credit-card')}<div><h3>${t('Plată online','Online payment')}</h3><p>${t('Acces pentru o lună. Fără reînnoire automată.','One month of access. No automatic renewal.')}</p></div></div>${config.available&&config.test?`<p class="billing-test">${t('MOD DE TEST · Nu se încasează bani și nu se activează acces premium real.','TEST MODE · No money is collected and no real premium access is activated.')}</p>`:''}<div class="billing-controls"><label>${t('Alege tichetul','Choose your ticket')}<select data-billing-plan ${pending?'disabled':''}>${plans.map(p=>`<option value="${esc(p.id)}" ${p.id===chosen?'selected':''}>${esc(p.name)} · ${esc(money(p.priceCents,p.currency))}</option>`).join('')}</select></label><button type="button" data-billing-buy ${!loaded||!config.available||pending||!chosen?'disabled':''}>${ic('lock')}${pending?t('Se verifică…','Checking…'):config.test?t('Testează plata','Test payment'):t('Continuă la plată','Continue to payment')}</button></div><p class="billing-methods">${t('Card · Google Pay · Apple Pay — opțiunile disponibile apar la plată.','Card · Google Pay · Apple Pay — available options appear at checkout.')}</p>${loaded&&!config.available?`<p class="billing-note">${failures('BILLING_SETUP_REQUIRED')}</p>`:''}<p class="billing-status" role="status" data-billing-status data-error="${error}" ${message?'':'hidden'}>${esc(message?t(...message):'')}</p>${message&&error?`<button type="button" data-billing-check>${t('Verifică din nou','Check again')}</button>`:''}</section>${history.length?`<section class="billing-history"><h3>${t('Plățile mele','My payments')}</h3><ul>${history.map(o=>`<li><div><strong>${o.plan==='play_pass_pro'?'Play Pass PRO':'Play Pass'}</strong><small>${esc(new Intl.DateTimeFormat(window.TikInteractLanguage?.locale()||'ro-RO',{dateStyle:'medium'}).format(new Date(o.paid_at||o.created_at)))}</small></div><span>${esc(money(o.amount,o.currency))}</span><span>${t(...(labels[o.status]||['—','—']))}</span>${o.receipt_url&&/^https:\/\/(pay|receipt|invoice)\.stripe\.com\//.test(o.receipt_url)?`<a href="${esc(o.receipt_url)}" target="_blank" rel="noopener noreferrer">${t('Confirmare','Receipt')}${ic('arrow-up-right-from-square')}</a>`:''}</li>`).join('')}</ul></section>`:''}`;
}
async function api(body){
 const {data:{session}}=await window.tikInteractSupabase.auth.getSession();if(!session)throw Error('BILLING_LOGIN_REQUIRED');
 const response=await fetch('/api/billing',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(30000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'BILLING_UNAVAILABLE');return data;
}
async function load(){
 const own=window.tikInteractUser?.id,current=++epoch;
 const results=await Promise.allSettled([
  fetch('/api/billing?action=config',{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null),
  own?window.tikInteractSupabase?.rpc('get_my_billing_orders'):null
 ]);
 if(current!==epoch||own!==window.tikInteractUser?.id)return;
 config=results[0].status==='fulfilled'&&results[0].value?.available===true?results[0].value:{available:false,test:true};loaded=true;
 const rows=results[1].status==='fulfilled'?results[1].value:null;history=!rows?.error&&Array.isArray(rows?.data)?rows.data:[];draw();handleReturn();
}
async function buy(){
 if(pending)return;if(!window.tikInteractUser){window.openAuthModal?.();return;}
 const plan=window.TikInteractPlatform?.getConfig()?.plans.find(p=>p.id===chosen);if(!plan||!config.available)return;
 const own=window.tikInteractUser.id;pending=true;error=false;message='';requestId||=crypto.randomUUID();draw();
 try{
  const data=await api({action:'create',plan:chosen,amount:plan.priceCents,currency:plan.currency.toLowerCase(),locale:window.TikInteractLanguage?.get()||'ro',requestId});
  if(own!==window.tikInteractUser?.id)return;
  if(data.status){if(data.status!=='pending')requestId=null;await window.TikInteractPass?.refresh();message=data.status==='pending'?['Plata este în curs de confirmare. Încearcă din nou în câteva momente.','Payment confirmation is pending. Try again shortly.']:['Această plată a fost deja procesată.','This payment was already processed.'];await load();return;}
  const u=new URL(data.url);if(u.protocol!=='https:'||u.hostname!=='checkout.stripe.com')throw Error('BILLING_UNAVAILABLE');location.assign(u.href);
 }catch(e){if(own===window.tikInteractUser?.id){error=true;message=failurePair(e.message);if(['BILLING_CHECKOUT_EXPIRED','BILLING_PRICE_CHANGED'].includes(e.message))requestId=null;}}
 finally{if(own===window.tikInteractUser?.id){pending=false;draw();}}
}
async function checkReturn(){
 if(pending||!sessionId)return;pending=true;message=['Confirmăm plata…','Confirming payment…'];error=false;draw();const own=window.tikInteractUser?.id;
 try{
  const result=await api({action:'verify',sessionId});if(own!==window.tikInteractUser?.id)return;
  message=result.status==='paid'?['Plată confirmată. Accesul este adăugat în contul tău.','Payment confirmed. Access has been added to your account.']:result.status==='test_paid'?['Test reușit. Nu s-au încasat bani și nu s-a activat acces premium real.','Test successful. No money was collected and no real premium access was activated.']:result.status==='pending'?['Plata este în curs de confirmare. Verifică din nou în câteva momente.','Payment confirmation is pending. Check again shortly.']:['Plata a fost rambursată sau este în dispută. Contactează suportul dacă ai întrebări.','The payment was refunded or is disputed. Contact support with any questions.'];
  error=result.status==='pending';await window.TikInteractPass?.refresh();await load();
 }catch(e){if(own===window.tikInteractUser?.id){error=true;message=failurePair(e.message);}}
 finally{if(own===window.tikInteractUser?.id){pending=false;draw();}}
}
async function handleReturn(){
 if(returnStarted||!returned||document.readyState==='loading'||document.body.dataset.page!=='studio'||!window.tikInteractUser||!window.TikInteractStudioWindows||!window.TikInteractAccount?.isAllowed())return;
 returnStarted=true;const u=new URL(location.href);u.searchParams.delete('billing');u.searchParams.delete('session_id');window.history.replaceState(window.history.state,'',u);
 await window.TikInteractStudioWindows.open('subscription');
 if(returned==='success'&&sessionId)await checkReturn();else{message=['Plata a fost anulată. Nu s-a activat acces suplimentar.','Checkout was cancelled. No additional access was activated.'];error=false;draw();}
}
export function selectBillingPlan(plan){if(pending)return;chosen=plan;requestId=null;draw();const host=root?.querySelector('[data-billing-host]');if(config.available){host?.scrollIntoView({behavior:'smooth',block:'center'});return true;}return false;}
export function mountBilling(element){
 if(root!==element){root=element;root.addEventListener('change',e=>{if(e.target.matches('[data-billing-plan]')){chosen=e.target.value;requestId=null;}});root.addEventListener('click',e=>{if(e.target.closest('[data-billing-buy]'))buy();if(e.target.closest('[data-billing-check]'))sessionId?checkReturn():load();});}
 draw();if(identity!==window.tikInteractUser?.id||!loaded){identity=window.tikInteractUser?.id;load();}
}
window.addEventListener('tikinteract:auth',()=>{const next=window.tikInteractUser?.id||null;if(identity!==next){epoch++;identity=next;history=[];message='';pending=false;requestId=null;loaded=false;chosen='play_pass';}if(root)load();setTimeout(handleReturn,0);});
window.addEventListener('tikinteract:account-status',()=>setTimeout(handleReturn,0));
document.addEventListener('DOMContentLoaded',()=>setTimeout(handleReturn,0),{once:true});
for(const event of ['tikinteract:language','tikinteract:config'])window.addEventListener(event,draw);
setTimeout(handleReturn,0);
