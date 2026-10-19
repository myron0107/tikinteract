import { World } from './world.js';
import { CommandIds } from './commands.js';
import {DEFAULTS} from './config.js';

const GIFT_VALUES_VERSION=2;

const SIMULATION = ['settings', 'clock', 'round', 'wins', 'paused', 'ended', 'phase', 'queue', 'active', 'pendingSettings', 'hold', 'celebration', 'history', 'localId', 'requestedMetersExact', 'ledger', 'player', 'previous', 'distance', 'autoTarget', 'presentationErrors', 'cinematicUntil'];
const SCENES = ['camera', 'giftTracked', 'particles', 'moment', 'scoreJobs', 'scoreMoment', 'portalJobs', 'portalMoment', 'sceneLedger', 'sceneSequence', 'pendingVisualUnits', 'backgroundKey', 'backgroundPrevious', 'backgroundChanged', 'presentedWins'];

// One atomic record contains mechanics, replay IDs and the actual visual queue.
// Nothing in this checkpoint retains images, audio nodes or DOM references.
export function capture(sim, renderer, labels = [], language = 'ro') {
  return structuredClone({
    format: 1,
    giftValuesVersion:GIFT_VALUES_VERSION,
    simulation: Object.fromEntries(SIMULATION.map(key => [key, sim[key]])),
    ids: { ranges: sim.seen.ranges, local: [...sim.seen.local] },
    world: { cache: [...sim.world.cache], unavailable: [...sim.world.unavailable] },
    scenes: Object.fromEntries(SCENES.map(key => [key, renderer[key]])),
    effects: { bursts: renderer.giftFX.bursts, lastImpact: renderer.giftFX.lastImpact },
    labels,
    language
  });
}

export function restore(snapshot, sim, renderer) {
  if (!snapshot) return false;
  if (snapshot.format !== 1 || !snapshot.simulation || !snapshot.ids || !snapshot.world || !snapshot.scenes) throw Error('INVALID_SKYSHIFT_CHECKPOINT');
  const saved = structuredClone(snapshot);
  // Saved review sessions predate the corrected push/ride values. Upgrade only
  // their old defaults; keep user preferences, accepted jobs and replay IDs.
  if((saved.giftValuesVersion??1)<GIFT_VALUES_VERSION){
    for(const key of ['settings','pendingSettings']){
      const value=saved.simulation[key];if(!value)continue;
      if(value.meteorMeters===300)value.meteorMeters=DEFAULTS.meteorMeters;
      if(value.vortexMeters===150)value.vortexMeters=DEFAULTS.vortexMeters;
    }
    saved.giftValuesVersion=GIFT_VALUES_VERSION;
  }
  for (const key of SIMULATION) sim[key] = saved.simulation[key];
  sim.seen = new CommandIds(); sim.seen.ranges = saved.ids.ranges; sim.seen.local = new Set(saved.ids.local);
  sim.world = new World(sim.settings.worldSeed, sim.settings.finishDistance);
  sim.world.cache = new Map(saved.world.cache); sim.world.unavailable = new Map(saved.world.unavailable);
  sim.releaseInput();
  for (const key of SCENES) renderer[key] = saved.scenes[key];
  renderer.giftFX.bursts = saved.effects.bursts; renderer.giftFX.lastImpact = saved.effects.lastImpact;
  return saved;
}

export async function openRecovery(scope, factory = globalThis.indexedDB) {
  if (!factory) throw Error('RECOVERY_STORAGE_UNAVAILABLE');
  const db = await new Promise((resolve, reject) => {
    const request = factory.open('lah-skyshift-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('checkpoints');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('RECOVERY_STORAGE_BLOCKED'));
  });
  db.onversionchange = () => db.close();
  const transaction = (mode, value) => new Promise((resolve, reject) => {
    const tx = db.transaction('checkpoints', mode, { durability: 'strict' }), store = tx.objectStore('checkpoints');
    const request = mode === 'readonly' ? store.get(scope) : store.put(value, scope);
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error || Error('RECOVERY_WRITE_FAILED'));
  });
  return { read: () => transaction('readonly'), write: value => transaction('readwrite', value), close: () => db.close() };
}

// Coalesce a burst into one transaction. ACKs are emitted only after commit.
// A failed write leaves every receipt pending for the next retry.
export class Checkpoints {
  constructor(store, snapshot, acknowledge = () => {}, failed = () => {}) {
    this.store = store; this.snapshot = snapshot; this.acknowledge = acknowledge; this.failed = failed;
    this.pending = new Map(); this.dirty = false; this.saving = null; this.timer = null;
  }
  mark(id, status) {
    if (id !== undefined && id !== null) this.pending.set(String(id), { id: String(id), status });
    this.dirty = true; this.schedule();
  }
  schedule(delay = 30) {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush().catch(() => {}); }, delay);
  }
  flush() {
    if (this.saving) return this.saving;
    if (!this.dirty) return Promise.resolve();
    let state;
    try { state = this.snapshot(); } catch (error) { this.failed(error); return Promise.reject(error); }
    const receipts = [...this.pending.values()]; this.dirty = false;
    this.saving = (async () => {
      try {
        await this.store.write(state);
        for (const receipt of receipts) {
          if (this.pending.get(receipt.id) === receipt) this.pending.delete(receipt.id);
          this.acknowledge(receipt.id, receipt.status);
        }
      } catch (error) { this.dirty = true; this.failed(error); throw error; }
      finally { this.saving = null; if (this.dirty) this.schedule(250); }
    })();
    return this.saving;
  }
  async settle() { do { await this.flush(); } while (this.dirty || this.saving); }
}
