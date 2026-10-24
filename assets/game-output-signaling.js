import {sealSignal,openSignal} from './game-output-protocol.js?v=1';
// Reuse Supabase Realtime for small encrypted WebRTC handshakes only.
// Media travels directly to OBS, not through Supabase or the database.
export async function connectOutputSignals(identity,onMessage,{publisher=false}={}){
 const [{default:sdk},config]=await Promise.all([import('./vendor/supabase-output.js?v=2.95.3'),fetch('/assets/supabase-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('OUTPUT_SIGNAL_UNAVAILABLE');return r.json();})]);
 const client=sdk.createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:5}}});
 const channel=client.channel('game-output:'+identity.room,{config:{broadcast:{self:false,ack:true}}});let closed=false;
 channel.on('broadcast',{event:publisher?'viewer':'publisher'},async({payload})=>{try{const message=await openSignal(payload,identity,!publisher);if(!closed)await onMessage(message);}catch{/* Invalid or stale signaling never reaches the game or the receiver. */}});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('OUTPUT_SIGNAL_UNAVAILABLE')),12000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){clearTimeout(timer);reject(Error('OUTPUT_SIGNAL_UNAVAILABLE'));}});});}catch(error){await client.removeChannel(channel);throw error;}
 return {async send(message){if(closed)return;const result=await channel.send({type:'broadcast',event:publisher?'publisher':'viewer',payload:await sealSignal({...message,at:Date.now()},identity,publisher)});if(result!=='ok')throw Error('OUTPUT_SIGNAL_UNAVAILABLE');},async close(){closed=true;await client.removeChannel(channel);client.realtime.disconnect();}};
}
