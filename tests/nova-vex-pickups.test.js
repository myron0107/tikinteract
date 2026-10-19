import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../GAME/NOVA-VEX/src/simulation.js';
import { World } from '../GAME/NOVA-VEX/src/world.js';

test('world gifts are reproducible and only appear on safe, non-finish platforms', () => {
    const first = new World('pickup-seed', 500);
    const second = new World('pickup-seed', 500);
    const gifts = [];
    for (let level = 0; level <= 500; level++) {
        const platform = first.platform(level);
        assert.equal(platform.gift, second.platform(level).gift);
        if (!platform.gift) continue;
        gifts.push(platform.gift);
        assert(['balloon', 'magnet', 'cloud', 'rocket'].includes(platform.gift));
        assert(!['crumble', 'vanish', 'finish'].includes(platform.type));
    }
    first.branch(20);
    assert.equal([...first.cache.values()].find(platform => platform.branch)?.gift, null);
    assert(gifts.length > 0);
    assert.equal(first.platform(500).gift, null);
});

test('Nova collects a platform gift once and starts its positive effect', () => {
    const events = [];
    const simulation = new Simulation({ worldSeed: 'pickup-seed', finishDistance: 500 }, event => events.push(event));
    let platform;
    for (let level = 1; level < 500 && !platform; level++) {
        const candidate = simulation.world.platform(level);
        if (candidate.gift) platform = candidate;
    }
    assert(platform);

    simulation.land(platform);

    assert.equal(simulation.active?.kind, platform.gift);
    assert.equal(simulation.active?.simulated, true);
    assert.equal(simulation.active?.actor.displayName, 'Nova');
    assert.equal(simulation.world.hasGift(platform), false);
    assert.equal(simulation.world.collectGift(platform), null);
    assert(events.some(event => event.kind === 'effectStart' && event.action === platform.gift));
});
