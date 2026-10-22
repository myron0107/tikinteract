import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';

const origin='http://127.0.0.1:3021';
const server=spawn('python',['-m','http.server','3021','--bind','127.0.0.1'],{windowsHide:true,stdio:'ignore'});
await new Promise(resolve=>setTimeout(resolve,600));
const browser=await openSkyShiftBrowser('subscription-route-review'),run=expression=>browser.evaluate(expression);
const ready=()=>browser.waitFor('document.documentElement?.dataset.uiReady==="ready"');
const seed=async(signedIn,language)=>{
    await run(`sessionStorage.clear();sessionStorage.setItem('tikinteract-qa-auth',${JSON.stringify(signedIn?'1':'0')});localStorage.setItem('tikinteract_language',${JSON.stringify(language)})`);
    await browser.page('Page.navigate',{url:origin+'/index.html'});await ready();
    await browser.waitFor('!!document.querySelector("#approved-home-plans [data-ticket-action=play_pass_pro]")');
};
async function subscription(plan=''){
    await browser.waitFor('location.pathname==="/live-studio.html"&&window.TikInteractStudioWindows?.getView()==="subscription"&&!!document.querySelector("dialog[open][data-view=subscription] .ti-ticket")');
    await run('new Promise(resolve=>setTimeout(resolve,350))');
    assert.equal(await run('document.querySelector(".ti-ticket[data-selected=true]")?.dataset.ticketPlan||""'),plan);
    if(plan)assert.equal(await run('document.querySelector("[data-billing-plan]").value'),plan);
    assert.equal(await run('document.getElementById("live-game-frame").getAttribute("src")'),null,'No game starts during subscription navigation');
    assert.equal(await run('window.__billingMutations'),0,'No checkout or payment is started automatically');
}
try{
    await mkdir('.tools/subscription-route-review',{recursive:true});
    await browser.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(false);'+`
      const c=window.supabase.createClient(),rpc=c.rpc.bind(c);
      c.rpc=async(name,...args)=>name==='get_my_account_status'?(await new Promise(r=>setTimeout(r,250)),{data:{allowed:true,state:'active'},error:null}):name==='get_my_access'?{data:{plan:'free',periods:[],serverNow:new Date().toISOString()},error:null}:rpc(name,...args);
      c.auth.signInWithOAuth=async()=>({error:null});
      window.__billingMutations=0;
      const fetchOriginal=window.fetch.bind(window);
      window.fetch=(url,options)=>String(url).includes('/api/billing')?(options?.method==='POST'?(window.__billingMutations++,Promise.reject(Error('Unexpected checkout'))):Promise.resolve(Response.json({available:true,test:true}))):fetchOriginal(url,options);
    `});
    await browser.page('Page.navigate',{url:origin+'/index.html'});await ready();
    for(const [width,height,language]of [[1366,768,'ro'],[390,844,'en']]){
        await browser.page('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
        for(const plan of ['play_pass','play_pass_pro']){
            await seed(true,language);
            await run(`document.querySelector('#approved-home-plans [data-ticket-action=${plan}]').click()`);
            await subscription(plan);
        }
        await browser.screenshot('.tools/subscription-route-review/pro-'+width+'.webp');

        await seed(false,language);
        await run('document.querySelector("#approved-home-plans [data-ticket-action=play_pass_pro]").click()');
        assert.equal(await run('location.pathname'),'/index.html');
        assert.equal(await run('document.getElementById("auth-modal").classList.contains("hidden")'),false);
        await run('__qaSignIn()');await subscription('play_pass_pro');

        await seed(false,language);
        await run('document.querySelector("#approved-home-plans [data-ticket-action=play_pass]").click();loginWithGoogle()');
        assert.equal(await run('JSON.parse(sessionStorage.getItem("tikinteract-studio-return")).plan'),'play_pass');
        await run('sessionStorage.setItem("tikinteract-qa-auth","1")');
        await browser.page('Page.navigate',{url:origin+'/index.html'});await subscription('play_pass');
        assert.equal(await run('sessionStorage.getItem("tikinteract-studio-return")'),null);

        await seed(true,language);await run('openStudioSubscription()');await subscription();
        await seed(true,language);await run('document.querySelector("#approved-home-plans [data-ticket-action=free]").click()');
        await browser.waitFor('location.pathname==="/live-studio.html"&&document.documentElement?.dataset.uiReady==="ready"');
        assert.equal(await run('TikInteractStudioWindows.getView()'),null,'Free ticket opens the workspace');
    }
    assert.deepEqual(browser.errors,[]);
    console.log('Passed: paid homepage cards, exact plan in subscription and billing, anonymous login, OAuth return, comparison and free Studio entry; desktop/mobile and RO/EN. No automatic game, checkout or payment. No JS exceptions.');
}catch(error){await browser.screenshot('.tools/subscription-route-review/failure.webp');console.log(browser.errors);throw error;}
finally{await browser.close();server.kill();}
