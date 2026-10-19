import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/game-access.js', import.meta.url), 'utf8');

function createGameAccess() {
    const window = {};
    vm.runInNewContext(source, {window});
    return window.TikInteractGameAccess;
}

test('Play Pass games remain categorized but unavailable until billing is configured', () => {
    const access = createGameAccess();
    for (const gameId of ['neon-race', 'neon-riders', 'country-derby']) {
        assert.equal(access.getPlan(gameId), 'play_pass');
        assert.equal(access.isAvailable(gameId), false);
        assert.match(access.getLockMessage(gameId), /Play Pass/);
        assert.match(access.getLockMessage(gameId), /configurarea plății/);
    }
});

test('free games remain available in LIVE Studio', () => {
    const access = createGameAccess();
    for (const gameId of ['neon-race-2', 'moto-interact', 'nova-vex']) {
        assert.equal(access.getPlan(gameId), 'free');
        assert.equal(access.isAvailable(gameId), true);
    }
});

test('unknown games fail closed', () => {
    const access = createGameAccess();
    assert.equal(access.getPlan('unknown-game'), null);
    assert.equal(access.isAvailable('unknown-game'), false);
});
