// Playback capability only. Website access/refresh tokens never enter the URL.
const encoder=new TextEncoder(),decoder=new TextDecoder();
export const encode64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export const decode64=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
export async function createOutputIdentity(){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 return {room:crypto.randomUUID(),secret:encode64(crypto.getRandomValues(new Uint8Array(32))),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey),privateKey:await crypto.subtle.exportKey('jwk',pair.privateKey)};
}
export function outputLink(identity,format='portrait',origin=location.origin){
 const capability={v:1,room:identity.room,secret:identity.secret,publicKey:identity.publicKey};
 return `${origin}/game-output.html?format=${format==='landscape'?'landscape':'portrait'}#${encode64(encoder.encode(JSON.stringify(capability)))}`;
}
export function parseOutputLink(hash){
 if(typeof hash!=='string'||hash.length>2000)throw Error('OUTPUT_INVALID_LINK');
 const value=JSON.parse(decoder.decode(decode64(hash.replace(/^#/,''))));
 if(value.v!==1||!/^[a-f0-9-]{36}$/.test(value.room)||!/^[A-Za-z0-9_-]{43}$/.test(value.secret)||value.publicKey?.kty!=='EC'||value.publicKey?.crv!=='P-256'||value.publicKey?.d)throw Error('OUTPUT_INVALID_LINK');
 return value;
}
export async function sealSignal(body,identity,sign=false){
 const message=JSON.stringify(body),signature=sign?encode64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},await crypto.subtle.importKey('jwk',identity.privateKey,{name:'ECDSA',namedCurve:'P-256'},false,['sign']),encoder.encode(message))):null;
 const key=await crypto.subtle.importKey('raw',decode64(identity.secret),'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify({message,signature})));
 return {iv:encode64(iv),data:encode64(encrypted)};
}
export async function openSignal(packet,identity,verify=false){
 if(!packet||typeof packet.data!=='string'||packet.data.length>50000||typeof packet.iv!=='string'||packet.iv.length!==16)throw Error('OUTPUT_INVALID_SIGNAL');
 const key=await crypto.subtle.importKey('raw',decode64(identity.secret),'AES-GCM',false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode64(packet.iv)},key,decode64(packet.data));
 const {message,signature}=JSON.parse(decoder.decode(plain));
 if(verify){const publicKey=await crypto.subtle.importKey('jwk',identity.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);if(!signature||!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,decode64(signature),encoder.encode(message)))throw Error('OUTPUT_INVALID_SIGNATURE');}
 const body=JSON.parse(message);if(!Number.isFinite(body.at)||Math.abs(Date.now()-body.at)>45000)throw Error('OUTPUT_EXPIRED_SIGNAL');return body;
}
export async function gatherICE(peer,timeout=5000){
 if(peer.iceGatheringState==='complete')return;
 await new Promise(resolve=>{const done=()=>{clearTimeout(timer);peer.removeEventListener('icegatheringstatechange',change);resolve();},change=()=>{if(peer.iceGatheringState==='complete')done();},timer=setTimeout(done,timeout);peer.addEventListener('icegatheringstatechange',change);});
}
