// Record real game animation locally, using each game's native demo controls.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'.tools/video/animation');
await mkdir(output,{recursive:true});
const chrome=spawn(process.env.GALLERY_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',[
    '--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking',
    '--disable-extensions','--mute-audio','--disable-renderer-backgrounding','--remote-debugging-port=0',
    `--user-data-dir=${path.join(root,'.tools/animation-chrome')}`,'about:blank'
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket;
try {
    const endpoint=await new Promise((resolve,reject)=>{
        let log='';const timer=setTimeout(()=>reject(new Error('Chrome startup timed out')),30000);
        chrome.on('error',reject);
        chrome.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    });
    socket=new WebSocket(endpoint);
    await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
    let id=0,recording;
    const pending=new Map();
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
        const request=++id;const timer=setTimeout(()=>{pending.delete(request);reject(new Error(method+' timed out'));},30000);
        pending.set(request,{resolve,reject,timer});socket.send(JSON.stringify({id:request,method,params,...(sessionId?{sessionId}:{})}));
    });
    socket.on('message',buffer=>{
        const message=JSON.parse(buffer.toString());
        if(message.method==='Page.screencastFrame') {
            const data=message.params;
            send('Page.screencastFrameAck',{sessionId:data.sessionId},message.sessionId).catch(()=>{});
            if(recording) {
                const filename=`frame-${String(recording.frames.length).padStart(5,'0')}.jpg`;
                recording.frames.push({file:filename,timestamp:data.metadata.timestamp});
                recording.writes.push(writeFile(path.join(recording.directory,filename),Buffer.from(data.data,'base64')));
            }
        }
        if(!pending.has(message.id))return;
        const request=pending.get(message.id);pending.delete(message.id);clearTimeout(request.timer);
        if(message.error)request.reject(new Error(JSON.stringify(message.error)));else request.resolve(message.result);
    });
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const page=(method,params)=>send(method,params,sessionId);
    const evaluate=async expression=>{
        const result=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
        if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    await page('Page.enable');await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:1,mobile:false});
    const normalize=(await readFile(path.join(root,'assets/game-viewport.js'),'utf8')).replace('if (window.parent !== window)','if (true)');
    const games=[
        {id:'neon-race',file:'GAME/NEON-RACE/Neon-Race.html',time:'night',weather:'clear',demo:'auto'},
        {id:'neon-riders',file:'GAME/NEON-RIDERS/NEON-RIDERS.html',time:'night',weather:'christmas',demo:'auto'},
        {id:'country-derby',file:'GAME/COUNTRY-DERBY/COUNTRY-DERBY.html',time:'day',weather:'rain',demo:'demo'}
    ];
    for(const game of games) {
        await page('Page.navigate',{url:`http://localhost:3000/${game.file}`});
        let ready=false;
        for(let i=0;i<120;i++) {
            try{ready=await evaluate("document.readyState==='complete' && !!document.getElementById('weatherMode')");}catch{ready=false;}
            if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));
        }
        if(!ready)throw new Error('Game did not load: '+game.id);
        await evaluate(normalize);
        await evaluate(`(() => {
            const style=document.createElement('style');style.textContent='#testPanel,#testToggle,.controls,#settings,#controls{display:none!important}';document.head.append(style);
            const time=document.getElementById('timeOfDay'),weather=document.getElementById('weatherMode');
            time.value=${JSON.stringify(game.time)};time.dispatchEvent(new Event('change',{bubbles:true}));
            weather.value=${JSON.stringify(game.weather)};weather.dispatchEvent(new Event('change',{bubbles:true}));
            document.getElementById(${JSON.stringify(game.demo)}).click();
            for(const animation of document.getAnimations())if(animation.animationName==='santaRealFly')animation.currentTime=2500;
            window.dispatchEvent(new Event('resize'));
        })()`);
        await page('Page.bringToFront');
        await new Promise(resolve=>setTimeout(resolve,800));
        const directory=path.join(output,game.id);await mkdir(directory,{recursive:true});
        const record={directory,frames:[],writes:[]};recording=record;
        await page('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:540,maxHeight:960,everyNthFrame:1});
        await new Promise(resolve=>setTimeout(resolve,4500));
        await page('Page.stopScreencast');recording=undefined;
        await Promise.all(record.writes);
        if(record.frames.length<40)throw new Error(`Too few animated frames for ${game.id}: ${record.frames.length}`);
        const first=record.frames[0].timestamp;
        const frames=record.frames.map(frame=>({file:frame.file,time:frame.timestamp-first}));
        const duration=frames.at(-1).time;
        await writeFile(path.join(directory,'frames.json'),JSON.stringify({game:game.id,time:game.time,weather:game.weather,demo:true,width:540,height:960,duration,frames},null,2));
        console.log(`${game.id}: ${frames.length} animated frames over ${duration.toFixed(2)}s (${(frames.length/duration).toFixed(1)} fps).`);
    }
    await send('Browser.close');
} finally {socket?.close();chrome.kill();}
