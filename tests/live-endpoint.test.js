import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import WebSocket from 'ws';
import server from '../api/live.js';

test('The deployable online endpoint serves health, rejects foreign origins and authenticates before TikTok',async()=>{
 server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
 try{
  const response=await fetch(`http://127.0.0.1:${port}/api/live`);assert.equal(response.status,200);assert.equal((await response.json()).service,'tiktok-live');
  await new Promise((resolve,reject)=>{
   const bad=new WebSocket(`ws://127.0.0.1:${port}/api/live`,{origin:'https://foreign.invalid'});bad.on('open',()=>reject(Error('Foreign origin accepted')));bad.on('error',e=>{try{assert.match(e.message,/403/);resolve();}catch(err){reject(err);}});
  });
  await new Promise((resolve,reject)=>{
   const ws=new WebSocket(`ws://127.0.0.1:${port}/api/live`,{origin:'https://tikinteract.vercel.app'});
   ws.on('open',()=>ws.send(JSON.stringify({type:'connect',username:'never-contact-tiktok',accessToken:'invalid'})));
   const messages=[];ws.on('message',raw=>messages.push(JSON.parse(String(raw))));ws.on('error',reject);
   ws.on('close',code=>{try{assert.equal(code,1008);assert(messages.some(m=>m.type==='auth-required'));resolve();}catch(e){reject(e);}});
  });
 }finally{await new Promise(resolve=>server.close(resolve));}
});
