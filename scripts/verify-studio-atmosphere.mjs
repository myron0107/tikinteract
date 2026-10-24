import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const b=await openSkyShiftBrowser('studio-atmosphere-review'),run=e=>b.evaluate(e);
const click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
const snapshot=()=>run('(()=>{const c=getComputedStyle(document.body);return{skin:document.documentElement.dataset.studioSkin,accent:c.getPropertyValue("--sd-accent"),rail:getComputedStyle(document.querySelector(".studio-app-rail")).backgroundImage,panel:getComputedStyle(document.getElementById("game-center-panel")).backgroundColor}})()');
async function palette(id){await click('[data-design-palette-toggle]');await b.waitFor(`!!document.querySelector('[data-design-skin="${id}"]')`);await click(`[data-design-skin="${id}"]`);await click('[data-design-palette-toggle]');await run('new Promise(requestAnimationFrame)');}
const fits='(()=>{const w=document.querySelector(".live-game-frame-wrap").getBoundingClientRect(),f=document.getElementById("live-game-frame").getBoundingClientRect();return w.height>100&&f.height>100&&f.top>=w.top-2&&f.bottom<=w.bottom+2&&f.left>=w.left-2&&f.right<=w.right+2})()';
try{
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await b.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});
 await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractWidgetDesktop&&!document.querySelector("[data-sle=edit]").disabled');
 await run('TikInteractAppearance.set({mode:"dark"});document.querySelector(".studio-workspace-switch [data-workspace=live]").click();TikInteractStudioDesign.setSkin("ice","live");TikInteractWidgetDesktop.open("games")');
 const ice=await snapshot();await palette('signal');const crimson=await snapshot();assert.equal(crimson.skin,'signal');assert.notEqual(crimson.accent,ice.accent);assert.notEqual(crimson.rail,ice.rail);assert.notEqual(crimson.panel,ice.panel);
 fs.mkdirSync('.tools/atmosphere-review',{recursive:true});await b.screenshot('.tools/atmosphere-review/crimson.webp');
 await click('.studio-workspace-switch [data-workspace=ai]');await b.waitFor('TikInteractStudioDesign.get().workspace==="ai"');await palette('orbit');assert.equal((await snapshot()).skin,'orbit');
 await click('.studio-workspace-switch [data-workspace=live]');await b.waitFor('document.documentElement.dataset.studioSkin==="signal"');
 await click('.studio-workspace-switch [data-workspace=ai]');await b.waitFor('document.documentElement.dataset.studioSkin==="orbit"');
 await b.page('Page.reload');await b.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractWidgetDesktop');
 await click('.studio-workspace-switch [data-workspace=ai]');await b.waitFor('document.documentElement.dataset.studioSkin==="orbit"');
 assert(await run('getComputedStyle(document.querySelector("[data-sw-rail-help] svg")).color===getComputedStyle(document.querySelector("[data-ai-tab=guide] svg")).color'));
 await click('[data-ai-tab=generator]');await b.waitFor('!!document.getElementById("an-prompt")');
 await click('.studio-workspace-switch [data-workspace=live]');await click('[data-studio-tab=home]');await b.waitFor('!!document.querySelector("#studio-home-panel .studio-welcome")');
 assert.equal(await run('TikInteractWidgetDesktop.getActive()'),'home');
 assert(await run('document.getElementById("studio-home-tab").nextElementSibling.id==="live-studio-tab"&&document.getElementById("live-studio-tab").nextElementSibling.classList.contains("studio-nav-divider")'));
 await b.screenshot('.tools/atmosphere-review/home-dark.webp');
 await click('#studio-home-panel [data-studio-home-go=games]');assert.equal(await run('TikInteractWidgetDesktop.getActive()'),'catalog');
 await run('launchStudioGame("nova-vex")');await b.waitFor('TikInteractWorkspaces.getMode()==="live"&&!!document.getElementById("live-game-frame").getAttribute("src")');await b.waitFor(fits);
 await run('document.querySelector("[data-sle=edit]").click()');await b.waitFor('document.querySelector(".studio-workspace").classList.contains("sle-custom")');await b.waitFor(fits);
 await run('window.__gameFrame=document.getElementById("live-game-frame");window.__gameSource=__gameFrame.src;');
 await b.screenshot('.tools/atmosphere-review/game-custom.webp');
 await palette('racing');assert(await run('document.getElementById("live-game-frame")===__gameFrame&&__gameFrame.src===__gameSource'));await b.waitFor(fits);
 await run('TikInteractStudioBackgrounds.set("arcade-hub");TikInteractAppearance.set({mode:"light"})');await b.waitFor(fits);
 const backdrop=await run('(()=>{const c=getComputedStyle(document.body,"::before");return{background:c.backgroundImage,filter:c.filter,opacity:c.opacity,panel:getComputedStyle(document.body).getPropertyValue("--sd-panel")}})()');
 assert(backdrop.background.includes('arcade-hub-light.webp'));assert(!backdrop.background.includes('239, 244, 255'));assert.equal(backdrop.filter,'none');assert.equal(backdrop.opacity,'1');
 await click('[data-studio-tab=home]');await b.screenshot('.tools/atmosphere-review/home-light.webp');
 await b.page('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await run('dispatchEvent(new Event("resize"))');
 assert(await run('document.documentElement.scrollWidth<=innerWidth+1'));await b.screenshot('.tools/atmosphere-review/mobile-light.webp');
 assert.deepEqual(b.errors,[]);console.log('Atmospheres visibly recolor menus/panels, separate LIVE/AI selections persist, Home navigation/order works, custom game iframe fits, palette changes keep the same game, and light mode keeps the background image clear.');
}finally{await b.close()}
