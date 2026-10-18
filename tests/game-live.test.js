import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createLiveEventNormalizer } from '../lib/live-events.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const origin = 'http://127.0.0.1:3000';
const activeState = {connected:true, username:'creator', sessionId:'live'};

function wireGame(childGlobals = {}, register = true, early = false) {
    const hostListeners = [], childListeners = [];
    const host = {crypto:webcrypto, location:{origin}, Date};
    const child = {location:{origin}, Date, ...childGlobals};
    host.window = host;
    child.window = child;
    child.parent = host;
    host.addEventListener = (type, listener) => { if (type === 'message') hostListeners.push(listener); };
    child.addEventListener = (type, listener) => { if (type === 'message') childListeners.push(listener); };
    host.postMessage = data => hostListeners.forEach(listener => listener({source:child, origin, data}));
    child.postMessage = data => childListeners.forEach(listener => listener({source:host, origin, data}));
    vm.createContext(host); vm.createContext(child);
    vm.runInContext(read('assets/studio-live-bridge.js'), host);
    const frame = {contentWindow:child, dataset:{gameId:'test'}};
    let completions = 0;
    const token = host.TikInteractLive.prepare(frame, () => completions++);
    if (early) child.location.search = `?tikinteractHost=${token}`;
    host.TikInteractLive.setState(activeState);
    vm.runInContext(read('assets/game-live-sdk.js'), child);
    const received = [];
    if (register) child.TikInteractGame.register({onEvent:event => received.push(event)});
    return {host, child, frame, received, hostListeners, childListeners, completions:()=>completions};
}
function event(id, type = 'like') { return {type, username:'alice', sessionId:'live', eventId:id, timestamp:Date.now(), likeCount:10}; }

test('game becomes ready before image/window load; a later load does not reinitialize it', () => {
    const {host, frame, received, completions} = wireGame({}, true, true);
    assert.equal(completions(), 1);
    host.TikInteractLive.dispatch(event('early'));
    assert.equal(received.length, 1);
    host.TikInteractLive.loaded(frame);
    assert.equal(completions(), 1);
    host.TikInteractLive.dispatch(event('early'));
    assert.equal(received.length, 1);
});

test('handshake queues in order, deduplicates, and never forwards disconnected or stale sessions', () => {
    const {host, frame, received} = wireGame();
    host.TikInteractLive.dispatch(event('chat', 'chat'));
    host.TikInteractLive.dispatch(event('like'));
    assert.equal(received.length, 0);
    host.TikInteractLive.loaded(frame);
    assert.deepEqual(received.map(item => item.eventId), ['chat','like']);
    assert.equal(host.TikInteractLive.dispatch(event('like')), false);
    assert.equal(host.TikInteractLive.dispatch({...event('old'),sessionId:'old'}), false);
    host.TikInteractLive.setState({connected:false, sessionId:null});
    assert.equal(host.TikInteractLive.dispatch(event('offline')), false);
    assert.equal(received.length, 2);
});
test('late SDK registration completes handshake; only the current frame and origin are accepted', () => {
    const {host, child, frame, received, hostListeners, childListeners} = wireGame({}, false);
    host.TikInteractLive.loaded(frame);
    host.TikInteractLive.dispatch(event('queued'));
    child.TikInteractGame.register({onEvent:e => received.push(e)});
    assert.equal(received.length, 1);
    const bad = {channel:'tikinteract-live', version:1, type:'event', event:event('forged')};
    childListeners[0]({source:host, origin:'https://evil.example', data:bad});
    childListeners[0]({source:{}, origin, data:bad});
    hostListeners[0]({source:child, origin:'https://evil.example', data:{channel:'tikinteract-live',version:1,type:'ready'}});
    assert.equal(received.length, 1);
    host.TikInteractLive.detach();
    host.TikInteractLive.dispatch(event('detached'));
    assert.equal(received.length, 1);
});
test('bounded loading queue discards expired events and session changes clear pending events', () => {
    const {host, frame, received} = wireGame();
    host.TikInteractLive.dispatch({...event('expired'),timestamp:Date.now()-10000});
    for (let i=0; i<260; i++) host.TikInteractLive.dispatch(event(`batch-${i}`));
    host.TikInteractLive.loaded(frame);
    assert.equal(received.length, 250);
    assert.equal(received[0].eventId, 'batch-10');
    host.TikInteractLive.prepare(frame);
    host.TikInteractLive.dispatch(event('pending'));
    host.TikInteractLive.setState({...activeState,sessionId:'new'});
    host.TikInteractLive.loaded(frame);
    assert.equal(received.length, 250);
});
test('a future game can use typed callbacks without TikFinity or game-specific host code', () => {
    const {host, child, frame} = wireGame({}, false);
    const calls = [];
    child.TikInteractGame.register({onChat:e => calls.push(`chat:${e.message}`), onLike:e => calls.push(`likes:${e.likeCount}`), onGift:e => calls.push(`coins:${e.coins}`)});
    host.TikInteractLive.loaded(frame);
    host.TikInteractLive.dispatch({...event('c','chat'),message:'RED'});
    host.TikInteractLive.dispatch(event('l'));
    host.TikInteractLive.dispatch({...event('g','gift'),coins:15});
    assert.deepEqual(calls, ['chat:RED','likes:10','coins:15']);
});

function extractFunction(html, name) {
    const start = html.indexOf(`function ${name}(`);
    assert(start >= 0, name);
    const end = html.indexOf('\nfunction ', start+10);
    return html.slice(start, end);
}

for (const [id, file, derby] of [
    ['neon-race','GAME/NEON-RACE/Neon-Race.html',false],
    ['neon-riders','GAME/NEON-RIDERS/NEON-RIDERS.html',false],
    ['country-derby','GAME/COUNTRY-DERBY/COUNTRY-DERBY.html',true]
]) test(`${id}: actual chat, likes, gifts and race rules receive Studio events`, () => {
    const html = read(file);
    const nodes = new Map();
    const $ = id => {
        if (!nodes.has(id)) nodes.set(id, {textContent:'',classList:{remove(){},add(){}},click(){},style:{}});
        return nodes.get(id);
    };
    const joined = new Map(), totals = new Map();
    const teams = Array.from({length:derby?3:2}, () => ({score:0,likeEvents:[],likeTaps:0,likePower:0,giftSpeed:50,totalGiftPoints:0,giftEvents:[],attackPoints:0,nitroUnlocked:false,nitroSeconds:0,pendingGiftPoints:0,taps:0,gift:0,flashes:[]}));
    const globals = {
        $, document:{getElementById:$}, active:true, paused:false, teams,
        joined, joinedViewers:joined, totals, seen:new Set(), order:0,
        NAMES:['RED','BLUE','GREEN'], names:['RED','BLUE'],
        normalize:x=>String(x||'').toLowerCase(), normalizeViewer:x=>String(x||'').toLowerCase(),
        viewerId:d=>d.userId, updateUI(){}, updatePlayerCounts(){},log(){},recordSupporter(){},renderTops(){},liveFlash(){},
        gameClock:10,clock:10,remaining:120,LIKES_PER_SPEED:5,LIKE_MAX:100,BASE:50,
        attack:{lastAt:[-Infinity,-Infinity]},ATTACK_COOLDOWN:5,checkAttack(){},
        NITRO_SECONDS_PER_POINT:.03,GIFT_NITRO_CHUNK:100,lastGiftSound:0,lastLikeSound:0,
        pulse(){},soundEffect(){},render(){},speedOf:t=>5+t.taps+t.gift,chime(){}
    };
    const {host, child, frame} = wireGame(globals, false);
    vm.runInContext(extractFunction(html, 'interact'), child);
    vm.runInContext(extractFunction(html, 'receiveChat').split('// Integration point')[0], child);
    const start = html.indexOf('function liveEvent(');
    const end = html.indexOf(derby ? '\nlet socket=' : '\nlet lastLiveVisualAt',start);
    vm.runInContext(html.slice(start,end), child);
    vm.runInContext(read('assets/legacy-game-adapter.js'), child);
    host.TikInteractLive.loaded(frame);
    const normalize = createLiveEventNormalizer('live');
    const send = (type, raw) => host.TikInteractLive.dispatch(normalize(type, raw));
    const user = {uniqueId:'alice'};
    send('chat', {user,comment:derby?'GREEN':'RED',msgId:'join'});
    const team = derby ? 2 : 0;
    assert.equal(joined.get('alice'), team);
    send('like', {user,count:25,msgId:'likes'});
    assert.equal(derby?teams[team].taps:teams[team].score, derby?5:25);
    const gift = normalize('gift', {user,giftDetails:{giftType:1,diamondCount:5},repeatCount:3,repeatEnd:1,msgId:'gift'});
    host.TikInteractLive.dispatch(gift);
    assert.equal(derby?teams[team].gift:teams[team].totalGiftPoints, 15);
    host.TikInteractLive.dispatch(gift);
    assert.equal(derby?teams[team].gift:teams[team].totalGiftPoints, 15);
    assert.equal(teams[team === 0 ? 1 : 0].score, 0);
    if (derby) { assert.equal(totals.values().next().value.likes, 25); assert.equal(totals.values().next().value.points, 15); }
});
