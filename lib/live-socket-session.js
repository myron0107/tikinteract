import {randomUUID} from 'node:crypto';
import {createLiveEventNormalizer,liveViewerCount} from './live-events.js';
import {normalizeGiftCatalog} from '../assets/tiktok-gifts-data.js';

export function liveFailure(error) {
    const name=String(error?.name||'')+' '+String(error?.constructor?.name||'');
    if(/UserOffline/.test(name))return {code:'NOT_LIVE',message:'Acest cont nu transmite LIVE acum. Pornește LIVE-ul pe TikTok și reîncearcă.'};
    if(/RateLimit/.test(name))return {code:'TIKTOK_RATE_LIMIT',message:'TikTok limitează momentan conectările. Așteaptă puțin și reîncearcă.'};
    if(/InvalidUniqueId/.test(name))return {code:'INVALID_USERNAME',message:'Introdu un username TikTok valid.'};
    return {code:'TIKTOK_UNAVAILABLE',message:'TikTok nu a acceptat conexiunea LIVE. Reîncearcă în câteva momente.'};
}

// One browser socket owns one TikTok connection. Never broadcast another user's LIVE.
export function attachLiveSocket(socket,{auth,createConnection,events,seedGifts=[],rotateAfter=270000,recheckEvery=20000,authTimeout=10000}) {
    let connection=null,username=null,sessionId=null,connecting=false,attempt=0,closed=false,lastAudience=0,queue=Promise.resolve();
    const send=message=>{if(!closed&&socket.readyState===1)socket.send(JSON.stringify(message));};
    const photo=(...users)=>{
        for(const user of users){const raw=user?.avatarLarger||user?.avatar_larger||user?.avatarMedium||user?.avatar_medium||user?.avatarThumb||user?.avatar_thumb||user?.profilePictureUrl;
            const value=typeof raw==='string'?raw:raw?.urlList?.[0]||raw?.url_list?.[0]||raw?.urls?.[0];
            try{const url=new URL(value);if(url.protocol==='https:')return url.href;}catch{}}
        return null;
    };
    const state=()=>({type:'status',connected:!connecting&&!!connection?.isConnected,connecting,username,sessionId,
        avatarUrl:photo(connection?.roomInfo?.data?.owner,connection?.roomInfo?.data?.user),
        displayName:connection?.roomInfo?.data?.owner?.nickname||username});
    const stop=()=>{
        attempt++;const old=connection;connection=null;username=null;sessionId=null;connecting=false;
        if(old)Promise.resolve().then(()=>old.disconnect()).catch(()=>{});
    };
    const rejectAuth=()=>{delete socket.studioAuth;send({type:'auth-required'});socket.close(1008,'Authentication required');};
    async function connect(raw){
        const name=String(raw||'').trim().replace(/^@/,'').toLowerCase();
        if(!/^[a-z0-9._]{2,24}$/.test(name)||name.endsWith('.')||name==='numele_tau'){
            send({type:'error',code:'INVALID_USERNAME',message:'Introdu un username TikTok valid.'});return;
        }
        if(username===name&&(connecting||connection?.isConnected)){send(state());return;}
        stop();const version=attempt;username=name;sessionId=randomUUID();connecting=true;
        const id=sessionId,normalize=createLiveEventNormalizer(id);
        let current;
        try{
            current=createConnection(name,{enableExtendedGiftInfo:true,processInitialData:false});connection=current;
            const active=()=>!closed&&connection===current&&attempt===version;
            for(const[kind,event]of [['chat',events.CHAT],['like',events.LIKE],['gift',events.GIFT]])current.on(event,raw=>{
                if(!active()||!current.isConnected||!auth.isAuthorized(socket))return;
                const info=kind==='gift'?(raw.extendedGiftInfo||current.availableGifts?.find(g=>String(g.id)===String(raw.giftId))||seedGifts.find(g=>String(g.id)===String(raw.giftId))):null;
                const message=normalize(kind,raw,info);if(message)send({...message,avatarUrl:photo(raw.user)});
            });
            current.on(events.ROOM_USER,raw=>{if(!active()||!auth.isAuthorized(socket))return;const count=liveViewerCount(raw);if(count!==null&&Date.now()-lastAudience>1000){lastAudience=Date.now();send({type:'audience',viewerCount:count,sessionId:id});}});
            current.on(events.STREAM_END,()=>{if(active()){stop();send({type:'stream-ended'});send(state());}});
            current.on('disconnected',()=>{if(active()&&!connecting){stop();send({type:'error',code:'TIKTOK_DISCONNECTED',message:'Conexiunea TikTok s-a întrerupt. Reîncearcă.'});send(state());}});
            current.on('error',()=>{ /* Connect failures reject below; nonfatal decode errors must not end the LIVE. */ });
            send(state());
            await current.connect();
            if(!active()){await current.disconnect();return;}
            connecting=false;send(state());
        }catch(error){if(!closed&&attempt===version){stop();send({type:'error',...liveFailure(error)});send(state());}}
    }
    async function receive(raw){
        let message;try{message=JSON.parse(String(raw));}catch{send({type:'error',code:'INVALID_MESSAGE',message:'Mesaj LIVE invalid.'});return;}
        if(!message||typeof message!=='object'||Array.isArray(message)){send({type:'error',code:'INVALID_MESSAGE'});return;}
        const previousOwner=socket.studioAuth?.userId;
        if(!await auth.authorize(socket,message.accessToken)){rejectAuth();return;}
        if(closed)return;
        if(previousOwner&&previousOwner!==socket.studioAuth?.userId)stop();
        clearTimeout(firstAuth);
        if(message.type==='connect'){void connect(message.username);}
        else if(message.type==='disconnect'){stop();send(state());}
        else if(message.type==='state')send(state());
        else if(message.type==='gift-catalog'){
            const gifts=normalizeGiftCatalog([...seedGifts,...(connection?.availableGifts||[])]);
            send({type:'gift-catalog',gifts,scope:'catalog',updatedAt:Date.now(),cached:true});
        }
    }
    socket.on('message',raw=>{queue=queue.then(()=>receive(raw)).catch(()=>{send({type:'error',code:'LIVE_SERVICE_UNAVAILABLE',message:'Serviciul LIVE nu este disponibil momentan.'});});});
    const firstAuth=setTimeout(()=>{if(!socket.studioAuth)rejectAuth();},authTimeout);
    const recheck=setInterval(async()=>{
        const token=socket.studioAuth?.token;if(!token||closed)return;
        const valid=await auth.authorize(socket,token,{force:true});
        if(closed||socket.studioAuth?.token!==token)return;
        if(!valid)rejectAuth();
    },recheckEvery);
    // Rotate before the Vercel duration limit; the client resumes the selected LIVE.
    const rotation=setTimeout(()=>{send({type:'reconnect'});socket.close(1012,'Service restart');},rotateAfter);
    for(const timer of[firstAuth,recheck,rotation])timer.unref?.();
    const cleanup=()=>{if(closed)return;closed=true;clearTimeout(firstAuth);clearTimeout(rotation);clearInterval(recheck);stop();};
    socket.on('close',cleanup);socket.on('error',cleanup);
    return {state,close:cleanup};
}
