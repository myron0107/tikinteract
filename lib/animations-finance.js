// Internal, server-only commercial model. EUR amounts use cents, AI costs use
// millionths of EUR. Unknown costs remain null instead of becoming free costs.
import {AnimationError} from './animations-store.js';
export const TEST_COMMERCE={
 version:1,currency:'eur',standardCredits:100,premiumCredits:200,
 plans:{free:{amount:0,credits:0,priceId:''},play_pass:{amount:799,credits:300,priceId:''},play_pass_pro:{amount:1499,credits:800,priceId:''}},
 packages:[{id:'credits-200',amount:299,credits:200,priceId:'',enabled:true},{id:'credits-500',amount:499,credits:500,priceId:'',enabled:true},{id:'credits-1100',amount:999,credits:1100,priceId:'',enabled:true}],
 finance:{standardEurMicros:300000,premiumEurMicros:null,taxBps:null,stripeBps:null,stripeFixedCents:null,billingBps:70,affiliateBps:0,infrastructureCents:0,storageCents:0,usdToEur:null,minimumMarginBps:2000}
};
const invalid=()=>{throw new AnimationError('ANIM_CONFIG_INVALID');};
const integer=(n,min,max,nullable=false)=>{if(nullable&&n===null)return;if(!Number.isSafeInteger(n)||n<min||n>max)invalid();};
export function validateCommerce(value){
 if(!value||value.version!==1||value.currency!=='eur')invalid();
 integer(value.standardCredits,1,1000000);integer(value.premiumCredits,1,1000000);
 const ids=new Set(),priceIds=new Set();
 const offer=(p,free=false)=>{if(!p)invalid();integer(p.amount,free?0:100,10000000);integer(p.credits,free?0:1,1000000);if(typeof p.priceId!=='string'||p.priceId!==''&&!/^price_[A-Za-z0-9]{1,120}$/.test(p.priceId))invalid();if(p.priceId){if(priceIds.has(p.priceId))invalid();priceIds.add(p.priceId);}};
 if(Object.keys(value.plans||{}).sort().join(',')!=='free,play_pass,play_pass_pro')invalid();
 for(const [id,p] of Object.entries(value.plans))offer(p,id==='free');
 if(value.plans.free.amount!==0||value.plans.free.credits!==0||value.plans.free.priceId!==''||value.plans.play_pass_pro.credits<value.plans.play_pass.credits)invalid();
 if(!Array.isArray(value.packages)||value.packages.length>12)invalid();
 for(const p of value.packages){offer(p);if(!/^\w[\w-]{0,39}$/.test(p.id)||ids.has(p.id)||typeof p.enabled!=='boolean')invalid();ids.add(p.id);}
 const f=value.finance;if(!f)invalid();
 for(const k of ['standardEurMicros','premiumEurMicros'])integer(f[k],1,1000000000,true);
 for(const k of ['taxBps','stripeBps','billingBps','affiliateBps','minimumMarginBps'])integer(f[k],0,k==='minimumMarginBps'?9999:10000,true);
 for(const k of ['stripeFixedCents','infrastructureCents','storageCents'])integer(f[k],0,100000,true);
 if(f.usdToEur!==null&&(!Number.isFinite(f.usdToEur)||f.usdToEur<=0||f.usdToEur>1000))invalid();
 return structuredClone(value);
}
export function effectiveAnimationConfig(config){
 if(!config.testMode||!config.testCommerce)return config;
 const c=config.testCommerce;
 return {...config,standardCredits:c.standardCredits,premiumCredits:c.premiumCredits,monthlyCredits:{play_pass:c.plans.play_pass.credits,play_pass_pro:c.plans.play_pass_pro.credits},packages:c.packages.map(p=>({...p,currency:'eur'}))};
}
// Unbounded knapsack reduced to at most one million credit units. It considers
// mixed Standard/Premium use and leftover credits, rather than fractional videos.
export function maximumAICost(credits,c){
 const f=c.finance,s=c.standardCredits,p=c.premiumCredits;
 if(f.standardEurMicros===null&&credits>=s||f.premiumEurMicros===null&&credits>=p)return null;
 let best={eurMicros:0,standard:0,premium:0,unused:credits};
 for(let premium=0;premium*p<=credits;premium++){
  const standard=Math.floor((credits-premium*p)/s),eurMicros=standard*(f.standardEurMicros||0)+premium*(f.premiumEurMicros||0);
  if(eurMicros>best.eurMicros)best={eurMicros,standard,premium,unused:credits-standard*s-premium*p};
 }
 return best;
}
export function offerMargin(offer,c,{subscription=false}={}){
 const f=c.finance,gross=offer.amount/100,missing=[];
 for(const k of ['taxBps','stripeBps','stripeFixedCents','affiliateBps','infrastructureCents','storageCents',...(subscription?['billingBps']:[])])if(f[k]===null)missing.push(k);
 const net=f.taxBps===null?null:gross/(1+f.taxBps/10000);
 const tax=net===null?null:gross-net;
 const processing=f.stripeBps===null||f.stripeFixedCents===null?null:gross*f.stripeBps/10000+f.stripeFixedCents/100;
 const billing=subscription?(f.billingBps===null?null:gross*f.billingBps/10000):0;
 const affiliate=net===null||f.affiliateBps===null?null:net*f.affiliateBps/10000;
 const infrastructure=f.infrastructureCents===null?null:f.infrastructureCents/100,storage=f.storageCents===null?null:f.storageCents/100;
 const zeroUse=missing.length?null:net-processing-billing-affiliate-infrastructure-storage;
 const worst=maximumAICost(offer.credits,c),aiMaximum=worst===null?null:worst.eurMicros/1e6;
 const fullUse=zeroUse===null||aiMaximum===null?null:zeroUse-aiMaximum;
 const standardCount=Math.floor(offer.credits/c.standardCredits),premiumCount=Math.floor(offer.credits/c.premiumCredits);
 return {gross,net,tax,processing,billing,affiliate,infrastructure,storage,zeroUse,fullUse,aiMaximum,worst,standardCount,premiumCount,standardOnlyCost:f.standardEurMicros===null?null:standardCount*f.standardEurMicros/1e6,premiumOnlyCost:f.premiumEurMicros===null?null:premiumCount*f.premiumEurMicros/1e6,missing,
  warning:fullUse===null?'incomplete':fullUse<0?'loss':f.minimumMarginBps!==null&&fullUse/(net||1)<f.minimumMarginBps/10000?'low':'ok'};
}
export function commerceProjection(c){return {plans:Object.fromEntries(Object.entries(c.plans).map(([id,p])=>[id,id==='free'?{gross:0,zeroUse:0,fullUse:0,aiMaximum:0,warning:'ok',standardCount:0,premiumCount:0,standardOnlyCost:0,premiumOnlyCost:0}:offerMargin(p,c,{subscription:true})])),packages:c.packages.map(p=>({id:p.id,...offerMargin(p,c)})),standardCost:c.finance.standardEurMicros===null?null:c.finance.standardEurMicros/1e6,premiumCost:c.finance.premiumEurMicros===null?null:c.finance.premiumEurMicros/1e6};}
export function testGenerationProfitable(config){
 if(!config.testMode||!config.testCommerce)return true;
 const c=structuredClone(config.testCommerce),f=c.finance;
 if(!f.usdToEur||f.minimumMarginBps===null||!config.standardUsdMicros||!config.premiumUsdMicros||f.standardEurMicros===null||f.premiumEurMicros===null)return false;
 // Never approve spending using a cheaper simulation than the provider ceiling.
 f.standardEurMicros=Math.max(f.standardEurMicros,Math.ceil(config.standardUsdMicros*f.usdToEur));
 f.premiumEurMicros=Math.max(f.premiumEurMicros,Math.ceil(config.premiumUsdMicros*f.usdToEur));
 const p=commerceProjection(c);
 return [...Object.entries(p.plans).filter(([id])=>id!=='free').map(([,p])=>p),...p.packages.filter(p=>c.packages.find(x=>x.id===p.id)?.enabled)].every(p=>p.warning==='ok');
}
