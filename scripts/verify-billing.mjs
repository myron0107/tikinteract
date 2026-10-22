import assert from 'node:assert/strict';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
function hook(){
 const c=window.supabase.createClient(),base=c.rpc.bind(c),fetcher=fetch.bind(window);window.__billingRequests=[];
 c.rpc=async(n,...a)=>n==='get_my_account_status'?{data:{allowed:true,state:'active'},error:null}:n==='get_my_access'?{data:{plan:'free',periods:[],serverNow:new Date().toISOString()},error:null}:n==='get_my_billing_orders'?{data:[],error:null}:base(n,...a);
 window.fetch=async(input,options)=>{
  if(String(input)==='/api/billing?action=config')return Response.json({available:true,test:true});
  if(String(input)==='/api/billing'&&options?.method==='POST'){
   const body=JSON.parse(options.body);window.__billingRequests.push(body);
   if(body.action==='verify')return Response.json({status:'test_paid',plan:'play_pass'});
   // Exercise a real UI retry without any network request to a payment processor.
   return Response.json({error:'BILLING_UNAVAILABLE'},{status:503});
  }
  return fetcher(input,options);
 };
}
const b=await openSkyShiftBrowser('billing-ui-review'),run=e=>b.evaluate(e);
try{
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);('+hook.toString()+')();'});
 await b.page('Page.navigate',{url:'http://127.0.0.1:3010/live-studio.html?billing=success&session_id=cs_test_123456789012'});
 await b.waitFor('document.getElementById("studio-user-dialog")?.dataset.view==="subscription"&&document.querySelector("[data-billing-status]")?.textContent.includes("Test reu")');
 assert.equal(await run('TikInteractPass.getAccess().plan'),'free');assert.equal(await run('new URL(location.href).searchParams.has("session_id")'),false);
 await run('TikInteractLanguage.set("en")');await b.waitFor('document.querySelector("[data-billing-status]")?.textContent.includes("Test successful")');await run('TikInteractLanguage.set("ro")');
 await run('document.querySelector("[data-billing-plan]").value="play_pass_pro";document.querySelector("[data-billing-plan]").dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("[data-billing-buy]").click()');
 await b.waitFor('__billingRequests.some(r=>r.action==="create")&&!document.querySelector("[data-billing-buy]").disabled');
 assert.equal(await run('__billingRequests.find(r=>r.action==="create").amount'),7900);
 const id=await run('__billingRequests.find(r=>r.action==="create").requestId');await run('document.querySelector("[data-billing-buy]").click()');await b.waitFor('__billingRequests.filter(r=>r.action==="create").length===2');assert.equal(await run('__billingRequests.filter(r=>r.action==="create")[1].requestId'),id);
 await run('window.dispatchEvent(new Event("tikinteract:auth"))');await b.waitFor('!document.querySelector("[data-billing-buy]").disabled');await run('document.querySelector("[data-billing-buy]").click()');await b.waitFor('__billingRequests.filter(r=>r.action==="create").length===3');assert.equal(await run('__billingRequests.filter(r=>r.action==="create")[2].requestId'),id,'Refreshing the same auth identity must retain purchase idempotency');
 for(const width of [1440,390,320])for(const mode of ['dark','light'])for(const theme of ['burgundy','blue'])for(const lang of ['ro','en']){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
  await run(`TikInteractAppearance.set(${JSON.stringify({mode,theme})});TikInteractLanguage.set('${lang}')`);
  await b.waitFor('!!document.querySelector("[data-billing-buy]")');assert.equal(await run('document.querySelector("[data-sw-content]").scrollWidth>document.querySelector("[data-sw-content]").clientWidth+1'),false,'billing overflow '+width+mode+theme+lang);
  if(lang==='en')assert.match(await run('document.querySelector("[data-billing-status]").textContent'),/We could not confirm/);
 }
 await run('TikInteractLanguage.set("ro");TikInteractAppearance.set({mode:"light",theme:"burgundy"});document.querySelector("[data-billing-host]").scrollIntoView({block:"center"})');await b.screenshot('.tools/billing-ui-mobile.webp');assert.deepEqual(b.errors,[]);
 console.log('Billing UI: return confirmation, no test entitlement, exact selected amount, retry idempotency, RO/EN and all four appearances at desktop/mobile passed. No real Stripe call.');
}catch(e){console.log(b.errors);console.log(await run('({url:location.href,user:!!window.tikInteractUser,view:window.TikInteractStudioWindows?.getView(),requests:window.__billingRequests,host:document.querySelector("[data-billing-host]")?.textContent})'));await b.screenshot('.tools/billing-ui-failure.webp');throw e;}finally{await b.close();}
