import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/live-streams.js', import.meta.url), 'utf8');

test('live-streams module provides complete metadata for all interactive games', () => {
    assert.match(source, /'neon-race-2'/);
    assert.match(source, /'moto-interact'/);
    assert.match(source, /'nova-vex'/);
    assert.match(source, /'country-derby'/);
    assert.match(source, /'neon-riders'/);
});

test('live-streams card renders TikTok live link and game info', () => {
    assert.match(source, /https:\/\/www\.tiktok\.com\/@/);
    assert.match(source, /\/live/);
    assert.match(source, /stream-live-pill/);
    assert.match(source, /stream-game-tag/);
    assert.match(source, /get_active_live_streams/);
});

test('public navigation contains games, streams and leaderboard; plans remain on the homepage', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const nav=html.slice(html.indexOf('<nav class="template-navigation"'),html.indexOf('</nav>',html.indexOf('<nav class="template-navigation"')));
    assert.deepEqual([...nav.matchAll(/data-nav-item="([^"]+)"/g)].map(m=>m[1]),['catalog','streams','leaderboard']);
    assert.match(html,/id="approved-home-plans"/);
    assert.match(nav,/data-nav-item="streams" onclick="switchView\('streams'\)"/);
    assert.match(html, /id="view-streams"/);
    assert.match(html, /id="streams-grid"/);
    assert.match(html, /id="streams-empty-state"/);
});

