import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {TikTokLiveConnection,WebcastEvent} from 'tiktok-live-connector';
import config from '../assets/supabase-config.json' with {type:'json'};
import catalog from '../assets/tiktok-gifts-catalog.json' with {type:'json'};
import {createStudioAuthenticator} from '../lib/studio-auth.js';
import {attachLiveSocket} from '../lib/live-socket-session.js';

const auth=createStudioAuthenticator(config);
const server=createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({service:'tiktok-live',transport:'websocket'}));
});
const wss=new WebSocketServer({noServer:true,maxPayload:8192});
server.on('upgrade',(request,socket,head)=>{
    let allowed=false;
    try{
        const origin=new URL(request.headers.origin);
        allowed=origin.origin==='https://tikinteract.vercel.app'||origin.origin===`https://${process.env.VERCEL_URL}`
            ||(origin.protocol==='http:'&&['127.0.0.1','localhost'].includes(origin.hostname));
    }catch{}
    if(!allowed){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(request,socket,head,ws=>{
        attachLiveSocket(ws,{auth,createConnection:(username,options)=>new TikTokLiveConnection(username,options),events:WebcastEvent,seedGifts:catalog.gifts});
    });
});
export const maxDuration=300;
export default server;
