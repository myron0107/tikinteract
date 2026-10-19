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

test('retired games cannot be launched and remain preserved for future use', () => {
    const access = createGameAccess();
    for (const gameId of ['neon-race', 'neon-riders', 'country-derby']) {
        assert.equal(access.getPlan(gameId), null);
        assert.equal(access.isAvailable(gameId), false);
        assert.equal(access.getLockMessage(gameId), 'Jocul nu este disponibil.');
        const studio = readFileSync(new URL('../live-studio.html', import.meta.url), 'utf8');
        assert(!studio.includes(`data-game-id="${gameId}"`));
        assert(!studio.includes(`<option value="${gameId}">`));
        const folder = gameId.toUpperCase();
        assert(readFileSync(new URL(`../GAME/${folder}/index.html`, import.meta.url), 'utf8').length > 0);
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
