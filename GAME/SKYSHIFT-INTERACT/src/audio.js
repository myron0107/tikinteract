import { clamp } from './config.js';

const FILES = {
  jump: 'power-up.mp3', land: 'drop.mp3', magnet: 'coin.mp3', win: 'win.mp3', reset: 'switch.mp3',
  music: 'skyshift-theme.mp3',
  clang: 'anvil-clang.mp3', inflate: 'balloon-inflate.mp3', pop: 'balloon-pop.mp3', whoosh: 'fall-whoosh.mp3',
  explosion: 'meteor-impact.mp3', crunch: 'meteor-crunch.mp3', theft: 'trophy-theft.mp3', cloud: 'cloud-lift.mp3',
  engine: 'rocket-engine.mp3', tornado: 'tornado-loop.mp3', vortex: 'vortex-loop.mp3',
  arrival: 'alien-arrival.mp3', hatch: 'alien-hatch.mp3', punch: 'alien-punch.mp3', laugh: 'alien-laugh.mp3',
  departure: 'alien-exit.mp3', ceremony: 'trophy-descent.mp3', catch: 'trophy-catch.mp3', fanfare: 'champion-fanfare.mp3'
};

// Sample playback, one shared continuous effect bed, bounded one-shot voices.
// The platform mixer route gates both music and game FX; no parallel SDK sound
// request is made for the same event, so monitor/overlay do not double it.
export class GameAudio {
  constructor() {
    this.context = null; this.buffers = new Map(); this.voices = new Set();
    this.routeState = { enabled: true, volume: 1 }; this.muted = false;
    this.music = null; this.bed = null; this.bedKind = ''; this.musicOffset = 0;
    this.last = new Map(); this.failed = []; this.loading = null; this.disposed = false;
  }
  async prepare() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        const ac = this.context;
        this.master = ac.createGain(); this.fx = ac.createGain(); this.musicGain = ac.createGain(); this.bedGain = ac.createGain();
        const limiter = ac.createDynamicsCompressor();
        limiter.threshold.value = -14; limiter.knee.value = 15; limiter.ratio.value = 4; limiter.attack.value = 0.01; limiter.release.value = 0.2;
        this.master.gain.value = 0; this.fx.connect(this.master); this.bedGain.connect(this.fx); this.musicGain.connect(this.master); this.master.connect(limiter); limiter.connect(ac.destination);
        this.loading = Promise.all(Object.entries(FILES).map(async ([id, filename]) => {
          try {
            const response = await fetch(window.__SKYSHIFT_ASSETS.audio[filename]);
            if (!response.ok) throw new Error(filename);
            this.buffers.set(id, await ac.decodeAudioData(await response.arrayBuffer()));
          } catch { this.failed.push(id); }
        }));
      }
      await this.loading;
    } catch { /* Gesture/OBS policy may defer unlock; a later gesture retries. */ }
  }
  async unlock() {
    await this.prepare();
    try { await this.context?.resume(); } catch {}
  }
  route(state = {}) {
    this.routeState = { enabled: state.enabled === true, volume: clamp(Number(state.volume) || 0, 0, 1) };
    if (this.routeState.enabled) this.unlock();
  }
  source(id, loop, destination, gain = 1) {
    const buffer = this.buffers.get(id), ac = this.context;
    if (!buffer || !ac || ac.state !== 'running') return null;
    const source = ac.createBufferSource(), node = ac.createGain();
    source.buffer = buffer; source.loop = loop; node.gain.value = gain;
    source.connect(node); node.connect(destination);
    source.lahGain = node;
    return source;
  }
  play(id, volume = 0.3, minInterval = 0.12, playbackRate = 1) {
    const ac = this.context;
    if (!ac || this.muted || !this.routeState.enabled || !this.routeState.volume || this.disabled) return;
    if (ac.currentTime - (this.last.get(id) ?? -100) < minInterval) return;
    const source = this.source(id, false, this.fx, volume);
    if (!source) return;
    source.playbackRate.value = clamp(playbackRate, .75, 1.5);
    if (this.voices.size >= 8) this.stopVoice(this.voices.values().next().value);
    this.last.set(id, ac.currentTime); this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); source.lahGain.disconnect(); };
    source.start();
  }
  stopVoice(source) { if (!source) return; try { source.stop(); } catch {} this.voices.delete(source); }
  stopLoop(key) {
    const source = this[key]; if (!source) return;
    try { source.stop(); source.disconnect(); source.lahGain.disconnect(); } catch {}
    this[key] = null;
  }
  effect(event) {
    if (event.kind === 'effectStart') {
      if (event.sceneStart === false) return;
      const cue = { balloon: ['inflate', .58], anvil: ['whoosh', .4], meteor: ['theft', .22], magnet: ['magnet', .36], cloud: ['cloud', .38], rocket: ['whoosh', .34], wind: ['whoosh', .26], vortex: ['theft', .32] }[event.action];
      if (cue) this.play(...cue, 0);
    } else if (event.kind === 'meteorFall') this.play('whoosh', .68, 0);
    else if (event.kind === 'impact') {
      this.play(event.action === 'anvil' ? 'clang' : 'explosion', event.action === 'anvil' ? .72 : .68, 0);
      if (event.action === 'meteor') this.play('crunch', .4, 0);
    }
    else if (event.kind === 'balloonPop') this.play('pop', .52, 0);
    else if (event.kind === 'effectEnd' && event.sceneEnd !== false && ['cloud', 'magnet'].includes(event.action)) this.play('whoosh', .16, .2);
    else if (event.kind === 'landing') this.play(event.platform === 'spring' ? 'jump' : 'land', event.platform === 'spring' ? 0.15 : 0.065, 0.35);
    else if (event.kind === 'trophyGain') this.play('win', .45, 0);
    else if (event.kind === 'trophyTheft') { this.play('theft', .56, 0); this.play('whoosh', .26, 0); }
    else if (event.kind === 'alienArrival') this.play('arrival', .43, 0);
    else if (event.kind === 'alienHatch') this.play('hatch', .33, 0);
    else if (event.kind === 'alienPunch') { this.play('punch', .66, 0); this.play('land', .17, 0); }
    else if (event.kind === 'alienTaunt') this.play('laugh', .41, 0, clamp(5.2 / (event.duration || 5.2), 1, 1.35));
    else if (event.kind === 'alienExit') this.play('departure', .49, 0);
    else if (event.kind === 'trophyDescent') this.play('ceremony', .35, 0);
    else if (event.kind === 'trophyCatch') this.play('catch', .50, 0);
    else if (event.kind === 'championLift') this.play('fanfare', .49, 0, clamp(4.4 / (event.duration || 4.4), 1, 1.35));
    else if (event.kind === 'trophyFlight') this.play('whoosh', .27, 0);
    else if (event.kind === 'portalReset' || event.kind === 'reset' && !event.actor) this.play('reset', .28, 0);
    else if (event.kind === 'finishReached') this.play('magnet', 0.25, 0.5);
  }
  update(sim) {
    const ac = this.context; if (!ac || this.disposed) return;
    this.disabled = !sim.settings.soundEnabled || sim.paused || sim.ended;
    const on = !this.disabled && !this.muted && this.routeState.enabled && this.routeState.volume > 0;
    this.master.gain.setTargetAtTime(on ? this.routeState.volume * 0.65 : 0, ac.currentTime, 0.035);
    this.fx.gain.setTargetAtTime(sim.settings.soundVolume, ac.currentTime, 0.04);
    this.musicGain.gain.setTargetAtTime(sim.settings.musicVolume * (sim.cinematicUntil > sim.clock ? .13 : .35), ac.currentTime, 0.1);
    if (on && sim.settings.musicEnabled && !this.music) {
      const source = this.source('music', true, this.musicGain);
      if (source) { this.music = source; this.musicStarted = ac.currentTime; source.start(0, this.musicOffset % source.buffer.duration); }
    } else if ((!on || !sim.settings.musicEnabled) && this.music) {
      this.musicOffset += ac.currentTime - this.musicStarted; this.stopLoop('music');
    }
    const kind = on ? sim.active?.kind || '' : '';
    const next = { magnet: 'cloud', wind: 'tornado', rocket: 'engine', vortex: 'vortex' }[kind] || '';
    if (this.bedKind !== next) { this.stopLoop('bed'); this.bedKind = next; }
    if (next && !this.bed) {
      const source = this.source(next, true, this.bedGain);
      if (source) { this.bed = source; source.start(); }
    }
    this.bedGain.gain.setTargetAtTime(next === 'engine' ? .17 : next === 'tornado' ? .14 : .09, ac.currentTime, 0.08);
    if (!on) for (const source of [...this.voices]) this.stopVoice(source);
  }
  dispose() {
    this.disposed = true; this.stopLoop('music'); this.stopLoop('bed');
    for (const source of [...this.voices]) this.stopVoice(source);
    this.context?.close().catch(() => {});
  }
}
