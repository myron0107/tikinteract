// Capture the real game renderer in an isolated headless Chrome profile.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/game-gallery');
const profile = path.join(root, '.tools/moto-qa-chrome');
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
    const settle=(ms=400)=>new Promise(r=>setTimeout(r,ms));
    const assert=async(expression,message)=>{if(!await evaluate(expression))throw new Error(message);};

    await page('Page.addScriptToEvaluateOnNewDocument',{source:`
        (()=>{let time=1000,id=0;const callbacks=new Map();window.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};window.cancelAnimationFrame=key=>callbacks.delete(key);
        window.__advanceRace=duration=>{for(let elapsed=0;elapsed<duration;elapsed+=100){time+=100;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(time));}};})();
        window.__laneBands=[];const nativeFillRect=CanvasRenderingContext2D.prototype.fillRect;
        CanvasRenderingContext2D.prototype.fillRect=function(x,y,width,height){
            if(this.canvas.id==='raceCanvas' && x===0 && width===1200 && y>=392 && height>100 && height<400){window.__laneBands.push({top:y,height});if(window.__laneBands.length>2)window.__laneBands.shift();}
            return nativeFillRect.call(this,x,y,width,height);
        };
        window.__motoDraws={};window.__motoJets=[];window.__sceneryLayers={};const nativeDrawImage=CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
            if(image.src?.endsWith('/scenery/day-boulevard.webp') && args.length===8 && (args[1]===0||args[1]===414)){
                const transform=this.getTransform();window.__sceneryLayers[args[1]]={x:transform.e,scale:transform.a};
            }
            if(image.src?.endsWith('/scenery/day-boulevard.webp') && args.length===8 && args[4]===0 && args[5]>=438 && args[6]===1200 && args[7]>100 && args[7]<400){
                window.__laneBands.push({top:args[5],height:args[7]});if(window.__laneBands.length>2)window.__laneBands.shift();
            }
            if(image.src?.endsWith('/effects/nitro.webp') && args.length===4 && this.canvas.id==='raceCanvas'){
                const transform=this.getTransform(),[x,y,w,h]=args;
                const tip=transform.transformPoint(new DOMPoint(x+w-2,y+h/2));
                window.__motoJets.push({x:tip.x,y:tip.y,angle:-Math.atan2(transform.b,transform.a)*180/Math.PI});
                if(window.__motoJets.length>2)window.__motoJets.shift();
            }
            const team=image.src?.match(/sport-(red|blue)-v2\\.webp/)?.[1];
            if(team && args.length===4 && this.canvas.id==='raceCanvas'){
                const transform=this.getTransform(),meta=window.__bikeMetadata?.find(item=>item.team===team),[x,y,w,h]=args;
                const record={angle:-Math.atan2(transform.b,transform.a)*180/Math.PI};
                if(meta){const rear=transform.transformPoint(new DOMPoint(x+meta.contact.x*w,y+meta.contact.y*h));const front=transform.transformPoint(new DOMPoint(x+meta.wheels[1].x*w,y+meta.contact.y*h));const exhaust=transform.transformPoint(new DOMPoint(x+meta.exhaust.x*w,y+meta.exhaust.y*h));Object.assign(record,{rearY:rear.y,frontY:front.y,exhaust:{x:exhaust.x,y:exhaust.y},ground:(team==='red'?649:880)*this.canvas.height/900});}
                window.__motoDraws[team]=record;
            }
            return nativeDrawImage.call(this,image,...args);
        };
    `});
    const uiProfile=()=>({
        blocks:[...document.querySelectorAll('.race-heading,.race-dashboard,.night-track,.race-community,.race-footer')].map(element=>{const rect=element.getBoundingClientRect(),shell=document.getElementById('shell').getBoundingClientRect();return{x:rect.x-shell.x,y:rect.y-shell.y,width:rect.width,height:rect.height};}),
        styles:['.race-heading h1','.race-heading em','.track-label','.lane-status','.car-nitro','.team-rankings h2'].map(selector=>{const style=getComputedStyle(document.querySelector(selector));return{font:style.font,color:style.color,background:style.backgroundColor};}),
        road:(()=>{const canvas=document.getElementById('raceCanvas');return [...canvas.getContext('2d').getImageData(Math.round(1100*canvas.width/1200),Math.round(500*canvas.height/900),1,1).data];})()
    });
    await page('Emulation.setDeviceMetricsOverride',{width:540,height:1080,deviceScaleFactor:1,mobile:false});
    await page('Page.navigate',{url:'http://localhost:3000/GAME/NEON-INTERACT/Neon-Interact.html'});
    await waitFor("document.querySelector('#redTelemetry')?.style.left");await evaluate('document.fonts.ready');await settle(300);await evaluate('window.__advanceRace(200)');
    const originalUi=await evaluate('('+uiProfile.toString()+')()');
    await assert("window.__laneBands.length===2 && window.__laneBands[0].height===window.__laneBands[1].height && window.__laneBands[0].top+window.__laneBands[0].height===window.__laneBands[1].top",'Neon Interact must render equal lanes');
    for(const width of [540,390]){
        await page('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});
        await page('Page.navigate',{url:'http://localhost:3000/GAME/MOTO-INTERACT/Moto-Interact.html'});
        await waitFor("document.querySelector('#redTelemetry')?.style.left && performance.getEntriesByType('resource').filter(r=>/moto-interact\\/(bikes|scenery)\\/.+\\.webp/.test(r.name)).length===3");
        await evaluate("document.fonts.ready");await settle(400);
        await evaluate("fetch('/assets/moto-interact/bikes/manifest.json').then(r=>r.json()).then(data=>window.__bikeMetadata=data)");
        await evaluate("window.__advanceRace(200)");
        await assert("window.__laneBands.length===2 && window.__laneBands[0].height===window.__laneBands[1].height && window.__laneBands[0].top+window.__laneBands[0].height===window.__laneBands[1].top",'Moto Interact must render equal lanes');
        if(width===540){
            const copyUi=await evaluate('('+uiProfile.toString()+')()');
            if(JSON.stringify(copyUi.blocks)!==JSON.stringify(originalUi.blocks)||JSON.stringify(copyUi.styles.map(style=>style.font))!==JSON.stringify(originalUi.styles.map(style=>style.font)))throw new Error('The daylight palette must preserve the original interface layout and typography');
        }
        await assert("performance.getEntriesByType('resource').some(resource=>resource.name.includes('/scenery/day-boulevard.webp')) && getComputedStyle(document.documentElement).colorScheme==='light'",'Moto must use the approved boulevard and daylight HUD palette');
        await assert("document.querySelector('h1').textContent==='MOTO INTERACT' && document.documentElement.scrollWidth<=innerWidth",'Moto title/mobile fit failed');
        await assert("getComputedStyle(document.querySelector('.lane-status>strong')).fontSize==='14px' && getComputedStyle(document.querySelector('.lane-status>span')).fontSize==='7px' && getComputedStyle(document.querySelector('.car-nitro')).width==='58px'",'Motorcycle telemetry must stay compact');
        await assert("Math.abs(window.__motoDraws.red.angle)<.01 && Math.abs(window.__motoDraws.blue.angle)<.01",'Both motorcycles must start flat');
        await assert("Math.abs(window.__motoDraws.red.rearY-window.__motoDraws.red.ground)<.05 && Math.abs(window.__motoDraws.blue.rearY-window.__motoDraws.blue.ground)<.05",'Rear tires must start grounded');
        const screenshot=async(name,gallery=false)=>{
            const rect=await evaluate("(()=>{const r=document.getElementById('shell').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()");
            const shot=await page('Page.captureScreenshot',{format:'webp',quality:90,clip:{...rect,scale:1}});
            await writeFile(path.join(root,'.tools/moto-interact-'+name+'-'+width+'.webp'),Buffer.from(shot.data,'base64'));
            if(gallery){
                for(const [file,targetWidth,quality]of [['moto-interact-day.webp',1080,92],['moto-interact-day-thumb.webp',360,85]]){
                    const image=await page('Page.captureScreenshot',{format:'webp',quality,clip:{...rect,scale:targetWidth/rect.width}});
                    await writeFile(path.join(output,file),Buffer.from(image.data,'base64'));
                }
            }
        };
        await screenshot('normal');
        const sceneryBefore=await evaluate('JSON.stringify(window.__sceneryLayers)');
        await evaluate('window.__advanceRace(1800)');
        if(sceneryBefore===await evaluate('JSON.stringify(window.__sceneryLayers)'))throw new Error('The boulevard must visibly move during a race');
        await screenshot('moving');
        await evaluate("document.getElementById('giftValue').value='10';for(let i=0;i<5;i++)document.querySelector('[data-team=\"0\"][data-kind=\"gift\"]').click();window.__advanceRace(500)");
        await assert("parseInt(document.getElementById('redSpeed').textContent)===100 && Math.abs(window.__motoDraws.red.angle)<.01",'Ordinary gifts must not trigger a wheelie');
        await evaluate("document.getElementById('reset').click();document.getElementById('giftValue').value='100';document.querySelector('[data-team=\"0\"][data-kind=\"gift\"]').click();document.getElementById('resetSupporters').click();window.__advanceRace(800)");
        await assert("parseInt(document.getElementById('redSpeed').textContent)===200 && window.__motoDraws.red.angle>24 && window.__motoDraws.red.angle<26.1",'Nitro must visibly lift the front wheel');
        await assert("Math.abs(window.__motoDraws.red.rearY-window.__motoDraws.red.ground)<.05 && window.__motoDraws.red.frontY<window.__motoDraws.red.rearY-15",'Wheelie must retain rear contact while raising the front');
        await assert("(()=>{const jet=window.__motoJets.at(-1),bike=window.__motoDraws.red;return Math.hypot(jet.x-bike.exhaust.x,jet.y-bike.exhaust.y)<.1 && Math.abs(jet.angle-bike.angle)<.1 && jet.y<bike.rearY-10;})()",'Nitro must attach to the tail outlet above the rear wheel and follow the wheelie angle');
        await screenshot('nitro',width===540);
        if(width===540){
            const rect=await evaluate("(()=>{const r=document.querySelector('.night-track').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};})()");
            const closeup=await page('Page.captureScreenshot',{format:'webp',quality:95,clip:{...rect,scale:2}});
            await writeFile(path.join(root,'.tools/moto-interact-exhaust.webp'),Buffer.from(closeup.data,'base64'));
        }
        const full=await evaluate("window.__motoDraws.red.angle");
        const sceneryAtPause=await evaluate('JSON.stringify(window.__sceneryLayers)');
        await evaluate("document.getElementById('pause').click();window.__advanceRace(1000)");
        await assert("!document.getElementById('raceOverlay').hidden",'Pause overlay missing');
        if(Math.abs(full-await evaluate("window.__motoDraws.red.angle"))>.001)throw new Error('Wheelie must freeze during pause');
        if(sceneryAtPause!==await evaluate('JSON.stringify(window.__sceneryLayers)'))throw new Error('Scenery must freeze during pause');
        await evaluate("document.getElementById('pauseResume').click();window.__advanceRace(1200)");
        const fading=await evaluate("window.__motoDraws.red.angle");
        if(!(fading>0&&fading<full))throw new Error('Wheelie should lower progressively with speed');
        await assert("(()=>{const jet=window.__motoJets.at(-1),bike=window.__motoDraws.red;return Math.hypot(jet.x-bike.exhaust.x,jet.y-bike.exhaust.y)<.1 && Math.abs(jet.angle-bike.angle)<.1;})()",'Nitro must remain attached during landing');
        await screenshot('lowering');
        await evaluate("window.__advanceRace(600)");
        const lower=await evaluate("window.__motoDraws.red.angle");
        if(!(lower>0&&lower<fading))throw new Error('Wheelie lowering must be continuous');
        await evaluate("window.__advanceRace(2400)");
        await assert("window.__motoDraws.red.angle<.1 && Math.abs(window.__motoDraws.red.rearY-window.__motoDraws.red.ground)<.05",'Bike must settle flat without floating');
        await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await settle(50);
        await evaluate("document.getElementById('reset').click();document.querySelector('[data-team=\"1\"][data-kind=\"gift\"]').click();window.__advanceRace(200)");
        await assert("window.__motoDraws.blue.angle>25",'Reduced-motion mode must retain the gameplay wheelie pose');
        const reducedScenery=await evaluate('JSON.stringify(window.__sceneryLayers)');
        await evaluate('window.__advanceRace(300)');
        if(reducedScenery!==await evaluate('JSON.stringify(window.__sceneryLayers)'))throw new Error('Reduced-motion scenery must remain still');
        await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
        console.log('Verified Moto Interact at '+width+'px: generated daylight art, flat starts, nitro wheelie, grounded rear tire, gradual lowering, pause and reduced motion.');
    }
    await page('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await page('Page.navigate',{url:'http://localhost:3000/'});
    await waitFor("typeof loadLiveGame==='function' && typeof initializeGameFavorites==='function'");
    await assert("document.querySelector('[data-game-center-card*=\"Moto Interact\"] img').getAttribute('src').includes('moto-interact-day') && document.querySelector('#live-game-select option[value=moto-interact]').textContent==='Moto Interact'",'Moto catalog/Studio entry missing');
    await evaluate("document.getElementById('view-home').classList.add('hidden');document.getElementById('view-live').classList.remove('hidden');loadLiveGame('moto-interact')");
    await waitFor("document.getElementById('studio-test-panel').getAttribute('aria-busy')==='false' && document.querySelector('[data-test-control=giftValue]')");
    await assert("document.getElementById('studio-test-game-name').textContent==='Moto Interact' && !document.getElementById('studio-test-tab-extra')",'Moto external test controls failed');
    await evaluate("TikInteractLive.setState({connected:true,username:'local-test',sessionId:'moto-browser-test'})");await settle(100);
    await evaluate("TikInteractLive.dispatch({type:'chat',message:'RED',username:'moto-red',sessionId:'moto-browser-test',eventId:'join-red',timestamp:Date.now()});TikInteractLive.dispatch({type:'chat',message:'BLUE',username:'moto-blue',sessionId:'moto-browser-test',eventId:'join-blue',timestamp:Date.now()});TikInteractLive.dispatch({type:'like',likeCount:250,username:'moto-blue',sessionId:'moto-browser-test',eventId:'like-blue',timestamp:Date.now()});TikInteractLive.dispatch({type:'gift',diamondCount:100,repeatCount:1,username:'moto-red',sessionId:'moto-browser-test',eventId:'gift-red',timestamp:Date.now()})");await settle(100);
    await evaluate("document.getElementById('live-game-frame').contentWindow.__advanceRace(900)");
    await assert("parseInt(document.getElementById('live-game-frame').contentDocument.getElementById('blueSpeed').textContent)>50 && parseInt(document.getElementById('live-game-frame').contentDocument.getElementById('redSpeed').textContent)===200 && document.getElementById('live-game-frame').contentDocument.querySelector('#topBlue .supporter-likes').getAttribute('aria-label')==='250 like-uri'",'Real SDK chat/like/gift route failed for Moto Interact');
    await assert("document.getElementById('live-game-frame').contentWindow.__motoDraws.red.angle>24 && document.getElementById('live-game-frame').contentDocument.getElementById('topRed').textContent.includes('moto-red')",'Moto SDK nitro/ranking failed');
    await evaluate("document.getElementById('view-live').scrollIntoView({behavior:'instant'})");
    const studio=await page('Page.captureScreenshot',{format:'webp',quality:90});await writeFile(path.join(root,'.tools/moto-interact-studio.webp'),Buffer.from(studio.data,'base64'));
    await evaluate("selectStudioTestTab('audio')");
    await assert("document.querySelector('[data-test-control=volumeMaster]').value==='70' && document.querySelector('[data-test-control=volumeEngine]').value==='20' && document.querySelector('[data-test-control=volumeEffects]').value==='40'",'Moto audio defaults must match Studio');
    await page('Page.navigate',{url:'http://localhost:3000/GAME/MOTO-INTERACT/index.html'});
    await waitFor("document.querySelector('[data-gallery-featured]')?.naturalWidth>0");
    await assert("document.querySelector('.game-page-title').textContent==='Moto Interact'",'Moto presentation failed');
    console.log('Verified Moto Interact catalog, presentation, LIVE Studio controls and SDK RED/BLUE chat, likes, gifts, nitro and Top 5. No real TikTok connection was opened.');
    await send('Browser.close');

} finally {socket?.close();processChrome.kill();}
