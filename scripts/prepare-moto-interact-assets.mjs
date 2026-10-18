// Capture the real game renderer in an isolated headless Chrome profile.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/moto-interact');
const profile = path.join(root, '.tools/moto-assets-chrome');
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
    for(const team of ['red','blue']){
        const result=await evaluate('('+ (async function(team){
            const image=new Image();image.src='/assets/moto-interact/bikes/sport-'+team+'-v2.png';await image.decode();
            const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
            const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
            const w=canvas.width,h=canvas.height,{data}=ctx.getImageData(0,0,w,h);
            let minX=w,minY=h,maxX=0,maxY=0,transparent=0;
            for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(data[(y*w+x)*4+3]<=8){transparent++;continue;}minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
            if(transparent<w*h*.1||data[3]>0)throw new Error('Motorcycles must retain genuine alpha transparency');
            function color(x,y){const i=(Math.round(y)*w+Math.round(x))*4;return team==='red'?Math.max(0,data[i]-Math.max(data[i+1],data[i+2])):Math.max(0,data[i+2]-Math.max(data[i],data[i+1]));}
            const wheels=[.202,.798].map(fraction=>{
                let best={score:-1};
                for(let cx=Math.round(w*fraction-w*.025);cx<=w*(fraction+.025);cx+=2)for(let cy=Math.round(h*.70-h*.055);cy<=h*.755;cy+=2)for(let r=Math.round(w*.075);r<=w*.105;r+=2){
                    let score=0;for(let i=0;i<72;i++){const angle=i/72*Math.PI*2;score+=color(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r);}
                    if(score>best.score)best={x:cx,y:cy,radius:r,score};
                }
                let bottom=best.y;
                for(let y=Math.floor(best.y);y<h;y++)for(let x=Math.floor(best.x-8);x<=best.x+8;x++)if(data[(y*w+x)*4+3]>32)bottom=y;
                return {...best,bottom};
            });
            const bounds={x:Math.max(0,minX-4),y:Math.max(0,minY-4),width:Math.min(w,maxX+5)-Math.max(0,minX-4),height:Math.min(h,maxY+5)-Math.max(0,minY-4)};
            const optimized=document.createElement('canvas');optimized.width=1280;optimized.height=Math.round(bounds.height/bounds.width*1280);
            optimized.getContext('2d').drawImage(image,bounds.x,bounds.y,bounds.width,bounds.height,0,0,optimized.width,optimized.height);
            return {team,source:'sport-'+team+'-v2.png',file:'sport-'+team+'-v2.webp',originalSize:[w,h],bounds,size:[optimized.width,optimized.height],exhaust:{x:.11,y:.375},contact:{x:(wheels[0].x-bounds.x)/bounds.width,y:(wheels[0].bottom-bounds.y)/bounds.height},wheels:wheels.map(wheel=>({x:(wheel.x-bounds.x)/bounds.width,y:(wheel.y-bounds.y)/bounds.height,radius:wheel.radius*.8/bounds.width,score:wheel.score})),data:optimized.toDataURL('image/webp',.94).split(',')[1]};
        }).toString()+')('+JSON.stringify(team)+')');
        const {data,...metadata}=result;
        await writeFile(path.join(output,'bikes',result.file),Buffer.from(data,'base64'));manifest.push(metadata);console.log(JSON.stringify(metadata));
    }
    await writeFile(path.join(output,'bikes/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    await writeFile(path.join(output,'bikes/manifest.js'),'// Generated motorcycle alpha bounds, wheel centers and rear tire contact.\nexport default '+JSON.stringify(manifest,null,2)+';\n');
    const scenery=await evaluate('('+(async function(){
        const image=new Image();image.src='/assets/moto-interact/scenery/day-neon-v2.png';await image.decode();
        const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=Math.round(image.height/image.width*1536);
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        return canvas.toDataURL('image/webp',.91).split(',')[1];
    }).toString()+')()');
    await writeFile(path.join(output,'scenery/day-neon-v2.webp'),Buffer.from(scenery,'base64'));
    console.log('Prepared transparent bikes, measured rear tire contact, animated wheel centers and daylight scenery.');
    await send('Browser.close');

} finally {socket?.close();processChrome.kill();}
