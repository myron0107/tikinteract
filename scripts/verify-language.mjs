// Isolated UI checks: simulated identity, no real LIVE or account writes.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
const origin=process.env.MEDIA_ROOT||'http://127.0.0.1:3005';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Language QA requires localhost.');
await mkdir('.tools/language-qa',{recursive:true});
const b=await openSkyShiftBrowser('language-menu-check');
async function pointerClick(selector,touch=false){
 const point=await b.evaluate(`(()=>{var r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 if(touch){await b.page('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await b.page('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});return;}
 await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
 await b.page('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
 await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
}
try{
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.removeItem('tikinteract-qa-auth');(${installQAAuth.toString()})(true);var qc=window.supabase.createClient();qc.auth.getUser=async()=>({data:{user:(await qc.auth.getSession()).data.session?.user||null},error:null});var oldRPC=qc.rpc.bind(qc);qc.rpc=async(name,args)=>name==='get_my_account_status'?{data:{allowed:true,state:'active',serverNow:new Date().toISOString()},error:null}:oldRPC(name,args);`});
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
 await b.page('Page.navigate',{url:origin+'/index.html'});
 await b.waitFor("window.TikInteractLanguage && document.querySelector('#header-account-name')?.textContent==='Layout test'");
 await b.evaluate("TikInteractLanguage.set('ro')");
 assert.equal(await b.evaluate("!!document.getElementById('account-status-indicator')"),false);
 assert.equal(await b.evaluate("getComputedStyle(document.querySelector('#account-menu-toggle')).borderTopWidth"),'0px');
 assert.equal(await b.evaluate("getComputedStyle(document.querySelector('.language-trigger')).backgroundColor"),'rgba(0, 0, 0, 0)');
 assert.equal(await b.evaluate("getComputedStyle(document.querySelector('#btn-login-modal')).display"),'none','Authenticated users only see their account menu');
 assert(await b.evaluate("[...document.querySelectorAll('.template-header i[class*=\"fa-\"]')].filter(i=>!i.matches('.get-app-trigger>.fa-download')).every(i=>getComputedStyle(i).color==='rgb(255, 255, 255)')"),'Header icons are white');
 assert.notEqual(await b.evaluate("getComputedStyle(document.querySelector('.get-app-trigger>.fa-download')).color"),'rgb(255, 255, 255)','GET APP retains its red download icon');
 await b.waitFor("document.querySelector('[data-language-flag]')?.naturalWidth>0");
 assert(await b.evaluate("document.querySelector('[data-language-flag]').getAttribute('src').endsWith('language-ro.svg')"));
 const pos=await b.evaluate("(()=>{var r=document.querySelector('#account-menu-toggle').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
 await b.page('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});
 await b.waitFor("getComputedStyle(document.querySelector('#account-menu-toggle')).color==='rgb(255, 255, 255)'");
 assert.equal(await b.evaluate("getComputedStyle(document.querySelector('#account-menu-toggle')).boxShadow"),'none');
 await b.evaluate("document.querySelector('#account-menu-toggle').click()");
 await b.waitFor("getComputedStyle(document.querySelector('#account-menu-toggle')).textShadow!=='none'");
 await b.screenshot('.tools/language-qa/account-hover-desktop.webp');
 await pointerClick('.language-trigger');
 assert.equal(await b.evaluate("document.querySelector('#language-menu').hidden"),false);
 await b.screenshot('.tools/language-qa/languages-desktop.webp');
 await pointerClick('[data-language="en"]');
 await b.waitFor("document.documentElement.lang==='en' && document.querySelector('[data-nav-item=\"catalog\"]').textContent.includes('GAMES')");
 assert(await b.evaluate("document.querySelector('[data-language-flag]').getAttribute('src').endsWith('language-en.svg')"));
 await b.waitFor("[...document.querySelectorAll('#language-menu .language-flag')].every(img=>img.naturalWidth>0)");
 assert.equal(await b.evaluate("localStorage.getItem('tikinteract_language')"),'en');
 assert.equal(await b.evaluate("document.querySelector('#header-account-name').textContent"),'Layout test');
 assert.equal(await b.evaluate("document.querySelector('.home-hero-copy h1').textContent.includes('Turn your LIVE into')"),true);
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:950,deviceScaleFactor:1,mobile:true});
 await b.page('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await pointerClick('.language-trigger',true);await pointerClick('[data-language="ro"]',true);
 await b.waitFor("TikInteractLanguage.get()==='ro'");
 await pointerClick('.language-trigger',true);await pointerClick('[data-language="en"]',true);
 await b.waitFor("TikInteractLanguage.get()==='en'");
 await b.page('Emulation.setTouchEmulationEnabled',{enabled:false});
 // Names matching interface vocabulary must remain untouched.
 await b.evaluate("document.querySelector('#header-account-name').textContent='Ajutor';document.querySelector('#home-leaderboard-status').textContent='Top 3 · Clasament all-time'");
 await b.waitFor("document.querySelector('#home-leaderboard-status').textContent.includes('All-time leaderboard')");
 assert.equal(await b.evaluate("document.querySelector('#header-account-name').textContent"),'Ajutor');
 for(const width of [1440,1280,1024,768,700,390,320]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<=700});
  assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth'),false,`No overflow at ${width}`);
  await b.evaluate("document.querySelector('.language-trigger').click()");
  const bounds=await b.evaluate("(()=>{var r=document.querySelector('#language-menu').getBoundingClientRect();return{left:r.left,right:r.right};})()");
  assert(bounds.left>=0&&bounds.right<=width,JSON.stringify({width,bounds}));
  assert.equal(await b.evaluate("document.querySelector('.get-app-dropdown').getBoundingClientRect().left>=document.querySelector('#account-menu-toggle').getBoundingClientRect().right"),true);
  await b.screenshot('.tools/language-qa/english-'+width+'.webp');
  await b.evaluate('TikInteractLanguage.close()');
 }
 await b.page('Page.reload');await b.waitFor("window.TikInteractLanguage?.get()==='en' && document.querySelector('[data-nav-item=\"catalog\"]')?.textContent.includes('GAMES')");
 await b.evaluate("document.querySelector('.language-trigger').focus();document.querySelector('.language-trigger').click()");
 await b.page('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown'});await b.page('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown'});
 assert.equal(await b.evaluate("document.activeElement.dataset.language"),'ro');
 await b.page('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await b.page('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
 await b.waitFor("document.documentElement.lang==='ro' && document.querySelector('[data-nav-item=\"catalog\"]').textContent.includes('JOCURI')");
 assert.equal(await b.evaluate("document.querySelector('.home-hero-copy h1').textContent.includes('Fă din LIVE-ul tău')"),true);
 for(const width of [1440,1024,768,390,320]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<=700});
  assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth'),false,`Romanian overflow at ${width}`);
 }
 await b.evaluate("document.querySelector('.language-trigger').click();document.querySelector('#account-menu-toggle').click()");
 assert.equal(await b.evaluate("document.querySelector('#language-menu').hidden"),true);
 await b.evaluate("closeAccountMenu();TikInteractLanguage.set('en')");
 await b.page('Page.navigate',{url:origin+'/live-studio.html'});
 await b.waitFor("window.TikInteractLanguage?.get()==='en' && document.querySelector('#studio-help-button')?.textContent.includes('Help')");
 for(const width of [1440,390,320]){
  await b.page('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<=700});
  assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth'),false,`Studio overflow at ${width}`);
  await b.evaluate("document.querySelector('.language-trigger').click()");
  const bounds=await b.evaluate("(()=>{var r=document.querySelector('#language-menu').getBoundingClientRect();return{left:r.left,right:r.right};})()");assert(bounds.left>=0&&bounds.right<=width,JSON.stringify({width,bounds}));
  await b.screenshot('.tools/language-qa/studio-'+width+'.webp');await b.evaluate('TikInteractLanguage.close()');
 }
 await b.evaluate("TikInteractLanguage.set('ro');__qaSignOut()");
 await b.waitFor("document.querySelector('#header-account-menu').classList.contains('hidden')");
 assert.equal(await b.evaluate("getComputedStyle(document.querySelector('#btn-login-modal')).backgroundColor"),'rgba(0, 0, 0, 0)','Visitor login matches the navigation style');
 assert.equal(await b.evaluate("document.querySelector('.language-picker').getBoundingClientRect().width>0"),true);
 assert.deepEqual(b.errors,[]);console.log('Language + navigation styling passed: flat buttons, red active account, country flags, translations, round-trip RO/EN, dynamic text, private names, persistence, keyboard, menu exclusivity, 320-1440px, Studio and sign-out.');
}catch(e){console.error(b.errors);console.error(await b.evaluate("({lang:document.documentElement.lang,width:innerWidth,scrollWidth:document.documentElement.scrollWidth})"));await b.screenshot('.tools/language-qa/failure.webp');throw e;}finally{await b.close();}
