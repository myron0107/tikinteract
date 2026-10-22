import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
function hook(){
 const c=window.supabase.createClient(),original=c.auth.getSession,base=c.rpc.bind(c);window.__accountQA={updates:0,resets:0,analytics:0};
 c.auth.getSession=async()=>{const r=await original();if(r.data.session){const u=r.data.session.user;u.created_at='2026-06-12T10:00:00Z';u.email_confirmed_at='2026-06-12T10:00:00Z';u.user_metadata.tiktok_username='layout.creator';}return r;};
 c.auth.updateUser=async({data})=>{const{data:{session}}=await c.auth.getSession();Object.assign(session.user.user_metadata,data);window.__accountQA.updates++;window.__qaSignIn();return{data:{user:session.user},error:null};};
 c.auth.resetPasswordForEmail=async()=>{window.__accountQA.resets++;return{error:null};};
 c.rpc=async(n,...a)=>n==='get_my_account_status'?{data:{allowed:true,state:'active'},error:null}:n==='get_my_access'?{data:{plan:'free',periods:[],serverNow:new Date().toISOString()},error:null}:n==='get_my_site_inbox'?{data:{items:[],total:0,unread:0},error:null}:n==='list_support_tickets'?{data:{items:[],total:0,stats:{}},error:null}:n==='get_my_stream_analytics'?(window.__accountQA.analytics++,{data:{totals:{coins:0,gifts:0,supporters:0,seconds:0,peakViewers:null,chatters:0,comments:0,likes:0,unattributedCoins:0},daily:[],sessions:[],sessionTotal:0,supporters:[],recent:[],games:[]},error:null}):base(n,...a);
}
const b=await openSkyShiftBrowser('account-windows-review'),run=e=>b.evaluate(e),dir='.tools/account-windows-review';
const settle=()=>run('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
async function show(view,options={}){await run(`TikInteractStudioWindows.open(${JSON.stringify(view)},${JSON.stringify(options)})`);await b.waitFor(`document.getElementById('studio-user-dialog')?.open&&document.getElementById('studio-user-dialog').dataset.view===${JSON.stringify(view)}&&!document.querySelector('[data-sw-content]').hasAttribute('aria-busy')`);await settle();}
try{
 await mkdir(dir,{recursive:true});await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);('+hook.toString()+')();'});
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await b.page('Page.navigate',{url:'http://127.0.0.1:3010/live-studio.html'});await b.waitFor('window.TikInteractAccount?.isAllowed()&&window.TikInteractStudioWindows');
 assert.deepEqual(await run('Array.from(document.querySelectorAll(".studio-app-rail [data-studio-tab]")).map(b=>b.dataset.studioTab)'),['studio','games','audio','animations']);
 await run('document.getElementById("studio-account-avatar").click()');assert.equal(await run('document.getElementById("studio-profile-dropdown").hidden'),false);
 assert.deepEqual(await run('Array.from(document.querySelectorAll("#studio-profile-dropdown [data-studio-user-view]")).map(b=>b.dataset.studioUserView)'),['account','subscription','analytics','support']);
 assert.equal(await run('document.querySelector("#studio-profile-dropdown a[href*=index]")?.getAttribute("href")'),undefined);
 assert.equal(await run('document.querySelector(".sw-rail-footer>a").getAttribute("href")'),'index.html');
 await run('document.getElementById("studio-account-avatar").click();document.querySelector("[data-sw-rail-help]").click()');await b.waitFor('document.getElementById("studio-user-dialog").open&&document.getElementById("studio-user-dialog").dataset.view==="help"');
 assert.equal(await run('document.querySelector("[data-sw-back]").hidden'),true);
 await run('TikInteractStudioWindows.close()');await b.waitFor('!document.getElementById("studio-user-dialog").open');await run('document.getElementById("studio-account-avatar").click()');
 await b.screenshot(dir+'/profile-menu.webp');await run('document.querySelector("[data-studio-user-view=account]").click()');await b.waitFor('document.getElementById("studio-user-dialog")?.open&&!document.querySelector("[data-sw-content]").hasAttribute("aria-busy")');
 assert.equal(await run('document.querySelectorAll("#creator-account-panel [data-account-section]:not([hidden])").length'),1);
 assert.equal(await run('document.querySelector("#account-section-profile").hidden'),false);
 await run('document.getElementById("account-display-name-input").value="Updated creator";document.querySelector("[data-profile-form]").requestSubmit()');await b.waitFor('__accountQA.updates===1');
 await show('account',{section:'preferences'});await run('document.querySelector("[data-account-preference=mode][data-value=light]").click();document.querySelector("[data-account-preference=theme][data-value=blue]").click()');assert.deepEqual(await run('TikInteractAppearance.get()'),{mode:'light',theme:'blue'});
 await show('subscription');await run('document.getElementById("pp-code").value="TI-UNSENT-DRAFT";TikInteractLanguage.set("en")');await settle();assert.equal(await run('document.getElementById("pp-code").value'),'TI-UNSENT-DRAFT');assert.equal(await run('document.querySelectorAll("#creator-account-panel [data-account-section]:not([hidden])").length'),1);
 await show('account',{section:'security'});await run('document.querySelector("[data-account-password]").click()');await b.waitFor('__accountQA.resets===1');
 await show('help');assert.equal(await run('document.getElementById("studio-help-panel").hidden'),false);await show('community');assert.equal(await run('document.getElementById("creator-community-panel").hidden'),false);
 await show('analytics');await b.waitFor('__accountQA.analytics>0&&document.querySelector("#creator-analytics-panel .cp-metric")');
 await show('support');assert.equal(await run('document.querySelector("[data-account-support-inbox]").hidden'),false);assert.equal(await run('document.querySelector("[data-sw-support-links] [data-sw-open=help]")'),null);
 await run('TikInteractStudioWindows.close()');await b.waitFor('!document.getElementById("studio-user-dialog").open');assert.equal(await run('document.querySelector("[data-account-support-inbox]").hidden'),true);
 await run('launchStudioGame("moto-interact")');await b.waitFor('!!document.getElementById("live-game-frame")?.getAttribute("src")');const game=await run('document.getElementById("live-game-frame").src');
 for(const v of ['account','subscription','analytics','support']){await show(v);assert.equal(await run('document.getElementById("live-game-frame").src'),game);assert.equal(await run('document.getElementById("live-studio-tab").getAttribute("aria-selected")'),'true');}
 for(const width of [1440,768,390,320]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
  for(const lang of ['ro','en'])for(const theme of ['burgundy','blue'])for(const mode of ['dark','light']){
   await run(`TikInteractLanguage.set(${JSON.stringify(lang)});TikInteractAppearance.set(${JSON.stringify({mode,theme})})`);await settle();
   for(const v of ['account','subscription','analytics','support']){
    await show(v);const check=await run(`(()=>{const d=document.getElementById('studio-user-dialog'),c=document.querySelector('[data-sw-content]'),r=d.getBoundingClientRect();return{inside:r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,overflow:c.scrollWidth>c.clientWidth+1}})()`);assert(check.inside&&!check.overflow,JSON.stringify({width,lang,theme,mode,v,check}));
    if(width<680){assert.equal(await run('Math.round(document.getElementById("studio-user-dialog").getBoundingClientRect().width)'),width);assert.equal(await run('getComputedStyle(document.querySelector(".studio-app-nav .live-studio-tab>span")).display'),'none');}
   }
  }
 }
 for(const [width,mode]of [[1440,'dark'],[1440,'light'],[390,'light']]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});await run(`TikInteractLanguage.set('ro');TikInteractAppearance.set({theme:'burgundy',mode:${JSON.stringify(mode)}})`);
  for(const v of ['account','subscription','analytics','support']){await show(v);await b.screenshot(dir+'/'+width+'-'+mode+'-'+v+'.webp');}
 }
 await run('document.querySelector("[data-sw-close]").click()');await b.waitFor('!document.getElementById("studio-user-dialog").open');assert.equal(await run('document.activeElement.id'),'studio-account-avatar');
 await run('document.getElementById("studio-account-avatar").click();document.querySelector("[data-sw-signout]").click()');await b.waitFor('!window.tikInteractUser');await b.waitFor('location.pathname.endsWith("/index.html")&&!window.tikInteractUser');assert.deepEqual(b.errors,[]);
 console.log('Avatar menu order and icons; separate account/subscription/analytics/support windows; profile save, preferences, draft preservation, password reset and logout; active game retained; 32 localized appearance/viewport combinations; full-screen mobile and icon-only rail; no JavaScript errors. Auth calls isolated in fixtures.');
}catch(error){console.log(b.errors);await b.screenshot(dir+'/failure.webp');throw error;}finally{await b.close();}
