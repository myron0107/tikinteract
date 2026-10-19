import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function renderStreamerPodium('), source.indexOf('function renderLeaderboard('))
    + source.slice(source.indexOf('function renderHomeLeaderboard('), source.indexOf('function setLeaderboardPeriod('));
class Element {
    constructor() { this.children = []; this.attributes = {}; this.textContent = ''; this.classList = {add() {}, remove() {}}; }
    append(...children) { this.children.push(...children); }
    replaceChildren() { this.children = []; }
    setAttribute(key, value) { this.attributes[key] = value; }
}
function setup(profiles = []) {
    const list = new Element(), status = new Element();
    const requests = [];
    const context = {
        document: {getElementById: id => id === 'home-leaderboard-list' ? list : status, createElement: () => new Element()},
        createLeaderboardPerson: profile => Object.assign(new Element(), {textContent: profile.tiktok_username}),
        formatLiveTime: seconds => `${seconds || 0}s`,
        window: {tikInteractSupabase: {async rpc(...args) {requests.push(args); return {data: profiles};}}},
        console
    };
    vm.createContext(context);
    vm.runInContext(code, context);
    return {context, list, status, requests};
}
const profiles = Array.from({length: 8}, (_, i) => ({tiktok_username: `streamer${i + 1}`, total_coins: 8000 - i * 100, total_live_seconds: 60 + i}));

test('home uses the same 2-1-3 podium and only the first three real profiles', () => {
    const {context, list} = setup();
    context.renderHomeLeaderboard(profiles);
    assert.equal(list.children.length, 3);
    list.children.forEach((entry, index) => {
        const rank = [2, 1, 3][index];
        assert(entry.className.includes(`ranking-spot-${rank}`));
        assert.equal(entry.attributes['aria-label'], `Locul ${rank}: ${profiles[rank - 1].tiktok_username}`);
        assert(entry.children.some(child => child.textContent === profiles[rank - 1].tiktok_username));
        const block = entry.children.find(child => child.className === 'ranking-block');
        assert.equal(block.children[0].textContent, String(rank));
        assert.equal(block.children[1].textContent, `${profiles[rank - 1].total_coins.toLocaleString('ro-RO')} monede`);
    });
    const winnerIcon = list.children[1].children[0];
    assert.equal(winnerIcon.className, 'fa-solid fa-crown ranking-crown');
});

test('incomplete or empty rankings do not fabricate podium participants', () => {
    const {context, list} = setup();
    for (const count of [5, 2, 1, 0]) {
        context.renderHomeLeaderboard(profiles.slice(0, count));
        assert.equal(list.children.length, 3);
        assert.equal(list.children.filter(entry => !entry.className.includes('is-vacant')).length, Math.min(count, 3));
        list.children.filter(entry => entry.className.includes('is-vacant')).forEach(entry => {
            assert(entry.children.some(child => child.className === 'ranking-free-name' && child.textContent === 'Loc liber'));
        });
    }
});

test('home loads the all-time ranking and reports its top-three limit', async () => {
    const {context, list, status, requests} = setup(profiles);
    await context.loadHomeLeaderboard();
    assert.equal(requests[0][0], 'get_streamer_leaderboard');
    assert.equal(requests[0][1].p_period, 'all');
    assert.equal(list.children.length, 3);
    assert.equal(status.textContent, 'Top 3 · Clasament all-time');
});

test('home excludes the old example profile before selecting the top three', async () => {
    const {context, list} = setup([{tiktok_username:'numele_tau'},...profiles]);
    await context.loadHomeLeaderboard();
    assert(list.children[1].children.some(child => child.textContent === 'streamer1'));
    assert.equal(list.attributes['aria-busy'], 'false');
});

test('a failed home refresh clears old scores and shows unavailable values instead of invented zero activity', async () => {
    const {context, list, status} = setup(profiles);
    context.renderHomeLeaderboard(profiles);
    context.window.tikInteractSupabase.rpc = async () => ({error:{message:'Network failure'}});
    context.console = {error(){}};
    await context.loadHomeLeaderboard();
    assert.equal(list.children.filter(entry => entry.className.includes('is-vacant')).length, 3);
    assert.equal(list.children[0].children.find(child => child.className === 'ranking-block').children[1].textContent, '—');
    assert(status.textContent.includes('nu s-a putut'));
});
