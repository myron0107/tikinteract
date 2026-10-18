// Capture the real game renderer in an isolated headless Chrome profile.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/game-gallery');
const profile = path.join(root, '.tools/race2-audio-chrome');
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
    const evaluate = async (expression,userGesture=true) => {
        const result = await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture});
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    await page('Page.enable');
    await page('Runtime.enable');
    await page('Page.addScriptToEvaluateOnNewDocument',{source:`
        window.__gameAudioContexts=[];
        const NativeAudioContext=window.AudioContext;
        window.AudioContext=class extends NativeAudioContext {
            constructor(...args){super(...args);window.__gameAudioContexts.push(this);}
        };
    `});
    await page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:2,mobile:false});


    await page('Page.navigate',{url:'http://localhost:3000/GAME/NEON-INTERACT/Neon-Interact.html'});
    for(let i=0;i<100;i++){if(await evaluate("!!document.getElementById('redTelemetry')?.style.left && window.__gameAudioContexts.length===1",false))break;await new Promise(r=>setTimeout(r,100));}
    if(!await evaluate("document.getElementById('sound').getAttribute('aria-pressed')==='true' && !document.getElementById('sound').disabled",false))throw new Error('Sound must be enabled by default without blocking the toggle');
    console.log('Initial autoplay state:',await evaluate("window.__gameAudioContexts[0].state",false));
    await page('Input.dispatchMouseEvent',{type:'mousePressed',x:10,y:10,button:'left',clickCount:1});
    await page('Input.dispatchMouseEvent',{type:'mouseReleased',x:10,y:10,button:'left',clickCount:1});
    for(let i=0;i<80;i++){if(await evaluate("window.__gameAudioContexts[0].state==='running'",false))break;await new Promise(r=>setTimeout(r,100));}
    if(!await evaluate("window.__gameAudioContexts[0].state==='running' && document.getElementById('sound').getAttribute('aria-pressed')==='true'",false))throw new Error('An ordinary first click must unlock blocked default audio without using the sound toggle');
    await evaluate("document.getElementById('sound').click()",false);
    await page('Input.dispatchMouseEvent',{type:'mousePressed',x:10,y:10,button:'left',clickCount:1});
    await page('Input.dispatchMouseEvent',{type:'mouseReleased',x:10,y:10,button:'left',clickCount:1});
    if(!await evaluate("document.getElementById('sound').getAttribute('aria-pressed')==='false' && window.__gameAudioContexts[0].state==='suspended'",false))throw new Error('A later interaction must respect manual mute');
    await evaluate("document.getElementById('sound').click()");
    for(let i=0;i<80;i++){if(await evaluate("window.__gameAudioContexts[0].state==='running'",false))break;await new Promise(r=>setTimeout(r,100));}
    if(!await evaluate("window.__gameAudioContexts[0].state==='running'",false))throw new Error('Sound-on must unlock the real AudioContext');
    const measurements=await evaluate('('+ (async function(){
        const {RaceAudio}=await import('/assets/neon-race2-audio.js?v=3');
        const {NeonRace2}=await import('/assets/neon-race2-engine.js?v=3');
        const rate=24000;
        const metrics=(samples,start=0,end=samples.length)=>{let square=0,peak=0;for(let i=start;i<end;i++){if(!Number.isFinite(samples[i]))throw new Error('Non-finite audio sample');square+=samples[i]*samples[i];peak=Math.max(peak,Math.abs(samples[i]));}return{rms:Math.sqrt(square/(end-start)),peak};};
        async function render(kind,levels){
            const context=new OfflineAudioContext(1,rate*3,rate),audio=new RaceAudio(context),race=new NeonRace2();
            if(levels)audio.setLevels(levels);
            await audio.setEnabled(true,race);audio.stopEffects();audio.lastCue.clear();
            if(audio.engines.length!==1)throw new Error('The mix must use one shared engine, not two overlapping motors');
            if(kind!=='engines')audio.silenceEngines();
            let buffer;
            if(kind&&kind!=='engines'){
                const ready=context.suspend(.15),rendering=context.startRendering();await ready;
                audio.playEffect(kind);await context.resume();buffer=await rendering;
            }else buffer=await context.startRendering();
            return metrics(buffer.getChannelData(0));
        }
        const sounds={};for(const kind of ['engines','nitro','boost','attack','shield','comeback','victory','gift','like','countdown','start'])sounds[kind]=await render(kind);
        const previousLevels=await render('engines',{master:80,engine:70,effects:90});
        const muted=await render('nitro',{master:0});
        const context=new OfflineAudioContext(1,rate*3,rate),audio=new RaceAudio(context),race=new NeonRace2();
        await audio.setEnabled(true,race);audio.playEffect('victory');
        const pauseAt=context.suspend(1),rendering=context.startRendering();await pauseAt;
        race.paused=true;audio.sync(race);await context.resume();
        const pausedBuffer=await rendering,paused=metrics(pausedBuffer.getChannelData(0),Math.floor(rate*1.3));
        const stressContext=new OfflineAudioContext(1,rate*3,rate),stressAudio=new RaceAudio(stressContext),stressRace=new NeonRace2();
        await stressAudio.setEnabled(true,stressRace);
        for(let i=0;i<8;i++)for(const kind of ['nitro','attack','shield','comeback','victory','gift'])stressAudio.playEffect(kind,i);
        const voices=stressAudio.voices.size,stressBuffer=await stressContext.startRendering(),stress=metrics(stressBuffer.getChannelData(0));
        return {sounds,previousLevels,engineVolumeRatio:sounds.engines.rms/previousLevels.rms,muted,paused,stress,voices};
    }).toString()+')()');
    for(const [kind,levels]of Object.entries(measurements.sounds))if(levels.rms<.0002||levels.peak>=.98)throw new Error('Bad levels for '+kind+': '+JSON.stringify(levels));
    if(measurements.engineVolumeRatio>=.5)throw new Error('The requested default engine mix must be quieter');
    if(measurements.muted.peak>.00001||measurements.paused.peak>.0001)throw new Error('Mute/pause must silence the mix');
    if(measurements.stress.peak>=.98||measurements.voices>24)throw new Error('Overlapping effects must be limited');
    console.log(JSON.stringify(measurements,null,2));
    for(let i=0;i<80;i++){if(await evaluate("document.getElementById('sound').getAttribute('aria-pressed')==='true'"))break;await new Promise(r=>setTimeout(r,100));}
    if(!await evaluate("document.getElementById('sound').getAttribute('aria-pressed')==='true' && document.getElementById('volumeMaster').value==='70' && document.getElementById('volumeEngine').value==='20' && document.getElementById('volumeEffects').value==='40'"))throw new Error('Game audio controls failed');
    await evaluate("document.getElementById('giftValue').value='500';document.querySelector('[data-team=\"0\"][data-kind=\"gift\"]').click();document.getElementById('pause').click()");
    await evaluate("document.getElementById('sound').click()");
    for(let i=0;i<80;i++){if(await evaluate("document.getElementById('sound').getAttribute('aria-pressed')==='false'"))break;await new Promise(r=>setTimeout(r,100));}
    if(!await evaluate("document.getElementById('sound').getAttribute('aria-pressed')==='false'"))throw new Error('Game sound-off control failed');
    console.log('Verified native offline audio levels, one quieter shared engine, distinct sound cues, pause/mute, limiter/polyphony and actual game controls.');
    await page('Page.navigate',{url:'http://localhost:3000/'});
    for(let i=0;i<100;i++){if(await evaluate("typeof loadLiveGame==='function'"))break;await new Promise(r=>setTimeout(r,100));}
    await evaluate("document.getElementById('view-home').classList.add('hidden');document.getElementById('view-live').classList.remove('hidden');loadLiveGame('neon-race-2')");
    for(let i=0;i<100;i++){if(await evaluate("!!document.querySelector('[data-test-control=volumeEffects]')"))break;await new Promise(r=>setTimeout(r,100));}
    if(!await evaluate("!document.getElementById('studio-test-tab-extra') && !document.querySelector('[data-studio-test-category=extra]') && document.querySelectorAll('#studio-test-tabs > button').length===2"))throw new Error('Studio must show only the available Test and Audio tabs, without Extra');
    await evaluate("selectStudioTestTab('audio')");
    for(let i=0;i<80;i++){if(await evaluate("document.getElementById('live-game-frame').contentWindow.__gameAudioContexts[0]?.state==='running'",false))break;await new Promise(r=>setTimeout(r,100));}
    if(!await evaluate("document.getElementById('live-game-frame').contentDocument.getElementById('sound').getAttribute('aria-pressed')==='true' && document.getElementById('live-game-frame').contentWindow.__gameAudioContexts[0].state==='running'",false))throw new Error('Selecting the game in Studio must start audio automatically');
    if(!await evaluate("document.querySelector('[data-test-control=volumeMaster]').value==='70' && document.querySelector('[data-test-control=volumeEngine]').value==='20' && document.querySelector('[data-test-control=volumeEffects]').value==='40'"))throw new Error('Studio must start with the requested 70/20/40 mix');
    await evaluate("const effects=document.querySelector('[data-test-control=volumeEffects]');effects.value='60';effects.dispatchEvent(new Event('input',{bubbles:true}));const engine=document.querySelector('[data-test-control=volumeEngine]');engine.value='25';engine.dispatchEvent(new Event('input',{bubbles:true}))");
    if(!await evaluate("document.getElementById('live-game-frame').contentDocument.getElementById('volumeEffects').value==='60' && document.getElementById('live-game-frame').contentDocument.getElementById('volumeEngine').value==='25' && document.querySelector('[data-test-control=volumeMaster]').value==='70'"))throw new Error('Studio mix sliders are not connected');
    await evaluate("document.querySelector('[data-test-control=sound]').click()");
    await evaluate("document.getElementById('live-game-frame').contentDocument.getElementById('reset').click()");
    if(!await evaluate("document.getElementById('live-game-frame').contentDocument.getElementById('sound').getAttribute('aria-pressed')==='false' && document.getElementById('live-game-frame').contentWindow.__gameAudioContexts[0].state==='suspended'",false))throw new Error('Studio mute must survive a new race');
    console.log('Verified default audio on when selecting the game in LIVE Studio, TEST MENU mute retained across new rounds, and separate master, engine and effects controls.');
    await send('Browser.close');
} finally {socket?.close();processChrome.kill();}
