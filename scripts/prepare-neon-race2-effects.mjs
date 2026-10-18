// Capture the real game renderer in an isolated headless Chrome profile.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/neon-race2/effects');
const profile = path.join(root, '.tools/effects-chrome');
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



    await page('Page.navigate',{url:'http://localhost:3000/'});
    const manifest=[];
    for(const name of ['nitro','boost','impact','shield']) {
        const result=await evaluate('('+ (async function(name) {
            const image=new Image();image.src='/assets/neon-race2/effects/'+name+'.png';await image.decode();
            const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
            const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
            const {data}=ctx.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height;
            let minX=w,minY=h,maxX=0,maxY=0,transparent=0;
            for(let y=0;y<h;y++)for(let x=0;x<w;x++){const alpha=data[(y*w+x)*4+3];if(alpha<=4){transparent++;continue;}minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
            if(transparent<w*h*.2||data[3]>0)throw new Error('Expected transparent VFX sprite');
            const centerAlpha=data[(Math.floor(h/2)*w+Math.floor(w/2))*4+3];
            if(['impact','shield'].includes(name)&&centerAlpha>10)throw new Error('Shield/impact must have a transparent center');
            const bounds={x:Math.max(0,minX-6),y:Math.max(0,minY-6),width:Math.min(w,maxX+7)-Math.max(0,minX-6),height:Math.min(h,maxY+7)-Math.max(0,minY-6)};
            const optimized=document.createElement('canvas');optimized.width=name==='impact'?512:name==='shield'?1024:768;optimized.height=Math.round(bounds.height/bounds.width*optimized.width);
            optimized.getContext('2d').drawImage(image,bounds.x,bounds.y,bounds.width,bounds.height,0,0,optimized.width,optimized.height);
            return {name,source:name+'.png',file:name+'.webp',originalSize:[w,h],bounds,size:[optimized.width,optimized.height],transparentRatio:transparent/(w*h),centerAlpha,data:optimized.toDataURL('image/webp',.92).split(',')[1]};
        }).toString()+')('+JSON.stringify(name)+')');
        const {data,...metadata}=result;
        await writeFile(path.join(output,result.file),Buffer.from(data,'base64'));manifest.push(metadata);console.log(JSON.stringify(metadata));
    }
    await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    await send('Browser.close');
} finally {socket?.close();processChrome.kill();}
