// Capture the real game renderer in an isolated headless Chrome profile.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/game-gallery');
const profile = path.join(root, '.tools/gallery-chrome');
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
    if (process.argv.includes('--verify-animation')) {
        const waitFor=async expression=>{
            for(let i=0;i<150;i++) {
                try {if(await evaluate(expression))return;}catch{}
                await new Promise(resolve=>setTimeout(resolve,100));
            }
            throw new Error(`Showcase timed out: ${expression}`);
        };
        const settle=(ms=350)=>new Promise(resolve=>setTimeout(resolve,ms));
        const fingerprint=()=>evaluate("document.querySelector('[data-showcase-canvas]').toDataURL('image/webp',.3)");
        const changed=async expected=>{
            const first=await fingerprint();await settle();const second=await fingerprint();
            if((first!==second)!==expected) {
                const shot=await page('Page.captureScreenshot',{format:'webp',quality:90});
                await writeFile(path.join(root,'.tools/home-showcase-failure.webp'),Buffer.from(shot.data,'base64'));
                const state=await evaluate("({game:document.querySelector('[data-showcase-name]').textContent,status:document.querySelector('[data-showcase-state]').textContent,paused:document.querySelector('[data-showcase-toggle]').getAttribute('aria-pressed')})");
                throw new Error((expected?'Expected real canvas motion: ':'Expected canvas to remain paused: ')+JSON.stringify(state));
            }
        };
        for(const width of (process.argv.includes('--mobile-only')?[390]:[1280,390])) {
            await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
            await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
            await page('Page.navigate',{url:'http://localhost:3000/'});
            await waitFor("document.querySelector('[data-showcase-canvas]')?.getAttribute('aria-label').includes('personaje') && typeof switchView==='function'");
            await evaluate("document.querySelector('[data-home-showcase]').scrollIntoView({block:'center',behavior:'instant'})");
            await settle(1200);
            if(await evaluate("!!document.querySelector('[data-home-showcase] video')"))throw new Error('Home must have a native animation, not a video element');
            await changed(true);
            await evaluate("document.querySelector('[data-showcase-toggle]').click()");await settle();
            await changed(false);
            await evaluate("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");await settle();
            await evaluate("document.querySelector('[data-home-showcase]').scrollIntoView({block:'center',behavior:'instant'})");await settle();
            await changed(false);
            await evaluate("document.querySelector('[data-showcase-toggle]').click()");await settle();
            await changed(true);
            if(await evaluate("JSON.stringify([...document.querySelectorAll('[data-showcase-game]')].map(button=>button.dataset.showcaseGame))")!==JSON.stringify(['race','riders']))throw new Error('Home animation must offer only Neon Race and Neon Riders');
            for(const game of ['race','riders']) {
                await evaluate(`document.querySelector('[data-showcase-game="${game}"]').click()`);await settle(800);
                if(!await evaluate(`document.querySelector('[data-showcase-game="${game}"]').getAttribute('aria-pressed')==='true'`))throw new Error('Game selection failed');
                await changed(true);
                const shot=await page('Page.captureScreenshot',{format:'webp',quality:90});
                await writeFile(path.join(root,`.tools/home-showcase-${game}-${width}.webp`),Buffer.from(shot.data,'base64'));
            }
            await evaluate("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");await settle();
            await changed(false);
            await evaluate("document.querySelector('[data-home-showcase]').scrollIntoView({block:'center',behavior:'instant'})");await settle();
            await changed(true);
            await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await settle();
            await changed(false);
            await page('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await settle();
            await changed(true);
            await evaluate("switchView('catalog')");await settle();
            await changed(false);
            console.log(`Verified native canvas at ${width}px: no video, moving sprites, 2 game choices, pause, offscreen suspend/resume and reduced motion.`);
        }
    } else if (process.argv.includes('--verify')) {
        const checks = [['NEON-RACE',5],['NEON-RIDERS',5],['COUNTRY-DERBY',4]];
        for (const width of [1280,390]) {
            await page('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
            for (const [folder,count] of checks) {
                await page('Page.navigate',{url:`http://localhost:3000/GAME/${folder}/index.html`});
                let loaded = false;
                for (let i=0;i<100;i++) {
                    try {loaded=await evaluate("document.readyState==='complete' && !!document.querySelector('.game-gallery-item')");} catch {loaded=false;}
                    if (loaded) break;
                    await new Promise(resolve=>setTimeout(resolve,100));
                }
                if (!loaded) throw new Error(`Gallery did not load: ${folder}`);
                await evaluate("document.getElementById('game-gallery').scrollIntoView({block:'start'})");
                await new Promise(resolve=>setTimeout(resolve,350));
                const initial=await evaluate(`({count:document.querySelectorAll('.game-gallery-item').length,overflow:document.documentElement.scrollWidth>innerWidth})`);
                if (initial.count!==count || initial.overflow) throw new Error(`Bad gallery layout: ${folder} ${JSON.stringify(initial)}`);
                if (folder==='NEON-RACE') {
                    const shot=await page('Page.captureScreenshot',{format:'webp',quality:85});
                    await writeFile(path.join(root,`.tools/gallery-qa-${width}.webp`),Buffer.from(shot.data,'base64'));
                }
                const selected=await evaluate(`(() => {
                    const buttons=[...document.querySelectorAll('.game-gallery-item')];
                    const last=buttons[buttons.length-1];last.click();
                    const good=document.querySelector('[data-gallery-featured]').src.endsWith(last.dataset.galleryImage.replace('../../','/')) && last.getAttribute('aria-pressed')==='true' && !document.getElementById('game-gallery-dialog').open;
                    buttons[0].click();return good;
                })()`);
                if (!selected) throw new Error('Thumbnail selection should update the main image without opening a dialog');
                await evaluate("document.querySelector('[data-gallery-open]').click()");
                const opened=await evaluate("document.getElementById('game-gallery-dialog').open && document.querySelector('[data-gallery-full]').src.includes('-day.webp')");
                if (!opened) throw new Error('Dialog did not open on the day image');
                await page('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});
                await page('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft'});
                const wrapped=await evaluate(`document.querySelector('[data-gallery-counter]').textContent === '${count} / ${count}'`);
                if (!wrapped) throw new Error('Keyboard wrapping failed');
                await evaluate("document.querySelector('[data-gallery-next]').click()");
                const next=await evaluate("document.querySelector('[data-gallery-counter]').textContent.startsWith('1 /')");
                if (!next) throw new Error('Next navigation failed');
                await evaluate("document.querySelector('[data-gallery-full]').decode()");
                const fit=await evaluate("document.getElementById('game-gallery-dialog').getBoundingClientRect().width <= innerWidth && document.getElementById('game-gallery-dialog').getBoundingClientRect().height <= innerHeight");
                if (!fit) throw new Error('Dialog does not fit viewport');
                if (folder==='NEON-RACE') {
                    const shot=await page('Page.captureScreenshot',{format:'webp',quality:85});
                    await writeFile(path.join(root,`.tools/gallery-dialog-qa-${width}.webp`),Buffer.from(shot.data,'base64'));
                }
                await page('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
                await page('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
                await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
                const closed=await evaluate("!document.getElementById('game-gallery-dialog').open && document.activeElement===document.querySelector('[data-gallery-open]') && document.documentElement.style.overflow!== 'hidden'");
                if (!closed) throw new Error('Escape/focus/scroll restoration failed: '+JSON.stringify(await evaluate("({open:document.getElementById('game-gallery-dialog').open,focus:document.activeElement.className,overflow:document.documentElement.style.overflow})")));
                console.log(`Verified ${folder}: ${count} images, navigation, Escape, focus and ${width}px layout.`);
            }
        }
        await page('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
        await page('Page.navigate',{url:'http://localhost:3000/index.html?view=catalog'});
        let catalogReady=false;
        for (let i=0;i<150;i++) {
            try {catalogReady=await evaluate("!!document.getElementById('view-catalog') && !document.getElementById('view-catalog').classList.contains('hidden')");} catch {catalogReady=false;}
            if (catalogReady) break;
            await new Promise(resolve=>setTimeout(resolve,100));
        }
        if (!catalogReady) throw new Error('Back to games did not restore the catalog');
        const cleanCatalog=await evaluate("document.querySelectorAll('#view-catalog .game-catalog-card').length===3 && !document.querySelector('#view-catalog .game-card-variants')");
        if (!cleanCatalog) throw new Error('Catalog should contain simple game cards without mode thumbnails');
        console.log('Verified clean catalog and the presentation back link route.');
    } else {
    const normalize = (await readFile(path.join(root,'assets/game-viewport.js'),'utf8')).replace('if (window.parent !== window)', 'if (true)');
    const modes = [
        {id:'day',label:'Zi',time:'day',weather:'clear'},
        {id:'night',label:'Noapte',time:'night',weather:'clear'},
        {id:'rain',label:'Ploaie',time:'day',weather:'rain'},
        {id:'winter',label:'Iarnă',time:'day',weather:'winter'},
        {id:'christmas',label:'Christmas Mode',time:'night',weather:'christmas'}
    ];
    const games = [
        ['neon-race','GAME/NEON-RACE/Neon-Race.html',modes],
        ['neon-riders','GAME/NEON-RIDERS/NEON-RIDERS.html',modes],
        ['country-derby','GAME/COUNTRY-DERBY/COUNTRY-DERBY.html',[...modes.slice(0,3),{id:'night-rain',label:'Ploaie noaptea',time:'night',weather:'rain'}]]
    ];
    const previousManifest = JSON.parse(await readFile(path.join(output,'manifest.json'),'utf8'));
    const manifest = previousManifest.filter(item => !['neon-race','neon-riders','country-derby'].includes(item.game));
    for (const [game, pathname, variants] of games) {
        await page('Page.navigate',{url:`http://localhost:3000/${pathname}`});
        let ready = false;
        for (let attempt=0;attempt<100;attempt++) {
            try {ready = await evaluate("document.readyState === 'complete' && !!document.getElementById('weatherMode')");} catch {ready=false;}
            if (ready) break;
            await new Promise(resolve => setTimeout(resolve,100));
        }
        if (!ready) throw new Error(`Game did not load: ${game}`);
        await evaluate(normalize);
        await evaluate(`(() => {
            const style=document.createElement('style');
            style.textContent='#testPanel,#testToggle,.controls,#settings,#controls{display:none!important}';
            document.head.append(style);
            document.getElementById('pause')?.click();
            window.dispatchEvent(new Event('resize'));
        })()`);
        await new Promise(resolve => setTimeout(resolve,1200));
        for (const mode of variants) {
            const state = await evaluate(`(() => {
                const time=document.getElementById('timeOfDay'),weather=document.getElementById('weatherMode');
                if (![...weather.options].some(o=>o.value===${JSON.stringify(mode.weather)})) throw new Error('Unsupported weather');
                time.value=${JSON.stringify(mode.time)};time.dispatchEvent(new Event('change',{bubbles:true}));
                weather.value=${JSON.stringify(mode.weather)};weather.dispatchEvent(new Event('change',{bubbles:true}));
                return {time:time.value,weather:weather.value,shell:document.getElementById('shell').className};
            })()`);
            await new Promise(resolve => setTimeout(resolve,800));
            await evaluate(`(() => {
                for (const animation of document.getAnimations()) {
                    animation.pause();
                    animation.currentTime=animation.animationName==='santaRealFly'?4800:animation.animationName==='santaFly'?17500:1500;
                }
            })()`);
            await new Promise(resolve => setTimeout(resolve,100));
            const screenshot = await page('Page.captureScreenshot',{format:'webp',quality:88,captureBeyondViewport:false});
            const filename = `${game}-${mode.id}.webp`;
            await writeFile(path.join(output,filename),Buffer.from(screenshot.data,'base64'));
            const thumbnail = `${game}-${mode.id}-thumb.webp`;
            const small = await page('Page.captureScreenshot',{format:'webp',quality:84,clip:{x:0,y:0,width:540,height:960,scale:1/3}});
            await writeFile(path.join(output,thumbnail),Buffer.from(small.data,'base64'));
            manifest.push({game,mode:mode.id,label:mode.label,file:filename,thumbnail,...state});
            console.log(`Captured ${filename}`);
        }
    }
    await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    }
    await send('Browser.close');
} finally {
    socket?.close();
    processChrome.kill();
}
