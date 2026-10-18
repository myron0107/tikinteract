import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {normalizeGiftCatalog} from '../assets/tiktok-gifts-data.js';

export function createGiftCatalog({file,seedFile,fetchGifts,now=Date.now,ttl=6*60*60*1000}){
    let cache={gifts:[],updatedAt:null,username:null},loading=null,writeQueue=Promise.resolve();
    const inFlight=new Map();
    async function load(){
        if(!loading)loading=(async()=>{
            for(const source of [seedFile,file].filter(Boolean)){
                try{const saved=JSON.parse(await readFile(source,'utf8'));if(saved.updatedAt>=(cache.updatedAt||0)){
                    cache={gifts:normalizeGiftCatalog(saved.gifts),updatedAt:saved.updatedAt,username:saved.username||null,scope:saved.scope,source:saved.source,region:saved.region};
                }}catch(error){if(error.code!=='ENOENT')console.warn('Gift catalog cache unavailable:',error.message);}
            }
        })();
        return loading;
    }
    async function save(){
        const snapshot=JSON.stringify(cache);
        writeQueue=writeQueue.catch(()=>{}).then(async()=>{await mkdir(path.dirname(file),{recursive:true});
            const temporary=file+'.tmp';await writeFile(temporary,snapshot);await rename(temporary,file);});
        await writeQueue;
    }
    async function ingest(raw,username){
        await load();const gifts=normalizeGiftCatalog(raw);if(!gifts.length)return cache;
        const global=raw?.scope==='catalog'||cache.scope==='catalog';
        const combined=global&&raw?.scope!=='catalog'?normalizeGiftCatalog([...cache.gifts,...gifts]):gifts;
        cache={gifts:combined,updatedAt:now(),username:global?null:username||null,
            ...(global?{scope:'catalog',source:raw?.source||cache.source,region:raw?.region||cache.region}:{})};await save();return cache;
    }
    async function get(username,{refresh=false}={}){
        await load();
        if(!refresh&&cache.gifts.length&&now()-cache.updatedAt<ttl&&(cache.scope==='catalog'||!username||cache.username===username))return{...cache,cached:true};
        if(inFlight.has(username))return inFlight.get(username);
        const request=(async()=>{
            try{const result=await fetchGifts(username);
                if(!normalizeGiftCatalog(result).length)throw new Error('TikTok nu a returnat cadouri.');
                const updated=await ingest(result,username);
                return{...updated,cached:false};
            }catch(error){return{...cache,cached:true,error:cache.gifts.length?'Actualizarea TikTok nu este disponibilă momentan. Este afișat catalogul salvat.':'Catalogul TikTok nu este disponibil momentan. Încearcă din nou mai târziu.'};}
            finally{inFlight.delete(username);}
        })();inFlight.set(username,request);return request;
    }
    return{get,ingest};
}
