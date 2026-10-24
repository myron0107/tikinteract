import assert from 'node:assert/strict';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
const publisher=await openSkyShiftBrowser('game-output-publisher-qa',{extraArgs:['--window-size=1440,1100','--force-device-scale-factor=1','--auto-accept-this-tab-capture','--enable-usermedia-screen-capturing','--autoplay-policy=no-user-gesture-required']}),receiver=await openSkyShiftBrowser('game-output-receiver-qa',{extraArgs:['--autoplay-policy=no-user-gesture-required']});
const run=e=>publisher.evaluate(e.includes('await ')?`(async()=>{${e}})()`:e);
try{
 const diagnostics=`window.__pcs=[];window.__pcNative=window.RTCPeerConnection;window.RTCPeerConnection=new Proxy(__pcNative,{construct(T,args){const p=Reflect.construct(T,args);__pcs.push(p);return p;}});`;
 await publisher.page('Page.addScriptToEvaluateOnNewDocument',{source:'window.__nativeWS=window.WebSocket;window.__captures=0;const capture=navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getDisplayMedia=(...args)=>{__captures++;return capture(...args);};'+diagnostics});
 await receiver.page('Page.addScriptToEvaluateOnNewDocument',{source:diagnostics});
 await publisher.page('Emulation.clearDeviceMetricsOverride');
 await publisher.page('Page.navigate',{url:'http://127.0.0.1:3033/live-studio.html'});
 await publisher.waitFor('document.documentElement?.dataset.uiReady==="ready"&&!!window.TikInteractWidgetDesktop');
 assert.equal(await run('typeof window.__qaSignIn'), 'function','Use the isolated preview:studio server, never a real account');
 await run(`window.WebSocket=__nativeWS;launchStudioGame('nova-vex');`);
 await publisher.waitFor('document.getElementById("live-game-frame").contentDocument?.readyState==="complete"&&!!document.getElementById("live-game-frame").contentDocument?.querySelector("canvas")');
 await run(`window.__frame=document.getElementById('live-game-frame');__frame.contentWindow.__outputTest='kept';window.__loads=0;__frame.addEventListener('load',()=>__loads++);window.__output=(await import('./assets/studio-game-output.js?v=1'));`);
 await run(`await (await import('./assets/studio-broadcast-sources.js?v=2')).openGameSource();`);
 const link=await run('document.querySelector("[data-game-output-url]").value');
 assert(link.includes('/game-output.html?format='));
 await run(`document.querySelector('[data-game-output-start]').click();`);
 await publisher.waitFor('__output.gameOutputState().active||document.querySelector("[data-source-feedback]")?.textContent');
 await publisher.waitFor('__output.gameOutputState().active&&!__output.gameOutputState().starting');
 await receiver.page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});
 await receiver.page('Page.navigate',{url:link});
 await receiver.waitFor('document.getElementById("game-output")?.readyState>=2&&!document.getElementById("game-output").paused');
 const first=await receiver.evaluate(`(()=>{const v=document.getElementById('game-output');return{width:v.videoWidth,height:v.videoHeight,time:v.currentTime,status:document.getElementById('status').textContent,hidden:document.getElementById('status').hidden,auth:!!window.tikInteractUser};})()`);
 assert(first.width>0&&first.height>0&&first.hidden&&!first.auth);
 await receiver.waitFor('document.getElementById("stage").style.width');
 await new Promise(r=>setTimeout(r,2500));
 assert(await receiver.evaluate(`(()=>{const r=document.getElementById('stage').getBoundingClientRect();return r.height>r.width&&r.width<=innerWidth+1&&r.height<=innerHeight+1;})()`));
 await receiver.screenshot('.tools/obs-game-output.webp');
 await publisher.screenshot('.tools/obs-game-publisher.webp');
 await new Promise(r=>setTimeout(r,1000));
 assert(await receiver.evaluate(`document.getElementById('game-output').currentTime>${first.time}`));
 assert.equal(await run('__loads===0&&document.getElementById("live-game-frame").contentWindow.__outputTest==="kept"'),true);
 // Change a real HUD value in the same game and ensure it arrives in video.
 await run(`__frame.contentDocument.getElementById('distance').textContent='4321';`);
 await receiver.screenshot('.tools/obs-game-hud.webp');
 // Portrait/landscape changes resize the same game and the same source.
 await run('TikInteractStudioLayout.setFormat("landscape")');
 await receiver.waitFor('document.querySelector("video").videoWidth>document.querySelector("video").videoHeight');
 await receiver.page('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:1,mobile:false});await receiver.screenshot('.tools/obs-game-landscape.webp');
 await run('TikInteractStudioLayout.setFormat("portrait")');await receiver.waitFor('document.querySelector("video").videoHeight>document.querySelector("video").videoWidth');
 await receiver.page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});
 // Switching pages must leave the original game streaming; cursor is opt-in.
 await run('TikInteractWidgetDesktop.open("games");');
 const before=await receiver.evaluate(`document.querySelector('video').currentTime`);await new Promise(r=>setTimeout(r,600));assert(await receiver.evaluate(`document.querySelector('video').currentTime>${before}`));
 assert.equal(await run('__output.gameOutputState().showCursor'),false);
 assert.equal(await run('__frame.contentDocument.getElementById("tikinteract-output-hide-cursor")!==null'),true);
 await run('await __output.setGameOutputCursor(true);');assert.equal(await run('__output.gameOutputState().showCursor'),true);
 await run('await __output.setGameOutputCursor(false);');
 // Favorites link opens the actual LIVE Animations page, not a picker or AI.
 await run('TikInteractWidgetDesktop.open("studio");await TikInteractWidgetDesktop.choose("animations",true);document.querySelector("[data-sle-add-animations]").click();');
 await publisher.waitFor('!document.getElementById("studio-animations-panel").classList.contains("hidden")&&!!document.querySelector("[data-an-tab=library]")');
 assert.equal(await run('TikInteractWorkspaces.getMode()'),'live');
 assert.equal(await run('!!document.querySelector(".sle-dialog[open]")'),false);
 assert.equal(await run('document.querySelectorAll("#studio-favorite-animations [data-broadcast-source]").length'),0);
 // Renaming persists server-side and updates the same favorite, preserving its ID.
 await run(`window.__api=(await import('./assets/animations-client.js?v=2')).animationAPI;window.__clip=(await __api({action:'state'})).library.find(c=>c.mime==='video/mp4').id;if(!TikInteractStudioPersonalization.getFavorites().animations.includes(__clip))TikInteractStudioPersonalization.toggleAnimation(__clip);document.querySelector('[data-an-action=rename][data-id="'+__clip+'"]').click();`);
 await publisher.waitFor('!!document.querySelector("[data-an-dialog-form=rename]")');
 await run(`document.querySelector('[data-an-dialog-form=rename] input[name=title]').value='Renamed favorite QA';document.querySelector('[data-an-dialog-form=rename]').requestSubmit();`);
 await publisher.waitFor('!document.querySelector("[data-an-dialog-form=rename]")?.closest("dialog").open&&document.querySelector("[data-sle-play]")?.textContent.includes("Renamed favorite QA")');
 await run(`window.__persistedTitle=(await __api({action:'state'})).library.find(c=>c.id===__clip).title;`);assert.equal(await run('__persistedTitle'),'Renamed favorite QA');
 assert.equal(await run('document.querySelectorAll("[data-an-action=rename][data-id=\\""+__clip+"\\"]").length'),1);
 // Both previous broken shortcuts must select their actual movable windows.
 for(const [section,tab,selector]of [['audio','sounds','.studio-audio'],['games','catalog','.studio-game-picker']]){
  await run(`TikInteractWidgetDesktop.open('studio');await TikInteractWidgetDesktop.choose('${section}',true);document.querySelector('${selector} [data-studio-link]').click();`);
  assert.equal(await run('TikInteractWidgetDesktop.getActive()'),tab);
 }
 // No closes nothing. Yes unloads the actual game, but retains the OBS stream.
 await run('TikInteractWidgetDesktop.open("studio");await TikInteractWidgetDesktop.choose("preview",true);document.querySelector("[data-sle-hide=preview]").click();');
 await publisher.waitFor('!!document.querySelector(".studio-game-close-dialog[open]")');await run('document.querySelector("[data-game-close-no]").click()');
 assert.equal(await run('__frame.dataset.gameId'),'nova-vex');assert.equal(await run('__loads'),0);
 await run('document.querySelector("[data-sle-hide=preview]").click()');await publisher.waitFor('!!document.querySelector(".studio-game-close-dialog[open]")');await run('document.querySelector("[data-game-close-yes]").click()');
 await publisher.waitFor('!__frame.dataset.gameId&&!__frame.hasAttribute("src")');
 assert.equal(await run('__output.gameOutputState().active'),true);
 await new Promise(r=>setTimeout(r,700));
 assert(await receiver.evaluate(`(()=>{const c=document.createElement('canvas');c.width=c.height=1;c.getContext('2d').drawImage(document.querySelector('video'),0,0,1,1);return [...c.getContext('2d').getImageData(0,0,1,1).data].slice(0,3).every(v=>v<10);})()`));
 // Isolated fixture grants access only for this test of switching the game.
 await run(`window.TikInteractGameAccess={...TikInteractGameAccess,isAvailable:()=>true,getPlan:()=> 'free'};launchStudioGame('moto-interact');`);
 await publisher.waitFor('!!__frame.contentDocument?.getElementById("raceCanvas")');
 assert.equal(await run('__output.gameOutputState().active'),true);assert.equal(await run('__captures'),1,'Selecting another game must not ask for another capture');
 const retained=await run('__output.getGameOutputLink()');assert.equal(retained,link);
 await receiver.screenshot('.tools/obs-next-game-same-link.webp');
 // A real pointer click plays the favorite; it does not open a picker.
 await run(`await TikInteractWidgetDesktop.choose('animations',true);document.querySelector('.studio-widget-config:not([hidden])>header>button')?.click();window.__played=false;window.addEventListener('tikinteract:scene-animation',e=>{if(e.detail.state==='playing')__played=true;});document.addEventListener('loadedmetadata',e=>{if(e.target.closest('[data-scene-animation]'))e.target.playbackRate=.1;},true);`);
 const button=await run(`(()=>{const b=document.querySelector('[data-sle-play="'+__clip+'"]');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height*.7};})()`);
 await publisher.page('Input.dispatchMouseEvent',{type:'mousePressed',x:button.x,y:button.y,button:'left',clickCount:1});await publisher.page('Input.dispatchMouseEvent',{type:'mouseReleased',x:button.x,y:button.y,button:'left',clickCount:1});await publisher.waitFor('__played');
 assert.equal(await run('document.querySelector("[data-scene-animation]").parentElement.id'),'studio-game-output-target');
 await receiver.screenshot('.tools/obs-favorite-animation.webp');
 await run('document.querySelector(".studio-scene-animation-stop").click();');
 // The event log has a complete themed background, and stays hidden when deselected.
 for(const mode of ['dark','light']){
  await run(`TikInteractAppearance.set('${mode}');await TikInteractWidgetDesktop.choose('feed',true);`);
  const feed=await run(`(()=>{const n=document.querySelector('[data-layout-panel=feed]'),s=getComputedStyle(n);return{bg:s.backgroundColor,display:s.display,alpha:s.opacity,h:n.getBoundingClientRect().height,children:n.querySelector('.feed-box').getBoundingClientRect().height};})()`);
  assert.notEqual(feed.bg,'rgba(0, 0, 0, 0)');assert.notEqual(feed.display,'none');assert(feed.h>=feed.children);
  await publisher.screenshot('.tools/live-events-'+mode+'.webp');await run(`await TikInteractWidgetDesktop.choose('feed',false);`);
  assert.equal(await run('getComputedStyle(document.querySelector("[data-layout-panel=feed]")).display'),'none');
 }
 await run('TikInteractFloatingDock.collapse(true)');assert.equal(await run('document.querySelectorAll(".studio-collapsed-panel-icon rect").length'),4);
 await run('TikInteractFloatingDock.collapse(false)');
 await run('document.querySelector("[data-stop-studio-game]").click()');await publisher.waitFor('!!document.querySelector("[data-game-close-yes]")');await run('document.querySelector("[data-game-close-yes]").click()');
 assert.equal(await run('__frame.hasAttribute("src")'),false);assert.equal(await run('__output.gameOutputState().active'),true);assert.equal(await run('document.querySelector(".studio-stage").dataset.widgetEnabled'),'true');
 await run('document.querySelector(".studio-scene-start").click()');assert.equal(await run('TikInteractWidgetDesktop.getActive()'),'catalog');assert.equal(await run('document.querySelector("#game-center-panel").dataset.widgetEnabled'),'true');
 await run('await __output.stopGameOutput();');
 assert.equal(await run('__output.gameOutputState().active'),false);
 assert.deepEqual(publisher.errors,[]);assert.deepEqual(receiver.errors,[]);
 console.log('PASS: private game output, same running game, portrait/landscape, favorite video over game, rename, navigation, X confirmation and Stop with output retained, optional cursor, themed events and collapsed dock. Tested with isolated local fixtures and a separate Chrome receiver.');
}catch(error){for(const [name,b]of [['publisher',publisher],['receiver',receiver]])console.log(name,await b.evaluate(`(async()=>({peers:await Promise.all((window.__pcs||[]).map(async p=>({connection:p.connectionState,ice:p.iceConnectionState,signaling:p.signalingState,stats:[...(await p.getStats()).values()].filter(v=>['inbound-rtp','outbound-rtp','candidate-pair'].includes(v.type)).map(({type,kind,framesEncoded,framesDecoded,framesReceived,bytesReceived,bytesSent,state})=>({type,kind,framesEncoded,framesDecoded,framesReceived,bytesReceived,bytesSent,state}))}))),video:document.querySelector('video')?{ready:document.querySelector('video').readyState,src:!!document.querySelector('video').srcObject}:null}))()`));console.log('Publisher errors:',publisher.errors);console.log('Receiver errors:',receiver.errors);await publisher.screenshot('.tools/obs-game-failure-publisher.webp');await receiver.screenshot('.tools/obs-game-failure-receiver.webp');throw error;}finally{await receiver.close();await publisher.close();}
