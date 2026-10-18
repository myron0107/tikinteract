import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function renderHomeLeaderboard('), source.indexOf('function setLeaderboardPeriod('));
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

test('home podium shows only the first five real profiles in ranking order', () => {
    const {context, list} = setup();
    context.renderHomeLeaderboard(profiles);
    assert.equal(list.children.length, 5);
    list.children.forEach((entry, index) => {
        assert.equal(entry.value, index + 1);
        assert.equal(entry.attributes['aria-label'], `Locul ${index + 1}`);
        assert(entry.children.some(child => child.textContent === profiles[index].tiktok_username));
        const score = entry.children.find(child => child.className === 'home-top-five-score');
        assert.equal(score.children[0].textContent, profiles[index].total_coins.toLocaleString('ro-RO'));
        assert.equal(score.children[1].textContent, 'monede');
    });
    const winnerIcon = list.children[0].children[0].children[0];
    assert.equal(winnerIcon.className, 'fa-solid fa-trophy');
});

test('incomplete or empty rankings do not fabricate podium participants', () => {
    const {context, list} = setup();
    for (const count of [5, 2, 1, 0]) {
        context.renderHomeLeaderboard(profiles.slice(0, count));
        assert.equal(list.children.length, count);
    }
});

test('home loads the all-time ranking and reports its top-five limit', async () => {
    const {context, list, status, requests} = setup(profiles);
    await context.loadHomeLeaderboard();
    assert.equal(requests[0][0], 'get_streamer_leaderboard');
    assert.equal(requests[0][1].p_period, 'all');
    assert.equal(list.children.length, 5);
    assert.equal(status.textContent, 'Top 5 · Clasament all-time');
});
