import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizeGiftCatalog,normalizeReceivedGift,summarizeGifts,addGiftToLedger,filterGifts} from '../assets/tiktok-gifts-data.js';
import {createGiftCatalog} from '../lib/gift-catalog.js';
import {createLiveEventNormalizer} from '../lib/live-events.js';
const raw={id:1,name:'Test gift',diamond_count:10,image:{url_list:['https://example.com/gift.webp']}};
const event=(id,quantity=1,unit=10)=>({type:'gift',eventId:id,giftId:'1',giftName:'Test gift',repeatCount:quantity,diamondCount:unit,coins:quantity*unit,timestamp:1000,username:'sender'});
const ledger=()=>({summary:{count:0,coins:0,types:0,collection:[],recent:[]},seen:[],pending:[]});

test('catalog keeps real IDs, prices and HTTPS images; unknown fields and duplicates are normalized',()=>{
    const catalog=normalizeGiftCatalog([raw,{...raw,name:'Updated'}, {id:2,name:'Other',diamondCount:Infinity,image:'javascript:alert(1)'}]);
    assert.equal(catalog.length,2);assert.equal(catalog.find(g=>g.id==='1').name,'Updated');
    assert.equal(catalog.find(g=>g.id==='1').coins,10);assert.equal(catalog.find(g=>g.id==='1').image,'https://example.com/gift.webp');
    assert.equal(catalog.find(g=>g.id==='2').image,null);assert.equal(catalog.find(g=>g.id==='2').coins,0);
    assert.deepEqual(normalizeGiftCatalog(catalog),catalog);
});
test('a ten-coin gift is one item; a final streak of ten gifts counts ten items and full coin value',()=>{
    const store=ledger();addGiftToLedger(store,event('one'));addGiftToLedger(store,event('ten',10));
    assert.equal(store.summary.count,11);assert.equal(store.summary.coins,110);assert.equal(store.summary.types,1);
    assert.equal(store.summary.collection[0].count,11);
    assert.equal(addGiftToLedger(store,event('ten',10)),false);assert.equal(store.pending.length,2);
});
test('collections stay separate per receiving streamer and preserve chronology across reloads',()=>{
    const alice=ledger(),bob=ledger();addGiftToLedger(alice,event('alice'));addGiftToLedger(bob,event('bob',3));
    const restored=JSON.parse(JSON.stringify(alice));addGiftToLedger(restored,{...event('later'),timestamp:5000});
    assert.equal(restored.summary.count,2);assert.equal(bob.summary.count,3);
    assert.equal(restored.summary.recent[0].at,5000);assert.equal(normalizeReceivedGift({type:'gift',...restored.summary.recent[0]}).at,5000);
    assert.equal(addGiftToLedger(restored,event('alice')),false);
});
test('recent, value, search and collected-only catalog filters use quantity/value separately',()=>{
    const summary=summarizeGifts([normalizeReceivedGift(event('a',10,1)),normalizeReceivedGift({...event('b',1,500),giftId:'2',giftName:'Big gift',timestamp:5000})]);
    assert.equal(summary.count,11);assert.equal(summary.coins,510);assert.equal(summary.recent[0].id,'2');
    assert.equal(filterGifts(summary.collection,{sort:'value'})[0].id,'2');
    assert.equal(filterGifts(summary.collection,{sort:'count'})[0].id,'1');
    assert.equal(filterGifts(summary.collection,{query:'big'})[0].id,'2');
    assert.deepEqual(filterGifts([{id:'1',name:'One'},{id:'3',name:'Three'}],{owned:true,collection:summary.collection}).map(g=>g.id),['1']);
});
test('LIVE normalizer carries TikTok image and catalog name while ignoring unfinished and repeated streaks',()=>{
    const normalize=createLiveEventNormalizer('session'),rawEvent={user:{uniqueId:'viewer'},giftId:1,giftDetails:{giftType:1},groupId:'streak',repeatCount:10};
    assert.equal(normalize('gift',{...rawEvent,repeatEnd:false},raw),null);
    const final=normalize('gift',{...rawEvent,repeatEnd:true},raw);
    assert.equal(final.giftName,'Test gift');assert.equal(final.giftImage,'https://example.com/gift.webp');assert.equal(final.coins,100);
    assert.equal(normalize('gift',{...rawEvent,repeatEnd:true},raw),null);
});
test('catalog cache survives restart, refreshes after TTL and retains last real data on TikTok failures',async t=>{
    const directory=await mkdtemp(path.join(tmpdir(),'tikinteract-gifts-'));t.after(()=>rm(directory,{recursive:true,force:true}));
    const file=path.join(directory,'catalog.json');let calls=0,time=1000,fail=false;
    const fetchGifts=async()=>{calls++;if(fail)throw new Error('offline');return[raw];};
    const cache=createGiftCatalog({file,fetchGifts,now:()=>time,ttl:100});
    const [one,two]=await Promise.all([cache.get('alice'),cache.get('alice')]);assert.equal(calls,1);assert.equal(one.gifts[0].id,two.gifts[0].id);
    await cache.get('alice');assert.equal(calls,1);
    const restarted=createGiftCatalog({file,fetchGifts,now:()=>time,ttl:100});await restarted.get('alice');assert.equal(calls,1);
    time+=200;await restarted.get('alice');assert.equal(calls,2);
    fail=true;const stale=await restarted.get('alice',{refresh:true});assert(stale.error);assert.equal(stale.gifts.length,1);
    const other=await restarted.get('bob',{refresh:true});assert.equal(other.username,'alice');assert(other.error);
});
test('switching streamers waits for old gift writes/session finish and a failed sync cannot block the next session',async()=>{
    const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
    const lifecycle=source.slice(source.indexOf('function startPlatformLiveSession('),source.indexOf('async function recordLeaderboardGift('));
    for(const failing of [false,true]){
        const calls=[];let release;const gate=new Promise(resolve=>{release=resolve;});
        const context={platformSessionActive:true,platformSessionUsername:'old',platformSessionPromise:null,platformFinishPromise:null,connectedUsername:'new',
            console:{warn(){},error(){}},document:{getElementById:()=>null},loadLeaderboard(){},setLeaderboardStatus(){},async ensureLiveStreamerProfile(){return true;},
            window:{tikInteractUser:{id:'test'},tikInteractSupabase:{async rpc(method){calls.push(method);return{error:null};}},
                TikInteractGifts:{async flush(name){calls.push('flush:'+name);if(name==='old'){await gate;if(failing)throw new Error('offline');}}}}};
        vm.createContext(context);vm.runInContext(lifecycle,context);
        const ending=context.finishPlatformLiveSession(),starting=context.startPlatformLiveSession('new');
        assert.deepEqual(calls,['flush:old']);release();await ending;await starting;await new Promise(resolve=>setImmediate(resolve));
        assert(calls.indexOf('finish_my_live_session')<calls.indexOf('start_my_live_session'));
        assert.equal(context.platformSessionActive,true);assert.equal(context.platformSessionUsername,'new');
    }
});


test('LIVE automatically links the connected profile to the signed-in owner and ignores stale account changes',async()=>{
    const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
    const helper=source.slice(source.indexOf('async function ensureLiveStreamerProfile('),source.indexOf('function startPlatformLiveSession('));
    for(const [existing,shouldSave] of [[null,true],[{tiktok_username:'TestStreamer'},false]]){
        const saved=[],lookups=[];
        const context={connectedUsername:'teststreamer',window:{tikInteractUser:{id:'owner-a'},tikInteractSupabase:{from(){return{select(){return{eq(column,id){lookups.push([column,id]);return{async maybeSingle(){return{data:existing,error:null};}};}};}};}}},async saveTikTokLeaderboardProfile(name){saved.push(name);return true;}};
        vm.createContext(context);vm.runInContext(helper,context);
        assert.equal(await context.ensureLiveStreamerProfile('teststreamer'),true);
        assert.deepEqual(lookups,[['user_id','owner-a']]);assert.equal(saved.length,shouldSave?1:0);
    }
    let release;const waiting=new Promise(resolve=>{release=resolve;});let saved=false;
    const context={connectedUsername:'teststreamer',window:{tikInteractUser:{id:'owner-a'},tikInteractSupabase:{from(){return{select(){return{eq(){return{maybeSingle:()=>waiting};}};}};}}},async saveTikTokLeaderboardProfile(){saved=true;return true;}};
    vm.createContext(context);vm.runInContext(helper,context);
    const pending=context.ensureLiveStreamerProfile('teststreamer');context.window.tikInteractUser={id:'owner-b'};release({data:null,error:null});
    assert.equal(await pending,false);assert.equal(saved,false);
});
