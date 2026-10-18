import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fetchTikTokGiftCatalog,TIKTOK_GIFT_SOURCE} from '../lib/tiktok-gift-source.js';
import {createGiftCatalog} from '../lib/gift-catalog.js';
import {giftImageSources,safeGiftImage} from '../assets/tiktok-gifts-data.js';
import {createLiveEventNormalizer} from '../lib/live-events.js';

test('catalog reads the public TikTok route without requiring a username, room or LIVE connection',async()=>{
    const connection={webClient:{clientParams:{aid:'1988'},async getJsonObjectFromWebcastApi(route,params,signed){
        assert.equal(route,'gift/list/');assert.equal(params.region,'RO');assert.equal(signed,false);assert.equal(params.room_id,undefined);
        return{status_code:0,data:{gifts:[{id:42,name:'TEST gift',diamond_count:5,image:{url_list:['https://p16-webcast.tiktokcdn.com/test.webp']}}]}};
    }}};
    const catalog=await fetchTikTokGiftCatalog({connection});
    assert.equal(catalog.source,TIKTOK_GIFT_SOURCE);assert.equal(catalog.scope,'catalog');assert.equal(catalog.username,null);assert.equal(catalog.gifts[0].coins,5);
});

test('original TikTok artwork is complete and copied byte for byte into the bundled catalog',async()=>{
    const snapshot=JSON.parse(await readFile(new URL('../assets/tiktok-gifts-catalog.json',import.meta.url),'utf8'));
    assert.equal(snapshot.source,TIKTOK_GIFT_SOURCE);assert(snapshot.gifts.length>0);
    assert.equal(new Set(snapshot.gifts.map(g=>g.id)).size,snapshot.gifts.length);
    assert.equal(Object.keys(snapshot.imageFiles).length,snapshot.gifts.length);
    const checked=new Set();
    for(const gift of snapshot.gifts){
        assert(new URL(gift.image).hostname.endsWith('.tiktokcdn.com'));
        assert(Number.isInteger(gift.coins)&&gift.coins>=0);
        const file=snapshot.imageFiles[gift.id];assert.match(file,/^assets\/tiktok-gift-images\/[a-f0-9]{64}\.(webp|png|jpg)$/);
        if(checked.has(file))continue;checked.add(file);
        const bytes=await readFile(new URL('../'+file,import.meta.url));
        assert.equal(createHash('sha256').update(bytes).digest('hex'),path.basename(file).split('.')[0]);
    }
    const rose=snapshot.gifts.find(g=>g.id==='5655');assert.equal(rose.name,'Rose');
    const normalized=createLiveEventNormalizer('test-session')('gift',{user:{uniqueId:'test-sender'},giftId:rose.id,repeatEnd:true,repeatCount:10,groupId:'roses'},rose);
    assert.equal(normalized.giftName,rose.name);assert.equal(normalized.giftImage,rose.image);assert.equal(normalized.repeatCount,10);assert.equal(normalized.coins,10*rose.coins);
});

test('image alternatives skip unsafe/broken first URLs and retain genuine CDN fallbacks',()=>{
    const source={url_list:['javascript:alert(1)','https://p16-webcast.tiktokcdn.com/a.webp','https://p19-webcast.tiktokcdn.com/a.webp']};
    assert.equal(safeGiftImage(source),'https://p16-webcast.tiktokcdn.com/a.webp');assert.equal(giftImageSources(source).length,2);
});

test('a complete bundled catalog is available offline, without a streamer or received gifts',async t=>{
    const directory=await mkdtemp(path.join(tmpdir(),'tiktok-catalog-seed-'));t.after(()=>rm(directory,{recursive:true,force:true}));
    const seedFile=path.join(directory,'seed.json'),file=path.join(directory,'cache.json');
    await writeFile(seedFile,JSON.stringify({scope:'catalog',updatedAt:1000,source:TIKTOK_GIFT_SOURCE,gifts:[{id:'1',name:'TEST gift',coins:1,image:'https://example.com/one.webp'}]}));
    let calls=0;const cache=createGiftCatalog({file,seedFile,now:()=>1100,fetchGifts:async()=>{calls++;throw Error('offline');}});
    assert.equal((await cache.get()).gifts.length,1);assert.equal(calls,0);
    const fallback=await cache.get(null,{refresh:true});assert.equal(fallback.gifts.length,1);assert(fallback.error);
    const expanded=await cache.ingest([{id:'2',name:'TEST room gift',coins:2}],'test-streamer');
    assert.equal(expanded.gifts.length,2);assert.equal(expanded.scope,'catalog');
});
