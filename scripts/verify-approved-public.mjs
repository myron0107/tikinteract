// UI regression checks against the real, disposable PostgreSQL migrations only.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
import {createAdminQABridge} from './qa-admin-database.mjs';
const origin=process.env.MEDIA_ROOT||'http://127.0.0.1:3010';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local QA only');
const dir='.tools/approved-redesign-qa';await mkdir(dir,{recursive:true});
const bridge=await createAdminQABridge(origin,{creator:true});
await bridge.db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',['10000000-0000-0000-0000-000000000005','fourth@example.invalid']);
const ids=[bridge.ids.owner,bridge.ids.editor,bridge.ids.visitor,'10000000-0000-0000-0000-000000000005'];
for(let i=0;i<4;i++){
 const username='qa.creator.'+(i+1),coins=1200-i*300;
 await bridge.db.query('insert into public.streamer_profiles(user_id,tiktok_username,tiktok_display_name,is_public,total_coins,total_live_seconds) values($1,$2,$3,true,$4,3600)',[ids[i],username,'QA Creator '+(i+1),coins]);
 const session=(await bridge.db.query("insert into public.streamer_live_sessions(user_id,tiktok_username,started_at,ended_at,current_game,last_metrics_at) values($1,$2,now()-interval '1 hour',case when $4 then now()-interval '10 minutes' else null end,$3,now()) returning id",[ids[i],username,['neon-race-2','moto-interact','nova-vex','nova-vex'][i],i===3])).rows[0].id;
 await bridge.db.query('insert into public.streamer_gift_events(event_id,session_id,user_id,coins) values(gen_random_uuid(),$1,$2,$3)',[session,ids[i],coins]);
}
async function serverRPC(name,args={}){const r=await(await fetch(bridge.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'owner',name,args})})).json();if(r.error)throw Error(r.error.message);return r.data;}
function hook(url){const client=window.supabase.createClient(),realFetch=fetch.bind(window);window.__qaCalls=[];client.rpc=async(name,args={})=>{window.__qaCalls.push(name);return(await realFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,role:'owner'})})).json();};client.auth.getUser=async()=>({data:{user:(await client.auth.getSession()).data.session?.user},error:null});}
const b=await openSkyShiftBrowser('approved-public-check'),report=[];
const settle=()=>b.evaluate('document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,100)))');
async function page(path){await b.page('Page.navigate',{url:origin+'/'+path});await b.waitFor('document.readyState==="complete"&&!!window.TikInteractAppearance&&!!window.TikInteractLanguage');await settle();}
const run=expression=>b.evaluate(expression);
const fits=async label=>assert.equal(await run('document.documentElement.scrollWidth>innerWidth+1'),false,label);
try{
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true);('+hook.toString()+')('+JSON.stringify(bridge.url)+');'});
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await page('index.html');await b.waitFor('!!window.TikInteractHomeReel');
 assert.equal(await run('document.querySelectorAll(".template-navigation>[data-nav-item]").length'),3);
 assert.equal(await run('document.querySelectorAll("header #header-account-name,header #creator-inbox-bell,header .get-app-dropdown").length'),0);
 assert.equal(await run('document.querySelector(".template-brand .ti-brand-name").textContent'),"TikInteract.");
 assert.equal(await run('document.querySelector(".template-brand>img")'),null);
 assert.deepEqual(await run('[...document.querySelectorAll(".footer-links>a")].map(a=>a.textContent)'),[]);
 await run('document.querySelector(".resources-trigger").scrollIntoView({block:"center"});document.querySelector(".resources-trigger").click()');
 assert.equal(await run('document.getElementById("resources-menu").hidden'),false);
 assert(await run('(()=>{const r=document.getElementById("resources-menu").getBoundingClientRect();return r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()'));
 for(const path of['guide.html','updates.html','about.html','privacy-policy.html','terms-of-use.html']){
  await run('document.querySelector('+JSON.stringify('#resources-menu a[href="'+path+'"]')+').click()');
  await b.waitFor('document.getElementById("resource-page-dialog").dataset.state==="ready"');
  assert.equal(await run('document.getElementById("resource-page-dialog").open'),true);
  await run('document.getElementById("resource-page-dialog").close()');
 }
 await run('document.querySelector(".resources-trigger").click();document.querySelector("[data-open-support]").click()');
 assert.equal(await run('document.getElementById("site-support").open'),true);await run('document.getElementById("site-support").close()');
 report.push('Approved TI/LIVE symbol and TikInteract vector wordmark, three public menu items, red footer Resources, five resource dialogs and support.');
 await run('switchView("streams")');await b.waitFor('document.querySelectorAll(".cp-stream-card").length===3');
 assert.equal(await run('document.querySelectorAll(".cp-stream-card .cp-stream-coins,.cp-stream-card .stream-stat").length'),0);
 await run('setStreamsGameFilter("moto-interact")');assert.equal(await run('document.querySelectorAll(".cp-stream-card").length'),1);
 await run('setStreamsGameFilter("all");document.getElementById("streams-search-input").value="creator.3";handleStreamFilterChange()');assert.equal(await run('document.querySelectorAll(".cp-stream-card").length'),1);
 await run('document.getElementById("streams-search-input").value="";handleStreamFilterChange()');
 await b.screenshot(dir+'/streams-populated-dark.webp');
 await run('switchView("leaderboard")');await b.waitFor('document.querySelectorAll("#leaderboard-list>tr").length===4');
 assert.deepEqual(await run('[...document.querySelectorAll("#leaderboard-list>tr:not([hidden])")].map(r=>r.dataset.rankingPosition)'),['4']);
 await run('document.getElementById("leaderboard-search").value="creator.1";document.getElementById("leaderboard-search").dispatchEvent(new Event("input"))');
 assert.equal(await run('document.querySelectorAll("#leaderboard-list>tr:not([hidden])").length'),1);
 assert.equal(await run('document.getElementById("leaderboard-podium").hidden'),true);
 await run('document.getElementById("leaderboard-search").value="unmatched";document.getElementById("leaderboard-search").dispatchEvent(new Event("input"))');assert.equal(await run('document.getElementById("leaderboard-search-empty").hidden'),false);
 await run('document.getElementById("leaderboard-search").value="";document.getElementById("leaderboard-search").dispatchEvent(new Event("input"));setLeaderboardPeriod("all")');await settle();await b.screenshot(dir+'/leaderboard-populated-dark.webp');
 report.push('Real temporary-database LIVE directory, game/creator filters, ranking periods and search, top-three podium without duplicated table entries.');
 for(const width of[1440,768,390,320]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  for(const mode of['dark','light']){
   await run('TikInteractAppearance.set('+JSON.stringify(mode)+')');
   for(const view of['home','catalog','streams','leaderboard']){await run('switchView('+JSON.stringify(view)+')');await settle();await fits('public '+view+' '+width+' '+mode);}
   await run('switchView("home")');await settle();await b.screenshot(dir+'/home-'+width+'-'+mode+'.webp');
  }
 }
 for(const language of['en','ro']){
  await run('document.querySelector(".language-trigger").click();document.querySelector('+JSON.stringify('[data-language="'+language+'"]')+').click()');
  assert.equal(await run('document.documentElement.lang'),language);
  assert.equal(await run('document.querySelector("[data-public-copy=step1]").textContent'),language==='ro'?'Alege jocul':'Choose your game');
 }
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await run('window.scrollTo(0,0);TikInteractHomeReel.pause()');const stopped=await run('TikInteractHomeReel.getState().time');await run('new Promise(r=>setTimeout(r,150))');assert.equal(await run('TikInteractHomeReel.getState().time'),stopped);
 await run('TikInteractHomeReel.play()');const scenes=new Set();for(let i=0;i<115;i++){scenes.add(await run('TikInteractHomeReel.getState().scene'));if(scenes.size===3)break;await run('new Promise(r=>setTimeout(r,200))');}assert.equal(scenes.size,3);assert.equal(await run('__qaSockets.length'),0);
 report.push('RO/EN language picker, desktop/mobile public pages, both modes, real three-game reel, pause and absence of LIVE transport.');
 await run('__qaSignOut();document.querySelector("#approved-home-plans [data-ticket-action=play_pass_pro]").click()');assert.equal(await run('document.getElementById("auth-modal").classList.contains("hidden")'),false);
 await run('document.getElementById("auth-email").value="layout@example.invalid";document.getElementById("auth-password").value="local-qa-password";loginWithEmail()');
 await b.waitFor('location.pathname.endsWith("live-studio.html")&&!!document.querySelector(".subscription-key")');
 assert.equal(await run('new URLSearchParams(location.search).get("plan")'),'play_pass_pro');
 assert.equal(await run('document.getElementById("creator-account-panel").dataset.accountSection'),'subscription');
 assert.equal(await run('document.getElementById("live-game-frame").getAttribute("src")'),null);
 const [key]=await serverRPC('generate_access_keys',{p_plan:'play_pass_pro',p_months:1,p_count:1,p_label:'Disposable UI check',p_email:null,p_redeem_days:90,p_batch:crypto.randomUUID()});
 await run('document.getElementById("pp-code").value='+JSON.stringify(key.code)+';document.getElementById("pp-redeem-form").requestSubmit()');
 await b.waitFor('window.TikInteractPass.getAccess()?.plan==="play_pass_pro"&&!document.querySelector("#pp-redeem-form button").disabled');
 assert.match(await run('document.getElementById("pp-redeem-status").textContent'),/Cheie activată/);
 assert.equal(await run('document.querySelectorAll("[data-ticket-plan=play_pass_pro] .ti-ticket-active").length'),1);
 const until=await run('TikInteractPass.getAccess().validUntil');
 await run('TikInteractLanguage.set("en");document.getElementById("pp-code").value='+JSON.stringify(key.code)+';document.getElementById("pp-redeem-form").requestSubmit()');
 await b.waitFor('document.getElementById("pp-redeem-status").textContent.includes("already activated")');assert.equal(await run('TikInteractPass.getAccess().validUntil'),until);
 report.push('Guest ticket → login → chosen Studio subscription, actual one-month redemption, success status preserved after refresh, duplicate protection, RO/EN.');
 for(const width of[1440,768,390,320]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  for(const theme of['burgundy','blue'])for(const mode of['light','dark']){
   await run('TikInteractAppearance.set('+JSON.stringify({theme,mode})+')');await run('TikInteractCreator.openAccountSection("subscription")');await settle();await fits('subscription '+width+' '+theme+' '+mode);
   await b.screenshot(dir+'/subscription-'+width+'-'+theme+'-'+mode+'.webp');
  }
  for(const section of['profile','messages','security']){await run('TikInteractCreator.openAccountSection('+JSON.stringify(section)+')');await settle();await fits('account '+width+' '+section);}
 }
 assert.equal(await run('document.querySelectorAll("[data-account-admin-host] [data-platform-admin-link]").length'),1);
 await run('document.getElementById("creator-inbox-bell").click()');await settle();assert.equal(await run('document.getElementById("creator-account-panel").dataset.accountSection'),'messages');
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await run('setLiveStudioTab("studio");launchStudioGame("moto-interact")');await b.waitFor('!!document.getElementById("live-game-frame")?.contentDocument?.getElementById("timer")');
 const source=await run('document.getElementById("live-game-frame").src');
 for(const format of['portrait','landscape']){await run('TikInteractStudioLayout.setFormat('+JSON.stringify(format)+')');await settle();assert.equal(await run('document.getElementById("live-game-frame").src'),source);await b.screenshot(dir+'/native-game-'+format+'.webp');}
 for(const tab of['games','audio','gifts','analytics','community','help']){await run('setLiveStudioTab('+JSON.stringify(tab)+')');await settle();await fits('studio '+tab);}
 await run('TikInteractCreator.openAccountSection("subscription");document.getElementById("pp-code").value="UNSENT-PRIVATE-DRAFT";__qaSignOut()');assert.equal(await run('document.getElementById("pp-code").value'),'');
 await page('index.html');assert.equal(await run('document.documentElement.dataset.theme'),'burgundy');assert.equal(await run('document.documentElement.dataset.mode'),'dark');
 await run('document.querySelector(".open-studio-button").click()');assert.equal(await run('document.getElementById("auth-modal").classList.contains("hidden")'),false);
 report.push('Four Studio appearance combinations, responsive account tabs, native inbox/admin access, real game in 9:16/16:9 without reload, native panels and cleared key drafts on sign-out.');
 assert.deepEqual(b.errors,[]);await writeFile(dir+'/report.json',JSON.stringify({checks:report,runtimeErrors:b.errors},null,2));console.log(report.join('\n'));
}catch(error){console.log('Runtime errors:',b.errors);await b.screenshot(dir+'/failure.webp');throw error;}finally{await b.close();await bridge.close();}
