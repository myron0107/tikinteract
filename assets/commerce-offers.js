import {COMMERCIAL_PREVIEW} from './commerce-catalog.js?v=1';
const clone=v=>JSON.parse(JSON.stringify(v));
let offer=clone(COMMERCIAL_PREVIEW),request=null;
const t=(ro,en)=>window.TikInteractLanguage?.get()==='en'?en:ro;
export const commerceOffer=()=>clone(offer);
export const monthlyOfferCredits=config=>config.testMode&&!config.commerce?Object.fromEntries(offer.plans.map(p=>[p.id,p.credits])):config.monthlyCredits;
export const offerMoney=(amount,currency=offer.currency)=>new Intl.NumberFormat(window.TikInteractLanguage?.locale()||'en-GB',{style:'currency',currency:currency.toUpperCase()}).format(amount/100);
export function offerPlans(plans){return plans.map(p=>{const o=offer.plans.find(x=>x.id===p.id);return o?{...p,priceCents:o.amount,currency:offer.currency.toUpperCase(),aiCredits:o.credits,features:[...p.features.slice(0,2),o.credits+' '+t('credite AI / lună incluse','AI credits / month included')]}:p;});}
export function offerSummary(){return `<div class="commerce-offer-summary" data-commerce-offer-summary><p>${t('OFERTĂ DE TEST · Fără încasări reale. Creditele AI sunt incluse în preț. FREE poate folosi Generatorul AI și poate cumpăra credite fără abonament.','TEST OFFER · No real charges. AI credits are included in the price. FREE can access the AI Generator and buy credits without a subscription.')}</p><p>${t('Reîncărcări','Top-ups')}: ${offer.packages.map(p=>`${p.credits} ${t('credite','credits')} — ${offerMoney(p.amount)}`).join(' · ')}.</p><p>Standard: ${offer.standardCredits} ${t('credite','credits')} / 5 s · Premium: ${offer.premiumCredits} ${t('credite','credits')} / 5 s.</p></div>`;}
function valid(v){return v?.version===1&&v.currency==='eur'&&v.testMode===true&&Array.isArray(v.plans)&&v.plans.length===3&&['free','play_pass','play_pass_pro'].every(id=>v.plans.some(p=>p.id===id&&Number.isSafeInteger(p.amount)&&p.amount>=0&&Number.isSafeInteger(p.credits)&&p.credits>=0))&&Array.isArray(v.packages)&&v.packages.length<=12&&v.packages.every(p=>/^[\w-]{1,40}$/.test(p.id)&&Number.isSafeInteger(p.amount)&&p.amount>=100&&Number.isSafeInteger(p.credits)&&p.credits>0)&&[v.standardCredits,v.premiumCredits].every(n=>Number.isSafeInteger(n)&&n>0);}
export async function refreshCommerceOffer(){
 if(request)return request;
 request=(async()=>{try{const r=await fetch('/api/animations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'publicOffers'}),cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)return false;const data=await r.json();if(!valid(data))return false;offer=clone(data);window.dispatchEvent(new Event('tikinteract:commerce-offer'));return true;}catch{return false;}finally{request=null;}})();return request;
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 window.TikInteractCommerce=Object.freeze({get:commerceOffer,refresh:refreshCommerceOffer});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refreshCommerceOffer,{once:true});else refreshCommerceOffer();
 window.addEventListener('tikinteract:finance-saved',refreshCommerceOffer);
 window.addEventListener('storage',e=>{if(e.key==='tikinteract_commerce_refresh')refreshCommerceOffer();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCommerceOffer();});
}
