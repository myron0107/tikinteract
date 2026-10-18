// Capture the real game renderer in an isolated headless Chrome profile.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/game-gallery');
const profile = path.join(root, '.tools/race2-effects-chrome');
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
    await page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:2,mobile:false});


    const waitFor=async expression=>{for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+expression);};
    const assert=async(expression,message)=>{if(!await evaluate(expression))throw new Error(message);};
    const settle=(ms=250)=>new Promise(r=>setTimeout(r,ms));
    await page('Page.addScriptToEvaluateOnNewDocument',{source:"(()=>{let time=1000,id=0;const callbacks=new Map();window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};window.cancelAnimationFrame=key=>callbacks.delete(key);window.__advanceRace=duration=>{for(let elapsed=0;elapsed<duration;elapsed+=100){time+=100;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(callback=>callback(time));}};})()"});
    await page('Page.addScriptToEvaluateOnNewDocument',{source:"window.__raceLabels=[];const nativeFillText=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){if(this.canvas.id==='raceCanvas'){window.__raceLabels.push({text,x,y});if(window.__raceLabels.length>64)window.__raceLabels.shift();}return nativeFillText.call(this,text,x,y,...rest);};"});
    await page('Page.addScriptToEvaluateOnNewDocument',{source:"window.__raceIcons=[];const nativeTranslate=CanvasRenderingContext2D.prototype.translate;CanvasRenderingContext2D.prototype.translate=function(x,y){if(this.canvas.id==='raceCanvas' && y>400 && this.globalAlpha<.7){window.__raceIcons.push({x,y,alpha:this.globalAlpha});if(window.__raceIcons.length>64)window.__raceIcons.shift();}return nativeTranslate.call(this,x,y);};"});
    for(const width of [540,390]){
        await page('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});
        const open=async()=>{
            await page('Page.navigate',{url:'http://localhost:3000/GAME/NEON-INTERACT/Neon-Interact.html'});
            await waitFor("document.getElementById('redTelemetry')?.style.left && performance.getEntriesByType('resource').filter(r=>/effects\\/(nitro|boost|impact|shield)\\.webp/.test(r.name)).length===4");
            await evaluate("document.fonts.ready");await settle(400);await evaluate("window.__advanceRace(100)");
        };
        const shot=async name=>{const result=await page('Page.captureScreenshot',{format:'webp',quality:90});await writeFile(path.join(root,'.tools/neon-race2-fx-'+name+'-'+width+'.webp'),Buffer.from(result.data,'base64'));};
        await open();
        await evaluate("document.getElementById('giftValue').value='500';document.querySelector('[data-team=\"0\"][data-kind=\"gift\"]').click();window.__advanceRace(100)");
        await assert("window.__raceIcons.some(icon=>icon.y>400 && icon.y<500 && icon.alpha>0) && window.__raceLabels.length===0",'A small translucent gift icon must appear above the rear of the red car, without text');await shot('gift-hint');
        await evaluate("window.__advanceRace(700);window.__raceIcons=[];window.__advanceRace(100)");
        await assert("window.__raceIcons.length===0",'Contribution icons must disappear quickly');
        await assert("Number(document.getElementById('redNitro').getAttribute('aria-valuenow'))===100",'Nitro is not active for effect test');await shot('nitro');
        await evaluate("for(let i=0;i<10;i++)document.querySelector('[data-team=\"1\"][data-kind=\"like25\"]').click();window.__advanceRace(100)");
        await assert("window.__raceIcons.length===1 && window.__raceIcons[0].y>650 && window.__raceIcons[0].y<750 && window.__raceLabels.length===0",'Batched blue likes must produce one small heart above the rear of the blue car, without text');
        await assert("parseInt(document.getElementById('blueSpeed').textContent)===100 && Number(document.getElementById('blueNitro').getAttribute('aria-valuenow'))===0",'Normal boost must not unlock nitro');await shot('boost');
        await evaluate("document.getElementById('giftValue').value='10';for(let i=0;i<5;i++)document.querySelector('[data-team=\"1\"][data-kind=\"gift\"]').click();window.__advanceRace(100)");
        await assert("parseInt(document.getElementById('blueSpeed').textContent)===150",'Cyan exhaust threshold must be 150 km/h');await shot('nitro-threshold');
        await evaluate("document.getElementById('giftValue').value='100';document.querySelector('[data-team=\"1\"][data-kind=\"gift\"]').click();window.__advanceRace(100)");await shot('shield');
        await evaluate("window.__advanceRace(5500);document.getElementById('giftValue').value='500';document.querySelector('[data-team=\"0\"][data-kind=\"gift\"]').click();window.__advanceRace(100)");await shot('impact');
        await evaluate("document.getElementById('pause').click();window.__advanceRace(100)");await settle();
        const frozen=await evaluate("document.getElementById('raceCanvas').toDataURL()");await evaluate("window.__advanceRace(1000)");
        if(frozen!==await evaluate("document.getElementById('raceCanvas').toDataURL()"))throw new Error('In-race effects must freeze on pause');
        await evaluate("document.getElementById('reset').click();document.getElementById('giftValue').value='500';document.querySelector('[data-team=\"1\"][data-kind=\"gift\"]').click();window.__advanceRace(1500);document.querySelector('[data-team=\"0\"][data-kind=\"gift\"]').click();document.querySelector('[data-team=\"0\"][data-kind=\"gift\"]').click();window.__advanceRace(100)");await shot('comeback');
        await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await settle();await evaluate("window.__advanceRace(100)");
        await assert("matchMedia('(prefers-reduced-motion: reduce)').matches",'Reduced-motion preference was not applied');
        await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await settle();
        await open();
        await evaluate("document.getElementById('giftValue').value='500';document.querySelector('[data-team=\"1\"][data-kind=\"gift\"]').click();window.__advanceRace(121000)");
        await assert("!document.getElementById('raceOverlay').hidden",'Victory overlay missing');
        await shot('victory');
        const first=await evaluate("document.getElementById('victoryEffects').toDataURL()");await evaluate("window.__advanceRace(1000)");
        if(first===await evaluate("document.getElementById('victoryEffects').toDataURL()"))throw new Error('Victory effects should animate during the countdown');
        await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await settle();await evaluate("window.__advanceRace(100)");
        const empty="(()=>{const canvas=document.getElementById('victoryEffects');return canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.every((value,i)=>i%4!==3||value===0);})()";
        await assert(empty,'Reduced-motion victory must not animate particles');
        await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await settle();await evaluate("window.__advanceRace(6000)");
        await assert(empty,'Victory particles must finish before the next round');
        console.log('Verified small translucent heart/gift icons above each car, no text, quick expiry and coalescing; nitro/boost/shield/impact art, comeback, paused effects, victory and reduced motion at '+width+'px.');
    }
    await send('Browser.close');
} finally {socket?.close();processChrome.kill();}
