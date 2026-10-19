import { STEP, WIDTH, GRAVITY, JUMP_SPEED, MOVE_SPEED, MIN_DISTANCE, DEFAULTS, ACTIONS, settings, actor, clamp, lerp, smooth } from './config.js';
import { World } from './world.js';
import { CommandIds } from './commands.js';
import {GIFT_TIMING,isVexNegative,giftTravelProgress,VEX_BOARD_RELEASE,VEX_TOUCHDOWN} from './gift-motion.js';

export class Simulation {
  constructor(initial = {}, emit = () => {}) {
    this.settings = settings(initial);
    this.presentationErrors = 0;
    // Presentation callbacks cannot consume commands without their mechanics.
    this.emit = event => { try { emit(event); } catch (error) { this.presentationErrors++; this.lastPresentationError = String(error); } };
    this.clock = 0; this.round = 1; this.wins = 0;
    this.paused = false; this.ended = false; this.phase = 'playing';
    this.cinematicUntil = 0;
    this.input = { left: false, right: false }; this.seen = new CommandIds();
    this.queue = []; this.active = null; this.pendingSettings = null;
    this.hold = 0; this.celebration = 0;
    this.history = []; this.localId = 0; this.requestedMetersExact = 0n;
    this.ledger = { accepted: 0, completedCommands: 0, cancelledCommands: 0, rejected: 0, duplicates: 0, requestedMeters: 0, appliedMeters: 0, cancelledMeters: 0, requestedWins: 0, appliedWins: 0, clampedWins: 0 };
    this.startWorld();
  }
  startWorld() {
    this.world = new World(this.settings.worldSeed, this.settings.finishDistance);
    this.autoTarget = null;
    this.player = { x: WIDTH / 2, y: 0, vy: JUMP_SPEED, vx: 0, facing: 1, squash: 1 };
    this.previous = { ...this.player }; this.distance = 0;
    this.world.stream(0, this.clock);
  }
  releaseInput() { this.input.left = this.input.right = false; }
  setSettings(value, initial = false) {
    const next = settings(value, this.pendingSettings || this.settings);
    if (initial && this.clock === 0 && !this.active && !this.queue.length) {
      this.settings = next; this.startWorld(); return;
    }
    const boundary = ['finishDistance', 'winCountdown', 'worldSeed'];
    this.pendingSettings = boundary.some(key => next[key] !== this.settings[key]) ? next : null;
    this.settings = settings({ ...next, ...Object.fromEntries(boundary.map(key => [key, this.settings[key]])) });
    this.emit({ kind: 'settings', pending: Boolean(this.pendingSettings), clock: this.clock });
  }
  reject(reason) { this.ledger.rejected++; this.emit({ kind: 'rejected', reason, clock: this.clock }); return false; }
  action(payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return this.reject('INVALID_PAYLOAD');
    const kind = String(payload.action || '').replace(/^game:/, '');
    if (!Object.hasOwn(ACTIONS, kind)) return this.reject('UNKNOWN_ACTION');
    if (this.ended) return this.reject('SESSION_ENDED');
    const amount = payload.amount === undefined ? 1 : payload.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) return this.reject('INVALID_AMOUNT');
    const id = payload.commandId === undefined ? 'local-' + (++this.localId) : String(payload.commandId);
    if (!id || id.length > 128) return this.reject('INVALID_COMMAND_ID');
    if (this.seen.has(id)) { this.ledger.duplicates++; return false; }
    const spec = ACTIONS[kind], delta = spec.setting ? Math.round(this.settings[spec.setting] * amount) * spec.sign : 0;
    if (spec.setting && !delta) return this.reject('ZERO_MOVEMENT');
    const who = actor(payload.actor);
    const job = { kind, delta, amount, commands: 1, actor: who, commandId: id, gift: payload.gift ? { name: String(payload.gift.name || '').slice(0, 80), repeatCount: clamp(Number(payload.gift.repeatCount) || amount, 1, 1000000) } : null, simulated: Boolean(payload.simulated || payload.source?.simulated) };
    const last = this.queue.at(-1);
    const merge = delta && last?.kind === kind && last.actor.username === who.username && last.simulated === job.simulated && Number.isSafeInteger(last.delta + delta) && Number.isSafeInteger(last.amount + amount);
    this.seen.add(id);
    this.ledger.accepted++; this.requestedMetersExact += BigInt(delta);
    this.ledger.requestedMeters = Number(this.requestedMetersExact);
    this.emit({ ...job, kind: 'received', action: kind, clock: this.clock });
    if (!spec.setting && this.paused) { this.queue.push(job); return true; }
    if (this.utility(job)) return true;
    if (merge) {
      const count = last.gift?.repeatCount || last.amount;
      last.delta += delta; last.amount += amount; last.commands += job.commands;
      if (last.gift || job.gift) last.gift = { ...(job.gift || last.gift), repeatCount: count + (job.gift?.repeatCount || amount) };
    }
    else this.queue.push(job);
    if (delta < 0 && this.phase === 'holding') this.hold = 0;
    if (!this.paused) this.pump();
    return true;
  }
  utility(job) {
    const { kind, amount } = job;
    if (kind === 'winAdd' || kind === 'winRemove') {
      const before = this.wins;
      const requestedWins = (kind === 'winAdd' ? 1 : -1) * Math.max(1, Math.round(amount));
      this.wins = clamp(this.wins + requestedWins, -100000000, 100000000);
      this.ledger.requestedWins += requestedWins; this.ledger.appliedWins += this.wins - before; this.ledger.clampedWins += requestedWins - (this.wins - before);
      this.ledger.completedCommands += job.commands;
      this.emit({ ...job, changed: this.wins - before, winsBefore: before, winsAfter: this.wins, requestedWins, clock: this.clock }); return true;
    }
    if (kind === 'reset') {
      this.ledger.completedCommands += job.commands;
      this.restart({ preserve: true, effect: job });
      return true;
    }
    return false;
  }
  pump() {
    if (this.cinematicUntil > this.clock + 1e-9) return;
    while (!this.active && !this.paused && !this.ended && this.phase !== 'celebrating' && this.queue.length) {
    let at = 0;
    if (this.phase === 'holding') {
      at = this.queue.findIndex(job => job.delta < 0 || !ACTIONS[job.kind].setting);
      if (at < 0) return; // Upward overflow remains reserved for the next round.
    }
    let job = this.queue.splice(at, 1)[0];
    if (this.utility(job)) continue;
    const jobs = [job];
    // Consecutive equal effects can share a scene; each contributor retains
    // their own result and command count. Other effect kinds keep FIFO order.
    while (jobs.length < 3 && this.queue[at]?.kind === job.kind && this.queue[at]?.simulated === job.simulated && Number.isSafeInteger(jobs.reduce((sum, item) => sum + item.delta, 0) + this.queue[at].delta)) jobs.push(this.queue.splice(at, 1)[0]);
    job = { ...job, jobs, delta: jobs.reduce((sum, item) => sum + item.delta, 0), amount: jobs.reduce((sum, item) => sum + item.amount, 0), commands: jobs.reduce((sum, item) => sum + item.commands, 0) };
    const from = this.distance;
    const to = clamp(from + job.delta, MIN_DISTANCE, this.settings.finishDistance);
    const applied = to - from;
    if (Math.abs(applied) < 1e-7 && job.delta > 0) {
      this.queue.unshift(...jobs); this.land(this.world.platform(this.settings.finishDistance)); return;
    }
    const p = this.world.platform(Math.floor(to + 1e-7));
    const timing=GIFT_TIMING[job.kind],travelAt=timing.contact;
    const impactAt=['anvil','wind'].includes(job.kind)?travelAt:0;
    const duration=Math.max(travelAt+timing.exit+.8,timing.duration*(this.queue.length>8?.85:1));
    const travelEnd=duration-timing.exit;
    this.active = { ...job, sceneId: job.commandId + '@' + this.clock, from, to, applied, remainder: job.delta - applied, startX: this.player.x, startY: this.player.y, endX: this.world.x(p, this.clock + duration), endY: this.world.heightAt(to), elapsed: 0, duration, impactAt, travelAt, travelEnd, impacted: false, launched: false, released: false, contactCued:false, windupCued:false,departureCued:false };
    this.autoTarget = null;
    this.phase = 'playing'; this.hold = 0; this.player.vy = this.player.vx = 0;
    for (const [index, source] of jobs.entries()) this.emit({ ...source, kind: 'effectStart', action: source.kind, sceneId: this.active.sceneId, sceneStart: index === 0, sceneAmount: job.amount, clock: this.clock });
    }
  }
  remember(result) { this.history.push(result); if (this.history.length > 64) this.history.shift(); }
  finishTravel() {
    const job = this.active;
    this.active = null; this.distance = job.to;
    this.player.y = this.world.heightAt(job.to); this.player.vx = this.player.vy = 0;
    const p = this.world.platform(Math.floor(job.to + 1e-7));
    this.player.x = this.world.x(p, this.clock);
    this.ledger.appliedMeters += job.applied;
    let available = Math.abs(job.applied); const overflow = [];
    for (const [index, source] of job.jobs.entries()) {
      const applied = Math.min(Math.abs(source.delta), available) * Math.sign(source.delta); available -= Math.abs(applied);
      const remainder = source.delta - applied;
      this.remember({ kind: source.kind, actor: source.actor, commandId: source.commandId, commands: source.commands, applied });
      if (remainder > 1e-7) overflow.push({ ...source, delta: remainder });
      else { this.ledger.completedCommands += source.commands; if (remainder < -1e-7) { this.ledger.cancelledMeters += remainder; this.emit({ ...source, kind: 'clamped', cancelled: remainder, clock: this.clock }); } }
      this.emit({ ...source, kind: 'effectEnd', action: source.kind, applied, sceneEnd: index === 0, clock: this.clock });
    }
    this.queue.unshift(...overflow);
    if (Math.abs(job.to - this.settings.finishDistance) < 1e-6) this.land(this.world.platform(this.settings.finishDistance));
    else if (Math.abs(job.to - Math.round(job.to)) < 1e-6) this.land(p,{sound:!job.landingCued});
    else this.player.vy = JUMP_SPEED;
    this.world.stream(this.player.y, this.clock);
    this.pump();
  }
  land(p,{sound=true}={}) {
    this.autoTarget = null;
    this.player.y = p.y; this.distance = p.level; this.player.squash = 1;
    this.world.touch(p, this.clock);
    this.emit({ kind: 'landing', x: this.player.x, y: p.y, platform: p.type, sound, clock: this.clock });
    if (p.level === this.settings.finishDistance) {
      this.phase = 'holding'; this.hold = 0; this.player.vy = 0;
      this.emit({ kind: 'finishReached', clock: this.clock });
    } else this.player.vy = JUMP_SPEED * (p.type === 'spring' ? 1.24 : 1);
  }
  restart({ preserve = true, fromWin = false, effect = null } = {}) {
    if (this.active) {
      if (preserve) this.queue.unshift(...this.active.jobs);
      else { this.ledger.cancelledMeters += this.active.delta; this.ledger.cancelledCommands += this.active.commands; }
      this.active = null;
    }
    if (!preserve) {
      this.cinematicUntil = 0;
      this.ledger.cancelledMeters += this.queue.reduce((sum, job) => sum + job.delta, 0);
      this.ledger.cancelledCommands += this.queue.reduce((sum, job) => sum + job.commands, 0);
      this.queue.length = 0;
    }
    if (this.pendingSettings) { this.settings = settings({ ...this.settings, ...Object.fromEntries(['finishDistance', 'winCountdown', 'worldSeed'].map(key => [key, this.pendingSettings[key]])) }); this.pendingSettings = null; }
    this.round++; this.phase = 'playing'; this.hold = 0; this.celebration = 0; this.ended = false;
    this.releaseInput(); this.startWorld();
    this.emit({ ...(effect || {}), kind: fromWin ? 'roundStart' : 'reset', clock: this.clock });
  }
  control(payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const type = String(payload.action || '');
    if (!['session.pause', 'session.resume', 'session.restart', 'session.end', 'session.panic'].includes(type)) return false;
    if (payload.commandId !== undefined) {
      const id = String(payload.commandId);
      if (this.seen.has(id)) return false;
      this.seen.add(id);
    }
    this.releaseInput();
    if (type === 'session.pause') this.paused = true;
    if (type === 'session.resume' && !this.ended) this.paused = false;
    if (type === 'session.restart') {
      this.restart({ preserve: true });
      if (Number.isSafeInteger(payload.round) && payload.round > 0) this.round = payload.round;
    }
    if (type === 'session.panic' || type === 'session.end') {
      this.restart({ preserve: false }); this.paused = true; this.ended = type === 'session.end';
    }
    this.emit({ kind: 'control', action: type, clock: this.clock }); return true;
  }
  automaticDirection() {
    const { x, y, vy } = this.player;
    const apex = y + Math.max(0, vy) ** 2 / (2 * GRAVITY);
    let target = this.autoTarget === null ? null : this.world.platform(this.autoTarget);
    const arrival = p => Math.max(0, (vy + Math.sqrt(Math.max(0, vy * vy + 2 * GRAVITY * (y - p.y)))) / GRAVITY);
    if (!target || target.y > apex - 4 || vy < 0 && target.y > y + 3 || !this.world.available(target, this.clock + arrival(target))) {
      const top = Math.min(this.settings.finishDistance, this.world.levelAt(apex - (vy > 0 ? 12 : 0)));
      for (let n = top; n >= top - 8; n--) {
        const candidate = this.world.platform(n);
        if (this.world.available(candidate, this.clock + arrival(candidate))) { target = candidate; break; }
      }
      this.autoTarget = target?.level ?? null;
    }
    if (!target) return 0;
    const destination = this.world.x(target, this.clock + arrival(target));
    const dx = ((destination - x + WIDTH / 2) % WIDTH + WIDTH) % WIDTH - WIDTH / 2;
    return Math.abs(dx) > 5 ? Math.sign(dx) : 0;
  }
  step(dt = STEP) {
    if (this.paused || this.ended) return;
    if (!Number.isFinite(dt) || dt <= 0 || dt > STEP + 1e-9) throw new Error('FIXED_STEP_REQUIRED');
    this.clock += dt; this.previous = { ...this.player };
    // Paid trophy choreography holds the body, not the incoming command stream.
    // Pause freezes this same clock; queued movement resumes after the show.
    if (this.clock < this.cinematicUntil - 1e-9) return;
    this.player.squash = Math.max(0, this.player.squash - dt * 6);
    if (this.phase === 'celebrating') {
      this.celebration -= dt;
      if (this.celebration <= 0) this.restart({ preserve: true, fromWin: true });
      return;
    }
    this.pump();
    if (this.active) {
      const a = this.active; a.elapsed = Math.min(a.duration, a.elapsed + dt);
      if(isVexNegative(a.kind)&&!a.windupCued&&a.elapsed>=a.travelAt*.62){
        a.windupCued=true;this.emit({kind:'giftWindup',action:a.kind,clock:this.clock});
      }
      if(!a.contactCued&&a.elapsed>=a.travelAt){
        a.contactCued=true;this.emit({kind:'giftContact',action:a.kind,clock:this.clock});
      }
      if(isVexNegative(a.kind)&&!a.departureCued&&a.elapsed>=(a.travelEnd??a.duration-.5)){
        a.departureCued=true;this.emit({kind:'giftDeparture',action:a.kind,clock:this.clock});
      }
      const travel=clamp((a.elapsed-a.travelAt)/((a.travelEnd??a.duration)-a.travelAt),0,1);
      if(a.kind==='vortex'&&!a.throwCued&&travel>=VEX_BOARD_RELEASE){
        a.throwCued=true;this.emit({kind:'giftThrow',action:a.kind,clock:this.clock});
      }
      if(['vortex','meteor'].includes(a.kind)&&!a.landingCued&&travel>=VEX_TOUCHDOWN){
        a.landingCued=true;this.emit({kind:'giftLanding',action:a.kind,clock:this.clock});
      }
      if (a.impactAt && !a.impacted && a.elapsed >= a.impactAt) {
        a.impacted = true; this.player.squash = a.kind==='meteor'?.15:1.6;
        this.emit({ kind: 'impact', action: a.kind, amount: a.amount, x: this.player.x, y: this.player.y, clock: this.clock });
      }
      if (a.kind === 'balloon' && !a.released && a.elapsed >= a.duration - .16) {
        a.released = true; this.emit({ kind: 'balloonPop', x: this.player.x, y: this.player.y, clock: this.clock });
      }
      const t = giftTravelProgress(a.kind,travel);
      this.distance = lerp(a.from, a.to, t);
      this.player.x = lerp(a.startX, a.endX, t);
      this.player.y = lerp(a.startY, a.endY, t);
      this.world.stream(this.player.y, this.clock);
      if (a.elapsed >= a.duration - 1e-9) this.finishTravel();
      return;
    }
    if (this.phase === 'holding') {
      this.hold += dt;
      if (this.hold >= this.settings.winCountdown - 1e-9) {
        const before = this.wins;
        this.wins = Math.min(100000000, this.wins + 1); this.phase = 'celebrating'; this.celebration = 1.25;
        this.emit({ kind: 'win', changed: this.wins - before, winsBefore: before, winsAfter: this.wins, clock: this.clock });
      }
      return;
    }
    const direction = Number(this.input.right) - Number(this.input.left) || (this.settings.autoplay && !this.input.right && !this.input.left ? this.automaticDirection() : 0);
    this.player.vx = direction * MOVE_SPEED;
    if (direction) this.player.facing = direction;
    this.player.x = ((this.player.x + this.player.vx * dt) % WIDTH + WIDTH) % WIDTH;
    this.player.vy -= GRAVITY * dt;
    this.player.y = Math.max(this.world.height(MIN_DISTANCE), this.player.y + this.player.vy * dt);
    this.world.stream(this.player.y, this.clock);
    if (this.player.vy <= 0) {
      let hit = null;
      for (const p of this.world.cache.values()) {
        const x = this.world.x(p, this.clock);
        if (p.y <= this.previous.y + 1e-7 && p.y >= this.player.y - 1e-7 && this.world.available(p, this.clock) && Math.abs(this.player.x - x) <= p.w / 2 + 16 && (!hit || p.y > hit.y)) hit = p;
      }
      if (hit) this.land(hit);
    }
    if (this.phase === 'playing') this.distance = clamp(this.world.distanceAt(this.player.y), MIN_DISTANCE, this.settings.finishDistance);
    if (this.distance === MIN_DISTANCE && this.player.vy < 0) this.player.vy = JUMP_SPEED;
  }
  stats() {
    const reservedMeters = this.queue.reduce((sum, job) => sum + job.delta, 0) + (this.active?.delta || 0);
    return { distance: this.distance, meter: Math.floor(this.distance + 1e-7), wins: this.wins, round: this.round, phase: this.phase, paused: this.paused, ended: this.ended,
      countdown: this.phase === 'holding' ? Math.max(0, this.settings.winCountdown - this.hold) : null,
      active: this.active ? { kind: this.active.kind, actor: this.active.actor, contributors: this.active.jobs.map(j => ({ actor: j.actor, amount: j.amount, delta: j.delta })), amount: this.active.amount, to: this.active.to, progress: this.active.elapsed / this.active.duration } : null,
      queued: this.queue.length, platforms: this.world.cache.size, pendingSettings: Boolean(this.pendingSettings),
      queuedUnits: this.queue.reduce((sum, job) => sum + job.amount, 0),
      ledger: { ...this.ledger, requestedMetersExact: String(this.requestedMetersExact), reservedMeters, presentationErrors: this.presentationErrors } };
  }
}
