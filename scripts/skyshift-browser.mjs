import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import WebSocket from 'ws';

export async function openSkyShiftBrowser(profileName='skyshift-qa',{extraArgs=[]}={}) {
    const profile=path.resolve('.tools',profileName);
    await mkdir(profile,{recursive:true});
    const child=spawn(process.env.GALLERY_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--mute-audio','--remote-debugging-port=0',`--user-data-dir=${profile}`,...extraArgs,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    let socket;
    try {
        const endpoint=await new Promise((resolve,reject)=>{
            let output='';const timer=setTimeout(()=>reject(new Error('Chrome startup timed out')),30000);
            child.on('error',error=>{clearTimeout(timer);reject(error);});
            child.stderr.on('data',data=>{output+=data;const match=output.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
        });
        socket=new WebSocket(endpoint);
        await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
        let sequence=0;const pending=new Map(),errors=[];
        socket.on('message',raw=>{
            const result=JSON.parse(raw);
            if(result.method==='Runtime.exceptionThrown')errors.push(result.params.exceptionDetails.exception?.description||result.params.exceptionDetails.text);
            const request=pending.get(result.id);if(!request)return;
            pending.delete(result.id);clearTimeout(request.timer);
            if(result.error)request.reject(new Error(JSON.stringify(result.error)));else request.resolve(result.result);
        });
        const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
            const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timed out: '+method));},30000);
            pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
        });
        const {targetId}=await send('Target.createTarget',{url:'about:blank'});
        const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
        const page=(method,params)=>send(method,params,sessionId);
        await page('Page.enable');await page('Runtime.enable');
        const evaluate=async expression=>{const result=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
        return {page,evaluate,errors,
            async waitFor(expression){for(let i=0;i<200;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('Timed out: '+expression);},
            async screenshot(file){await new Promise(resolve=>setTimeout(resolve,250));const shot=await page('Page.captureScreenshot',{format:'webp',quality:92});await writeFile(file,Buffer.from(shot.data,'base64'));},
            async close(){try{await send('Browser.close');}finally{socket.close();child.kill();}}
        };
    } catch(error){socket?.close();child.kill();throw error;}
}
