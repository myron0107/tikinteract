// Capture the real game renderer in an isolated headless Chrome profile.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';
import {installQAAuth} from './qa-auth-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/game-gallery');
const profile = path.join(root, '.tools/race2-chrome');
await mkdir(output, {recursive: true});
await mkdir(profile, {recursive: true});
const chrome = process.env.GALLERY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const processChrome = spawn(chrome, ['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--mute-audio','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], {windowsHide: true, stdio: ['ignore','ignore','pipe']});
let socket;
try {
    const endpoint = await new Promise((resolve, reject) => {
        let stderr = '';
        const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 30000);
        processChrome.on('error', reject);
        processChrome.stderr.on('data', chunk => {
            stderr += chunk;
            const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) {clearTimeout(timer); resolve(match[1]);}
        });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {socket.once('open',resolve); socket.once('error',reject);});
    let sequence = 0;
    const pending = new Map();
    socket.on('message', buffer => {
        const message = JSON.parse(buffer.toString());
        if (message.method==='Runtime.exceptionThrown') console.error(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        if (!pending.has(message.id)) return;
        const {resolve,reject,timer} = pending.get(message.id);
        pending.delete(message.id); clearTimeout(timer);
        if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve,reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {pending.delete(id);reject(new Error(`Timed out: ${method}`));},30000);
        pending.set(id,{resolve,reject,timer});
        socket.send(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})}));
    });
    const {targetId} = await send('Target.createTarget',{url:'about:blank'});
    const {sessionId} = await send('Target.attachToTarget',{targetId,flatten:true});
    const page = (method,params) => send(method,params,sessionId);
    const evaluate = async expression => {
        const result = await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true)'});
    await page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:2,mobile:false});

    const waitFor=async expression=>{for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+expression);};
    const settle=(ms=400)=>new Promise(r=>setTimeout(r,ms));
    const assert=async(expression,message)=>{if(!await evaluate(expression))throw new Error(message);};
    for(const width of [540,390]) {
        await page('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:2,mobile:false});
        await page('Page.navigate',{url:'http://localhost:3000/GAME/NEON-INTERACT/Neon-Interact.html'});
        await waitFor("document.querySelector('#redSpeed')?.textContent.includes('KM/H') && performance.getEntriesByType('resource').filter(r=>r.name.includes('night-coupe-red.webp')||r.name.includes('night-coupe-blue.webp')).length===2");
        await settle(800);
        await assert("document.documentElement.scrollWidth<=innerWidth",'Standalone game overflows mobile');
        await assert("Math.abs(parseFloat(document.getElementById('redTelemetry').style.left)-parseFloat(document.getElementById('blueTelemetry').style.left))<.01",'Cars must start at equal distances and horizontal positions');
        await evaluate("document.querySelector('[data-team=\"0\"][data-kind=\"like25\"]').click()");
        await settle(180);
        await assert("parseInt(document.getElementById('redSpeed').textContent)>50",'Like did not accelerate RED');
        await evaluate("document.getElementById('pause').click()");await settle();
        await assert("!document.getElementById('raceOverlay').hidden && document.getElementById('overlayTitle').textContent.includes('pauz')",'Pause overlay is missing');
        const pauseShot=await page('Page.captureScreenshot',{format:'webp',quality:85});await writeFile(path.join(root,'.tools/neon-race2-pause-'+width+'.webp'),Buffer.from(pauseShot.data,'base64'));
        const first=await evaluate("document.getElementById('raceCanvas').toDataURL()");
        await settle();
        if(first!==await evaluate("document.getElementById('raceCanvas').toDataURL()"))throw new Error('Pause must freeze animation');
        await evaluate("document.getElementById('pauseResume').click();document.getElementById('giftValue').value='500';document.querySelector('[data-team=\"1\"][data-kind=\"gift\"]').click()");await settle();
        await assert("Number(document.getElementById('blueNitro').getAttribute('aria-valuenow'))>0",'Gift did not activate nitro');
        await assert("document.querySelector('#topBlue .supporter-gifts').getAttribute('aria-label')==='500 monede din cadouri' && document.querySelector('#topRed .supporter-likes').getAttribute('aria-label')==='25 like-uri'",'Top 5 must show gift coin value and separate likes');
        await evaluate("document.getElementById('resetSupporters').click()");await settle(4300);
        const shot=await page('Page.captureScreenshot',{format:'webp',quality:90,clip:{x:0,y:24,width,height:Math.ceil(width===540?960*(516/540):960*(366/540)),scale:1}});
        await writeFile(path.join(root,'.tools/neon-race2-'+width+'.webp'),Buffer.from(shot.data,'base64'));
        if(width===540){
            const image=await page('Page.captureScreenshot',{format:'webp',quality:92,clip:{x:12,y:24,width:516,height:960*(516/540),scale:1080/1032}});
            await writeFile(path.join(output,'neon-race-2-night.webp'),Buffer.from(image.data,'base64'));
            const thumb=await page('Page.captureScreenshot',{format:'webp',quality:82,clip:{x:12,y:24,width:516,height:960*(516/540),scale:360/1032}});
            await writeFile(path.join(output,'neon-race-2-night-thumb.webp'),Buffer.from(thumb.data,'base64'));
        }
        console.log('Verified standalone Neon Interact at '+width+'px: native canvas, mobile fit, likes, nitro and pause.');
    }
    await page('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
    await page('Page.navigate',{url:'http://localhost:3000/live-studio.html?game=neon-race-2'});
    await waitFor("typeof loadLiveGame==='function' && typeof initializeGameFavorites==='function'");
    await evaluate("closeAuthModal();loadLiveGame('neon-race-2')");
    await waitFor("document.getElementById('studio-test-panel').getAttribute('aria-busy')==='false' && document.querySelector('[data-test-control=pause]')");
    await assert("document.getElementById('studio-test-game-name').textContent==='Neon Interact'",'Studio game label missing');
    await assert("document.getElementById('live-game-frame').contentDocument.body.classList.contains('embedded')",'Game is not embedded');
    await assert("document.getElementById('live-game-frame').contentDocument.getElementById('testPanel').hidden",'Original test menu visible in game');
    await evaluate("document.querySelector('[data-test-control=pause]').click()");await settle();
    await assert("document.getElementById('live-game-frame').contentDocument.getElementById('roundState').textContent.includes('PAUZ')",'External pause failed');
    await evaluate("document.querySelector('[data-test-control=pause]').click();TikInteractLive.setState({connected:true,sessionId:'browser-test',username:'local-test'})");await settle();
    await evaluate("TikInteractLive.dispatch({type:'chat',message:'RED',username:'qa-viewer',displayName:'QA Viewer',sessionId:'browser-test',eventId:'join',timestamp:Date.now()})");await settle();
    await evaluate("TikInteractLive.dispatch({type:'like',likeCount:250,username:'qa-viewer',displayName:'QA Viewer',sessionId:'browser-test',eventId:'like',timestamp:Date.now()})");await settle();
    await assert("parseInt(document.getElementById('live-game-frame').contentDocument.getElementById('redSpeed').textContent)>90",'SDK like event failed');
    await evaluate("TikInteractLive.dispatch({type:'gift',coins:100,repeatCount:5,username:'qa-viewer',displayName:'QA Viewer',sessionId:'browser-test',eventId:'gift',timestamp:Date.now()})");await settle();
    await assert("Number(document.getElementById('live-game-frame').contentDocument.getElementById('redNitro').getAttribute('aria-valuenow'))>0",'SDK gift event failed');
    await assert("document.getElementById('live-game-frame').contentDocument.querySelector('#topRed .supporter-gifts').getAttribute('aria-label')==='100 monede din cadouri'",'Top 5 must show the coin value, not the number of gifts');
    await evaluate("TikInteractLive.dispatch({type:'chat',message:'BLUE',username:'coin-check',displayName:'Coin Check',sessionId:'browser-test',eventId:'coin-join',timestamp:Date.now()});TikInteractLive.dispatch({type:'gift',diamondCount:1,coins:1,repeatCount:1,username:'coin-check',sessionId:'browser-test',eventId:'coin-one',timestamp:Date.now()})");await settle();
    await assert("document.getElementById('live-game-frame').contentDocument.querySelector('#topBlue .supporter-gifts').getAttribute('aria-label')==='1 monede din cadouri'",'One coin gift must add one');
    await evaluate("TikInteractLive.dispatch({type:'gift',diamondCount:10,coins:10,repeatCount:1,username:'coin-check',sessionId:'browser-test',eventId:'coin-ten',timestamp:Date.now()})");await settle();
    await assert("document.getElementById('live-game-frame').contentDocument.querySelector('#topBlue .supporter-gifts').getAttribute('aria-label')==='11 monede din cadouri'",'A ten-coin gift must add ten, not one');
    await evaluate("for(let i=0;i<2;i++)TikInteractLive.dispatch({type:'gift',diamondCount:10,coins:30,repeatCount:3,username:'coin-check',sessionId:'browser-test',eventId:'coin-streak',timestamp:Date.now()})");await settle();
    await assert("document.getElementById('live-game-frame').contentDocument.querySelector('#topBlue .supporter-gifts').getAttribute('aria-label')==='41 monede din cadouri'",'Gift streaks must add value times count exactly once');
    await assert("document.getElementById('live-game-frame').contentDocument.getElementById('topRed').textContent.includes('QA Viewer')",'Supporter ranking missing');
    await evaluate("document.getElementById('view-live').scrollIntoView({behavior:'instant'});TikInteractLive.setState({connected:false,sessionId:null,username:null})");
    const studio=await page('Page.captureScreenshot',{format:'webp',quality:85});await writeFile(path.join(root,'.tools/neon-race2-studio.webp'),Buffer.from(studio.data,'base64'));
    console.log('Verified LIVE Studio: external TEST MENU, SDK chat/likes/gifts and real supporter ranking. No TikTok connection was opened.');
    await page('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});await settle();
    await assert("document.documentElement.scrollWidth<=innerWidth",'LIVE Studio overflows mobile');
    await assert("document.getElementById('live-game-frame').contentDocument.getElementById('shell').getBoundingClientRect().width<=540",'Embedded game did not fit');
    await evaluate("document.getElementById('live-game-frame').scrollIntoView({block:'center',behavior:'instant'})");await settle();
    const mobileStudio=await page('Page.captureScreenshot',{format:'webp',quality:85});await writeFile(path.join(root,'.tools/neon-race2-studio-mobile.webp'),Buffer.from(mobileStudio.data,'base64'));
    // A browser-only RAF clock exercises whole races without adding test hooks to the game.
    const {identifier}=await page('Page.addScriptToEvaluateOnNewDocument',{source:"(()=>{let time=1000,id=0;const callbacks=new Map();window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};window.cancelAnimationFrame=key=>callbacks.delete(key);window.__advanceRace=duration=>{for(let elapsed=0;elapsed<duration;elapsed+=100){time+=100;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(callback=>callback(time));}};})()"});
    for(const width of [540,390]){
        await page('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});
        await page('Page.navigate',{url:'http://localhost:3000/GAME/NEON-INTERACT/Neon-Interact.html'});
        await waitFor("typeof window.__advanceRace==='function' && document.getElementById('redTelemetry')?.style.left");
        await evaluate("document.fonts.ready");await settle();
        await evaluate("window.__advanceRace(100);document.getElementById('giftValue').value='500';document.querySelector('[data-team=\"1\"][data-kind=\"gift\"]').click();window.__advanceRace(120500)");
        await assert("!document.getElementById('raceOverlay').hidden && document.getElementById('overlayTitle').textContent.includes('BLUE') && !document.getElementById('resultDetails').hidden",'Finish result overlay is missing');
        await assert("document.getElementById('redResult').textContent.includes('m') && document.getElementById('blueResult').textContent.includes('puncte')",'Result distances and points are missing');
        const seconds=await evaluate("Number(document.getElementById('nextRaceSeconds').textContent)");
        if(seconds<14||seconds>15)throw new Error('Result countdown must start at 15 seconds');
        const resultShot=await page('Page.captureScreenshot',{format:'webp',quality:90});await writeFile(path.join(root,'.tools/neon-race2-finish-'+width+'.webp'),Buffer.from(resultShot.data,'base64'));
        await evaluate("window.__advanceRace(3000)");
        await assert(`Number(document.getElementById('nextRaceSeconds').textContent)===${seconds-3}`,'Result countdown is not ticking');
        await evaluate("window.__advanceRace(15000)");
        await assert("document.getElementById('raceOverlay').hidden && document.getElementById('round').textContent==='02' && Math.abs(parseFloat(document.getElementById('redTelemetry').style.left)-parseFloat(document.getElementById('blueTelemetry').style.left))<.01",'Next race did not reset to an equal start');
        console.log('Verified finish overlay, result details, 15-second countdown and equal next-round start at '+width+'px.');
    }
    await page('Page.removeScriptToEvaluateOnNewDocument',{identifier});
    await page('Page.navigate',{url:'http://localhost:3000/GAME/NEON-INTERACT/index.html'});
    await waitFor("document.querySelector('[data-gallery-featured]')?.complete");
    await assert("document.querySelector('[data-gallery-featured]').naturalWidth>0",'Presentation screenshot missing');
    await send('Browser.close');
} finally {socket?.close();processChrome.kill();}
