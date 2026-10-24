import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnimationService} from '../lib/animations-service.js';
import {handleAnimationRequest} from '../lib/animations-http.js';
import {TEST_COMMERCE} from '../lib/animations-finance.js';
import {AnimationError} from '../lib/animations-store.js';
import {COMMERCIAL_PREVIEW} from '../assets/commerce-catalog.js';
import {planTickets} from '../assets/plan-tickets.js';
import {creditPurchase} from '../assets/animations-credit-purchase.js';
function setup(config){
 const store={ready:true,one:async()=>({config}),authenticate:async()=>{throw new AnimationError('ANIM_LOGIN_REQUIRED',401);},rpc:()=>{throw Error('Public offers must not use wallet/payment RPCs');}};
 const service=createAnimationService({store,provider:{ready:false},stripe:{commerce:{available:true}}});
 const call=(action,origin='https://example.invalid')=>handleAnimationRequest(new Request('https://example.invalid/api/animations',{method:'POST',headers:{Origin:origin},body:JSON.stringify({action})}),{store,service});
 return {call,service};
}
test('Public test offer reads admin terms without authentication or leaking Stripe IDs and internal costs',async()=>{
 const c=structuredClone(TEST_COMMERCE);c.plans.play_pass.amount=899;c.plans.play_pass.credits=400;c.plans.play_pass.priceId='price_private';
 const {call}=setup({testMode:true,testCommerce:c});const response=await call('publicOffers'),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.testMode,true);assert.equal(data.configured,true);
 assert.deepEqual(data.plans.find(p=>p.id==='play_pass'),{id:'play_pass',amount:899,credits:400,available:true});
 const serialized=JSON.stringify(data);for(const field of ['price_private','finance','standardEurMicros','stripeBps'])assert(!serialized.includes(field));
 assert.equal((await call('state')).status,401);assert.equal((await call('publicOffers','https://evil.invalid')).status,403);
});
test('Unconfigured or live commerce keeps the agreed public preview disabled and cannot activate live prices',async()=>{
 for(const config of [{testMode:true},{testMode:false,testCommerce:TEST_COMMERCE}]){
  const {service}=setup(config);assert.deepEqual(await service.publicOffers(),COMMERCIAL_PREVIEW);
 }
 assert.deepEqual(TEST_COMMERCE.plans.play_pass,{amount:799,credits:300,priceId:''});assert.equal(TEST_COMMERCE.plans.play_pass_pro.amount,1499);
});
test('Public and account tickets replace legacy RON display with the shared test offer and included credits; old test top-ups are disabled',()=>{
 globalThis.window={TikInteractLanguage:{get:()=> 'en',locale:()=> 'en-GB',translate:x=>x}};
 try{
  const plans=[{id:'free',name:'FREE',priceCents:0,currency:'RON',enabled:true,features:['Basic games','TikTok LIVE']},{id:'play_pass',name:'PLAY PASS',priceCents:2900,currency:'RON',enabled:true,features:['Pass games','Studio']},{id:'play_pass_pro',name:'PLAY PASS PRO',priceCents:7900,currency:'RON',enabled:true,features:['PRO games','Studio']}];
  for(const studio of [false,true]){const html=planTickets(plans,{studio});assert(html.includes('7.99'));assert(html.includes('14.99'));assert(html.includes('300 AI credits'));assert(html.includes('800 AI credits'));assert(html.includes('TEST OFFER'));assert(!html.includes('RON'));}
  const html=creditPurchase({wallet:{included:0,purchased:0},config:{testMode:true,commerce:false,packages:[{id:'old',amount:2500,credits:100,currency:'ron'}]}});
  assert(html.includes('1,100')||html.includes('1100'));assert(!html.includes('data-id="old"'));assert.match(html,/data-an-action="buy-package"[^>]*disabled/);assert(html.includes('€2.99'));assert(html.includes('€4.99'));assert(html.includes('€9.99'));
  assert.equal(plans[1].currency,'RON','Display does not mutate legacy server checkout configuration');
 }finally{delete globalThis.window;}
});
