// Isolated UI verification: synthetic profiles, no LIVE connection or database writes.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {openSkyShiftBrowser} from './skyshift-browser.mjs';
import {installQAAuth} from './qa-auth-fixture.mjs';

const origin = process.env.MEDIA_ROOT || 'http://127.0.0.1:3005';
const output = '.tools/leaderboard-qa';
await mkdir(output, {recursive: true});
const browser = await openSkyShiftBrowser('leaderboard-layout-test');
try {
    await browser.page('Page.addScriptToEvaluateOnNewDocument', {source: `
        (${installQAAuth.toString()})(false);
        window.__rankingRows = [];
        window.__rankingCalls = [];
        window.__rankingError = false;
        window.__rankingPending = [];
        window.__rankingDelay = false;
        var client = window.supabase.createClient();
        var originalRPC = client.rpc.bind(client);
        client.rpc = async function(name, args) {
            if (name !== 'get_streamer_leaderboard') return originalRPC(name, args);
            window.__rankingCalls.push(args);
            if (window.__rankingDelay) return new Promise(resolve => window.__rankingPending.push(resolve));
            return window.__rankingError ? {data:null,error:{message:'QA failure'}} : {data:window.__rankingRows,error:null};
        };
    `});
    await browser.page('Emulation.setDeviceMetricsOverride', {width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await browser.page('Page.navigate', {url:`${origin}/index.html?view=leaderboard`});
    await browser.waitFor("window.__rankingCalls?.some(c=>c.p_period==='7d') && document.querySelector('#leaderboard-podium')?.getAttribute('aria-busy')==='false'");
    await browser.evaluate('document.fonts.ready');
    assert.equal(await browser.evaluate("document.querySelector('[data-leaderboard-period].is-active').dataset.leaderboardPeriod"), '7d');
    assert.equal(await browser.evaluate("document.querySelectorAll('#view-leaderboard .ranking-spot.is-vacant').length"), 3);
    assert.equal(await browser.evaluate("document.querySelector('#leaderboard-empty').classList.contains('hidden')"), false);
    await browser.screenshot(`${output}/empty-desktop.webp`);
    await browser.evaluate(`window.__rankingRows = Array.from({length:8}, (_,i) => ({
        tiktok_username:'creator_'+(i+1),
        tiktok_display_name:i===0?'Streamer cu un nume foarte lung pentru verificare':i===1?'<img src=x onerror=alert(1)>':'Creator '+(i+1),
        avatar_url:i===1?'javascript:alert(1)':null,
        total_coins:18000-i*1500,
        total_live_seconds:3600+i*150
    })); loadLeaderboard();`);
    await browser.waitFor("document.querySelectorAll('#leaderboard-list tr').length===8");
    assert.deepEqual(await browser.evaluate("Array.from(document.querySelectorAll('#view-leaderboard .ranking-spot')).map(e=>e.className.split(' ')[1])"), ['ranking-spot-2','ranking-spot-1','ranking-spot-3']);
    assert.equal(await browser.evaluate("document.querySelectorAll('#leaderboard-podium img').length"), 0);
    assert.equal(await browser.evaluate("Array.from(document.querySelectorAll('#leaderboard-podium .leaderboard-avatar')).every(e=>Math.abs(e.getBoundingClientRect().width-e.getBoundingClientRect().height)<1)"), true);
    assert.equal(await browser.evaluate("document.querySelector('#leaderboard-total-creators').textContent"), '8');
    assert.equal(await browser.evaluate("document.querySelector('#leaderboard-total-coins').textContent"), (102000).toLocaleString('ro-RO'));
    await browser.evaluate("document.querySelector('#view-leaderboard .ranking-spot-1 .streamer-gifts-button').click()");
    await browser.waitFor("document.querySelector('.gifts-dialog')?.open");
    assert(await browser.evaluate("document.querySelector('#gift-profile-title').textContent.includes('Streamer')"));
    await browser.evaluate("document.querySelector('[data-gift-dialog-close]').click()");
    await browser.screenshot(`${output}/populated-desktop.webp`);
    await browser.evaluate("document.querySelector('.ranking-body').scrollIntoView({block:'start'})");
    await browser.screenshot(`${output}/results-desktop.webp`);
    for (const period of ['24h','30d','all','7d']) {
        await browser.evaluate(`document.querySelector('[data-leaderboard-period="${period}"]').click()`);
        await browser.waitFor("document.querySelector('#leaderboard-podium').getAttribute('aria-busy')==='false'");
        assert.equal(await browser.evaluate('window.__rankingCalls.at(-1).p_period'), period);
        assert.equal(await browser.evaluate(`document.querySelector('[data-leaderboard-period="${period}"]').getAttribute('aria-pressed')`), 'true');
    }
    for (const width of [320,390,768]) {
        await browser.page('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:true});
        await browser.evaluate('window.scrollTo(0,0)');
        const geometry = await browser.evaluate(`(() => {
            const cards = [...document.querySelectorAll('#view-leaderboard .ranking-spot')].map(e=>e.getBoundingClientRect());
            return {overflow:document.documentElement.scrollWidth>innerWidth,
                order:cards[0].x<cards[1].x&&cards[1].x<cards[2].x,
                winner:cards[1].y<cards[0].y&&cards[1].y<cards[2].y};
        })()`);
        assert.equal(geometry.overflow, false, `No horizontal overflow at ${width}px`);
        assert(geometry.order && geometry.winner, `Podium geometry at ${width}px`);
        assert.equal(await browser.evaluate("Array.from(document.querySelectorAll('#leaderboard-podium .leaderboard-avatar')).every(e=>Math.abs(e.getBoundingClientRect().width-e.getBoundingClientRect().height)<1)"), true);
        await browser.screenshot(`${output}/populated-${width}.webp`);
        await browser.evaluate("document.querySelector('.ranking-body').scrollIntoView({block:'start'})");
        await browser.screenshot(`${output}/results-${width}.webp`);
    }
    // The homepage shares the exact podium and limits the real profiles to three.
    await browser.evaluate("switchView('home');loadHomeLeaderboard()");
    await browser.waitFor("document.querySelector('#home-leaderboard-status').textContent.includes('Top 3')");
    assert.equal(await browser.evaluate("document.querySelectorAll('#home-leaderboard-list .ranking-spot').length"),3);
    assert.equal(await browser.evaluate("document.querySelector('#home-leaderboard-list .ranking-spot-1 a').textContent"),'Streamer cu un nume foarte lung pentru verificare');
    for (const width of [1440,390,320]) {
        await browser.page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
        await browser.evaluate("document.querySelector('.home-leaderboard-section').scrollIntoView({block:'start',behavior:'instant'});scrollBy({top:-140,behavior:'instant'})");
        await browser.waitFor("Math.abs(document.querySelector('.home-leaderboard-section').getBoundingClientRect().top-140)<2");
        assert.equal(await browser.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
        const geometry=await browser.evaluate(`(() => {
            const cards=[...document.querySelectorAll('#home-leaderboard-list .ranking-spot')].map(e=>e.getBoundingClientRect());
            return {order:cards[0].x<cards[1].x&&cards[1].x<cards[2].x,winner:cards[1].y<cards[0].y&&cards[1].y<cards[2].y,circles:[...document.querySelectorAll('#home-leaderboard-list .leaderboard-avatar')].every(e=>Math.abs(e.offsetWidth-e.offsetHeight)<1)};
        })()`);
        assert(geometry.order&&geometry.winner&&geometry.circles,`Home podium geometry at ${width}px`);
        await browser.screenshot(`${output}/home-top-three-${width}.webp`);
    }
    await browser.evaluate("window.__homeTestRows=window.__rankingRows;window.__rankingRows=[];loadHomeLeaderboard()");
    await browser.waitFor("document.querySelector('#home-leaderboard-list').getAttribute('aria-busy')==='false'");
    assert.equal(await browser.evaluate("document.querySelectorAll('#home-leaderboard-list .ranking-spot.is-vacant').length"),3);
    await browser.screenshot(`${output}/home-top-three-empty-mobile.webp`);
    await browser.evaluate("window.__rankingRows=window.__homeTestRows;switchView('leaderboard')");
    await browser.waitFor("document.querySelectorAll('#leaderboard-list tr').length===8");
    // Slower old period must never replace the newer selected period.
    await browser.evaluate("window.__rankingDelay=true;setLeaderboardPeriod('24h');setLeaderboardPeriod('30d')");
    assert.equal(await browser.evaluate("document.querySelector('#leaderboard-table-wrap').classList.contains('hidden')"), true);
    await browser.evaluate("window.__rankingPending[1]({data:window.__rankingRows.slice(0,1),error:null})");
    await browser.waitFor("document.querySelectorAll('#leaderboard-list tr').length===1");
    await browser.evaluate("window.__rankingPending[0]({data:window.__rankingRows,error:null})");
    assert.equal(await browser.evaluate("document.querySelectorAll('#leaderboard-list tr').length"), 1);
    assert.equal(await browser.evaluate("document.querySelectorAll('#view-leaderboard .ranking-spot.is-vacant').length"), 2);
    await browser.evaluate("window.__rankingDelay=false;window.__rankingError=true;loadLeaderboard()");
    await browser.waitFor("document.querySelector('#leaderboard-status')?.classList.contains('is-error')");
    assert.equal(await browser.evaluate("document.querySelector('#leaderboard-empty').classList.contains('hidden')"), true);
    assert.equal(await browser.evaluate("document.querySelector('#leaderboard-total-coins').textContent"), '—');
    await browser.evaluate("window.__rankingError=false;window.__rankingRows=[];loadLeaderboard()");
    await browser.waitFor("!document.querySelector('#leaderboard-empty').classList.contains('hidden')");
    assert.equal(await browser.evaluate("document.querySelector('#leaderboard-status').classList.contains('is-error')"), false);
    assert.deepEqual(browser.errors, []);
    console.log('Leaderboard passed: empty, populated, safe profiles, gift collections, periods, totals, 320/390/768px, homepage top three, stale responses, error and recovery.');
} catch (error) {
    console.error(await browser.evaluate("({status:document.querySelector('#leaderboard-status')?.textContent, calls:window.__rankingCalls, errors:window.__rankingError})"), browser.errors);
    throw error;
} finally {
    await browser.close();
}
