import assert from 'node:assert/strict';
import {Simulation} from '../GAME/NEON-ASCENT/src/simulation.js';
import {capture,restore} from '../GAME/NEON-ASCENT/src/recovery.js';

const renderer=()=>({giftFX:{bursts:[]}});
const old=new Simulation({meteorMeters:300,vortexMeters:150,soundVolume:.17});
old.wins=42;old.action({action:'meteor',amount:2,commandId:'already-accepted'});old.step();
const legacy=capture(old,renderer(),[{job:{action:'meteor',delta:-600}}]);
delete legacy.giftValuesVersion;
legacy.simulation.pendingSettings={...legacy.simulation.settings};
const sim=new Simulation(),r=renderer(),migrated=restore(legacy,sim,r);
for(const settings of [sim.settings,sim.pendingSettings]){
  assert.equal(settings.meteorMeters,150);assert.equal(settings.vortexMeters,300);
  assert.equal(settings.soundVolume,.17);
}
assert.equal(sim.wins,42);assert.equal(sim.active.delta,-600,'Do not reprice accepted gifts');
assert.equal(sim.seen.has('already-accepted'),true,'Preserve replay protection');
assert.deepEqual(migrated.labels,legacy.labels);
assert.equal(legacy.simulation.settings.meteorMeters,300,'Do not mutate the input checkpoint');
const reloaded=new Simulation();restore(migrated,reloaded,renderer());
assert.equal(reloaded.settings.meteorMeters,150);assert.equal(reloaded.settings.vortexMeters,300);

const custom=structuredClone(legacy);custom.simulation.settings.meteorMeters=75;custom.simulation.settings.vortexMeters=900;
const customSim=new Simulation();restore(custom,customSim,renderer());
assert.equal(customSim.settings.meteorMeters,75);assert.equal(customSim.settings.vortexMeters,900);
const current=capture(new Simulation({meteorMeters:300,vortexMeters:150}),renderer());
const currentSim=new Simulation();restore(current,currentSim,renderer());
assert.equal(currentSim.settings.meteorMeters,300,'Apply the legacy migration only once');
console.log('Legacy saved values migrate to push -150 / ride -300; reload, pending settings, preferences, accepted gifts and replay IDs preserved.');
