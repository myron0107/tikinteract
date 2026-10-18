// Capture the real game renderer in an isolated headless Chrome profile.
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';
import {installQAAuth} from './qa-auth-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.tools/tiktok-gifts');
const profile = path.join(root, '.tools/tiktok-gifts-qa-chrome');
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
    await page('Page.addScriptToEvaluateOnNewDocument',{source:'('+installQAAuth.toString()+')(true)'});
    await page('Emulation.setDeviceMetricsOverride',{width:540,height:960,deviceScaleFactor:2,mobile:false});

    const waitFor=async expression=>{for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+expression);};
    const settle=(ms=400)=>new Promise(r=>setTimeout(r,ms));
    const assert=async(expression,message)=>{if(!await evaluate(expression))throw new Error(message);};

    const capture=async name=>{const shot=await page('Page.captureScreenshot',{format:'webp',quality:90});await writeFile(path.join(output,name+'.webp'),Buffer.from(shot.data,'base64'));};
    const installFixtures=()=>{
        // This isolated browser has an in-memory RPC stub: no real profile writes.
        window.__giftFixture={ready:false,coins:new Map(),details:new Map()};
        window.tikInteractUser={id:'isolated-gifts-test'};
        window.waitForTikInteractLiveSession=async()=>true;
        window.tikInteractSupabase={async rpc(method,p){
            const db=window.__giftFixture;
            if(method==='record_my_live_gift'){
                const fresh=!db.coins.has(p.p_event_id);db.coins.set(p.p_event_id,p.p_coins);return{data:fresh,error:null};
            }
            if(!db.ready)return{error:{code:'PGRST202'}};
            if(method==='record_my_live_gift_details'){
                const fresh=!db.details.has(p.p_event_id);db.details.set(p.p_event_id,{...p,at:Date.now()});db.coins.set(p.p_event_id,p.p_coins);return{data:fresh,error:null};
            }
            if(method==='get_streamer_gift_collection'){
                const entries=[...db.details.values()].filter(g=>g.p_tiktok_username===p.p_tiktok_username),groups=new Map();
                for(const g of entries){const row=groups.get(g.p_gift_id)||{id:g.p_gift_id,name:g.p_gift_name,image:g.p_gift_image,unitCoins:g.p_unit_coins,count:0,coins:0,firstAt:g.at,lastAt:g.at};row.count+=g.p_quantity;row.coins+=g.p_coins;groups.set(row.id,row);}
                return{data:{username:p.p_tiktok_username,count:entries.reduce((s,g)=>s+g.p_quantity,0),coins:entries.reduce((s,g)=>s+g.p_coins,0),types:groups.size,collection:[...groups.values()],recent:entries.map(g=>({eventId:g.p_event_id,id:g.p_gift_id,name:g.p_gift_name,image:g.p_gift_image,quantity:g.p_quantity,unitCoins:g.p_unit_coins,coins:g.p_coins,sender:g.p_sender,at:g.at})).reverse()},error:null};
            }
            return{data:[],error:null};
        }};
    };
    const seed=async()=>{
        await evaluate('('+installFixtures.toString()+')()');
        await evaluate("TikInteractGifts.receiveCatalog({gifts:[{id:'fixture-1',name:'TEST · Cadou mic',diamond_count:10},{id:'fixture-2',name:'TEST · Cadou mare',diamond_count:500},{id:'fixture-3',name:'TEST · Necolectat',diamond_count:1}],updatedAt:Date.now(),username:'teststreamer'});TikInteractGifts.setProfile('teststreamer');connectedUsername='teststreamer';TikInteractLive.setState({connected:true,username:'teststreamer',sessionId:'gifts-isolated-test'});setLiveStudioTab('gifts');document.querySelector('[data-gifts-view=collection]').click()");
        await evaluate("window.__testGift={type:'gift',sessionId:'gifts-isolated-test',eventId:crypto.randomUUID(),timestamp:Date.now(),username:'testsender',displayName:'TEST Sender',giftId:'fixture-1',giftName:'TEST · Cadou mic',repeatCount:1,diamondCount:10,coins:10};handleTikTokEvent(__testGift);handleTikTokEvent({...__testGift,eventId:crypto.randomUUID(),repeatCount:10,coins:100});window.__testBig={...__testGift,eventId:crypto.randomUUID(),giftId:'fixture-2',giftName:'TEST · Cadou mare',diamondCount:500,coins:500};handleTikTokEvent(__testBig);handleTikTokEvent(__testBig)");
        await settle(500);
    };
    for(const width of [1440,390]){
        await page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
        await page('Page.navigate',{url:'http://localhost:3000/live-studio.html'});
        await waitFor("window.TikInteractGifts && typeof handleTikTokEvent==='function'");await evaluate('document.fonts.ready');await settle(500);await evaluate('closeAuthModal()');
        await evaluate("localStorage.removeItem('tikinteract-gift-catalog-v1');localStorage.removeItem('tikinteract-gifts-v1:teststreamer');localStorage.removeItem('tikinteract_tiktok_user')");
        await page('Page.reload');await waitFor("window.TikInteractGifts && window.tikInteractUser");
        await evaluate("setLiveStudioTab('gifts')");
        const originalCatalog=JSON.parse(await readFile(path.join(root,'assets/tiktok-gifts-catalog.json'),'utf8'));
        await waitFor("document.querySelectorAll('#gifts-content .gift-card').length===60 && document.querySelector('#gifts-content img')?.naturalWidth>0");
        await assert("document.querySelector('#gifts-result-count').textContent.startsWith('"+originalCatalog.gifts.length+"') && document.getElementById('gifts-summary').hidden && !document.getElementById('live-game-frame').getAttribute('src')",'Original TikTok catalog must be available without receiving gifts or starting a LIVE');
        await assert("[...document.querySelectorAll('#gifts-content img')].every(image=>image.src.includes('/assets/tiktok-gift-images/') && image.dataset.tiktokSource.startsWith('https://p16-webcast.tiktokcdn.com/'))",'All gift artwork must use original imported TikTok images');
        await capture('original-tiktok-catalog-'+width);
        await evaluate('('+installFixtures.toString()+')()');
        await evaluate("(async()=>{localStorage.removeItem('tikinteract-gifts-v1:originalgiftqa');TikInteractGifts.setProfile('originalgiftqa');await TikInteractGifts.record({type:'gift',eventId:crypto.randomUUID(),giftId:'5655',giftName:'Rose',repeatCount:5,diamondCount:1,coins:5,displayName:'TEST Sender',timestamp:Date.now()},'originalgiftqa');document.querySelector('[data-gifts-view=collection]').click();})()");
        await waitFor("document.querySelector('#gifts-content [data-gift-id=\"5655\"] img')?.naturalWidth>0");
        await assert("document.querySelector('#gifts-content .gift-card h3').textContent==='Rose' && document.querySelector('#gifts-content .gift-owned').textContent.includes('5') && document.querySelector('#gifts-content img').src.includes('/assets/tiktok-gift-images/')",'Received roses must show their cumulative quantity and original TikTok image even without event artwork');
        await capture('original-rose-collection-'+width);
        await evaluate("document.querySelector('[data-gifts-view=catalog]').click()");
        await evaluate("document.getElementById('gifts-search').value='5655';document.getElementById('gifts-search').dispatchEvent(new Event('input'))");
        await assert("document.querySelectorAll('#gifts-content .gift-card').length===1 && document.querySelector('#gifts-content .gift-card h3').textContent==='Rose'",'TikTok Rose ID, name and image must be preserved');
        await evaluate("document.getElementById('gifts-search').value='';document.getElementById('gifts-search').dispatchEvent(new Event('input'));while(!document.getElementById('gifts-more').hidden)document.getElementById('gifts-more').click()");
        await assert("document.querySelectorAll('#gifts-content .gift-card').length==="+originalCatalog.gifts.length,'Every imported gift must be reachable through pagination');
        // Clear only the disposable browser's fixture ledger between widths.
        await evaluate("localStorage.removeItem('tikinteract-gifts-v1:teststreamer')");
        await seed();
        await assert("document.querySelector('#gifts-summary .gifts-stat strong').textContent==='12' && document.querySelectorAll('#gifts-content .gift-card').length===2",'Quantity/collection count failed');
        await assert("document.querySelectorAll('#gifts-summary .gifts-stat strong')[1].textContent==='610' && __giftFixture.coins.size===3",'Coins must preserve repeated gifts and deduplicate the same UUID');
        await assert("!document.getElementById('live-game-frame').getAttribute('src') && document.documentElement.scrollWidth<=innerWidth",'Gift collection must work without starting a game or overflowing mobile');
        await capture('collection-'+width);
        await evaluate("document.querySelector('[data-gifts-view=recent]').click()");await assert("document.querySelectorAll('.gift-recent-row').length===3",'Recent gifts missing');await capture('recent-'+width);
        await evaluate("document.querySelector('[data-gifts-view=highlights]').click()");await assert("document.querySelector('#gifts-content .gift-card h3').textContent==='TEST · Cadou mare'",'Most valuable must use unit value');
        await evaluate("document.querySelector('[data-gifts-view=catalog]').click()");await assert("document.querySelectorAll('#gifts-content .gift-card').length===3",'Full available catalog missing');
        await evaluate("document.getElementById('gifts-search').value='necolectat';document.getElementById('gifts-search').dispatchEvent(new Event('input'))");await assert("document.querySelectorAll('#gifts-content .gift-card').length===1",'Gift search failed');
        await evaluate("document.getElementById('gifts-search').value='';document.getElementById('gifts-search').dispatchEvent(new Event('input'));document.getElementById('gifts-owned-only').checked=true;document.getElementById('gifts-owned-only').dispatchEvent(new Event('change'))");await assert("document.querySelectorAll('#gifts-content .gift-card').length===2",'Collected-only filter failed');await capture('catalog-'+width);
        await evaluate("__giftFixture.ready=true;TikInteractGifts.flush('teststreamer')");await settle(200);
        await assert("__giftFixture.details.size===3 && [...__giftFixture.coins.values()].reduce((a,b)=>a+b,0)===610 && JSON.parse(localStorage.getItem('tikinteract-gifts-v1:teststreamer')).pending.length===0",'Cloud activation must enrich queued events without adding coins twice');
        await evaluate("TikInteractGifts.openCollection({tiktok_username:'teststreamer',tiktok_display_name:'TEST Streamer'})");await settle(200);await assert("document.querySelector('.gifts-dialog').open && document.querySelectorAll('.gifts-dialog .gift-card').length===2",'Public collection dialog failed');await capture('profile-'+width);
        await evaluate("document.querySelector('[data-gift-dialog-close]').click();localStorage.setItem('tikinteract_tiktok_user','@teststreamer')");
        await page('Page.reload');await waitFor("window.TikInteractGifts && typeof setLiveStudioTab==='function'");await settle(400);await evaluate("closeAuthModal();setLiveStudioTab('gifts');document.querySelector('[data-gifts-view=collection]').click()");await settle(200);
        await assert("document.querySelector('#gifts-summary .gifts-stat strong').textContent==='12' && !document.getElementById('live-game-frame').getAttribute('src')",'Reload must preserve gifts and keep games stopped');
        console.log('Verified Gifts collection, quantity/coins, streaks, deduplication, recent/valuable/catalog/search, missing-schema fallback, cloud replay and dialog at '+width+'px.');
    }
    await page('Page.navigate',{url:'http://localhost:3000/'});await waitFor("window.TikInteractGifts && typeof createLeaderboardPerson==='function'");
    await evaluate("window.__giftButton=createLeaderboardPerson({tiktok_username:'teststreamer',tiktok_display_name:'TEST Streamer'}).querySelector('.streamer-gifts-button')");
    await assert("__giftButton?.getAttribute('aria-label').includes('teststreamer')",'Leaderboard profile collection entry missing');
    console.log('No real TikTok connection was opened and no Supabase profile/statistics were written.');
    await send('Browser.close');
}finally{socket?.close();processChrome.kill();}

