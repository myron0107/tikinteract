import assert from 'node:assert/strict';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';
const b=await openSkyShiftBrowser('nova-keyboard-regression'),root=process.env.MEDIA_ROOT||'http://127.0.0.1:3003';
const key=(type,key,code)=>b.page('Input.dispatchKeyEvent',{type,key,code});
async function movement(keyName,code,direction){
 await b.evaluate('g.control({action:"session.panic"});g.control({action:"session.resume"});g.sim.setSettings({autoplay:false});g.teleport(100);g.sim.player.x=g.sim.previous.x=240');
 await key('keyDown',keyName,code);await b.evaluate('g.advance(.1)');
 assert.equal(await b.evaluate('g.sim.player.x'),240+direction*42,code+' must move Nova');
 await key('keyUp',keyName,code);assert.deepEqual(await b.evaluate('g.sim.input'),{left:false,right:false});
}
try{
 await b.page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true)'});
 await b.page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await b.page('Page.navigate',{url:root+'/GAME/NOVA-VEX/Neon-Ascent.html?qa'});
 await b.waitFor('!!window.__neonAscent');await b.evaluate('window.g=__neonAscent;true');
 for(const [name,code,dir]of[['a','KeyA',-1],['d','KeyD',1],['ArrowLeft','ArrowLeft',-1],['ArrowRight','ArrowRight',1]])await movement(name,code,dir);
 assert.equal(await b.evaluate('!!document.getElementById("menu-toggle")'),false,'Settings gear must be absent; controls live in Studio');
 await b.evaluate('document.getElementById("stage").focus()');
 assert.equal(await b.evaluate('document.activeElement.id'),'stage');
 await movement('d','KeyD',1);
 console.log('Standalone: A/D, arrows, key release and game focus and removal of the settings gear passed.');
 await b.page('Page.navigate',{url:root+'/live-studio.html'});
 await b.waitFor('!!window.tikInteractUser&&typeof loadLiveGame==="function"');
 await b.evaluate('loadLiveGame("nova-vex")');await b.waitFor('!!document.getElementById("live-game-frame").contentWindow.TikInteractStudioControls');
 await b.evaluate('const f=document.getElementById("live-game-frame");f.src=f.src+"&qa"');
 await b.waitFor('!!document.getElementById("live-game-frame").contentWindow.__neonAscent');
 await b.evaluate('window.g=document.getElementById("live-game-frame").contentWindow.__neonAscent;document.getElementById("studio-test-title").tabIndex=-1;document.getElementById("studio-test-title").focus()');
 for(const [name,code,dir]of[['a','KeyA',-1],['d','KeyD',1],['ArrowLeft','ArrowLeft',-1],['ArrowRight','ArrowRight',1]])await movement(name,code,dir);
 await key('keyDown','d','KeyD');assert(await b.evaluate('g.sim.input.right'));
 await b.evaluate('document.querySelector(".studio-connection input").focus()');
 assert.deepEqual(await b.evaluate('g.sim.input'),{left:false,right:false},'Typing must release held movement');
 await key('keyDown','a','KeyA');assert.deepEqual(await b.evaluate('g.sim.input'),{left:false,right:false},'Do not hijack text fields');await key('keyUp','a','KeyA');await key('keyUp','d','KeyD');
 await b.evaluate('document.getElementById("studio-test-title").focus()');await key('keyDown','d','KeyD');
 await b.evaluate('setLiveStudioTab("games")');await new Promise(r=>setTimeout(r,50));
 assert.deepEqual(await b.evaluate('g.sim.input'),{left:false,right:false},'Leaving the workspace must release movement');await key('keyUp','d','KeyD');
 await b.evaluate('setLiveStudioTab("studio");document.getElementById("live-game-frame").scrollIntoView({block:"center"})');
 const point=await b.evaluate('(()=>{const r=document.getElementById("live-game-frame").getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()');
 await b.page('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await b.page('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
 assert.equal(await b.evaluate('document.getElementById("live-game-frame").contentDocument.activeElement.id'),'stage');
 await movement('ArrowRight','ArrowRight',1);
 console.log('Studio: A/D and arrows work with panel focus and game focus; typing and tab changes release movement.');
}finally{await b.close();}
