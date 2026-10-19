import { clamp } from './config.js';
import {isVexNegative,giftFrame,VEX_BOARD_RELEASE,VEX_TOUCHDOWN} from './gift-motion.js';

const FILES = {
  jump: 'runner-hop.mp3', land: 'sneaker-step.mp3', music: 'neon-arcade-run.mp3',
  energy: 'spring-compress.mp3', energyRelease: 'spring-boing.mp3',
  glitch: 'banana-skid.mp3', glitchImpact: 'slip-tumble.mp3',
  drone: 'hook-cast.mp3', board: 'jetpack-buckle.mp3', laser: 'portal-unfold.mp3',
  bananaThrow:'vex-banana-toss.mp3',gloveSpring:'vex-glove-spring.mp3',boardCatch:'vex-board-catch.mp3',
  pushReach:'vex-push-reach.mp3',pushContact:'vex-push-contact.mp3',rideBed:'vex-board-rush.mp3',fallBed:'vex-freefall.mp3',
  release: 'gear-detach.mp3', reset: 'checkpoint-return.mp3', win: 'crown-shine.mp3',
  theft: 'crown-swipe.mp3', arrival: 'vex-skate-in.mp3', lock: 'vex-brake.mp3',
  strike: 'vex-bump.mp3', taunt: 'vex-whistle.mp3', departure: 'vex-skate-out.mp3',
  ceremony: 'crown-float.mp3', catch: 'crown-ding.mp3', fanfare: 'champion-sting.mp3',
  flight: 'crown-swish.mp3', finish: 'finish-bell.mp3', tick: 'countdown-tock.mp3',
  droneBed: 'cable-reel.mp3', boardBed: 'jetpack-air.mp3', laserBed: 'portal-breeze.mp3',
  boardThrow:'vex-board-throw.mp3',
  hookLatch:'hook-latch.mp3',jetIgnite:'jetpack-ignite.mp3',portalCross:'portal-cross.mp3',
  boardDescent:'vex-board-descent.mp3',gloveHit:'boxing-thump.mp3',
  hairGrab:'vex-hair-grab.mp3',hairTug:'vex-hair-tug.mp3',hairRelease:'vex-let-go.mp3'
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
    this.countdown = null;
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
            const response = await fetch(window.__NEON_ASCENT_ASSETS.audio[filename]);
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
      if(isVexNegative(event.action)){this.play('arrival',.32,0);return;}
      // Internal action IDs are stable; every new gift has its own sound identity.
      const cue = { balloon: ['energy', .48], magnet: ['drone', .42], cloud: ['board', .42], rocket: ['laser', .44] }[event.action];
      if (cue) this.play(...cue, 0);
    } else if(event.kind==='giftWindup'){
      const cue={anvil:'bananaThrow',wind:'gloveSpring',vortex:'boardCatch',meteor:'pushReach'}[event.action];
      if(cue)this.play(cue,.34,0);
    }
    else if(event.kind==='giftDeparture')this.play('departure',.3,0);
    else if(event.kind==='giftThrow')this.play('boardThrow',.38,0);
    else if(event.kind==='giftLanding')this.play('land',.28,0);
    else if (event.kind === 'giftContact') {
      const cue={balloon:'energyRelease',anvil:'glitchImpact',magnet:'hookLatch',cloud:'jetIgnite',rocket:'portalCross',wind:'gloveHit',vortex:'boardDescent',meteor:'pushContact'}[event.action];
      if(cue)this.play(cue,.38,0);
      if(event.action==='anvil')this.play('glitch',.24,0);
    }
    else if (event.kind === 'effectEnd' && event.sceneEnd !== false && ['cloud', 'magnet', 'rocket'].includes(event.action)) this.play('release', .22, .2);
    else if (event.kind === 'landing'&&event.sound!==false) this.play(event.platform === 'spring' ? 'jump' : 'land', event.platform === 'spring' ? 0.15 : 0.065, 0.35);
    else if (event.kind === 'trophyGain') this.play('win', .45, 0);
    else if (event.kind === 'trophyTheft') this.play('theft', .22, 0);
    else if (event.kind === 'vexGrab') this.play('hairGrab', .32, 0);
    else if (event.kind === 'vexHairPull') this.play('hairTug', .36, 0);
    else if (event.kind === 'vexRelease') this.play('hairRelease', .25, 0);
    else if (event.kind === 'alienArrival') this.play('arrival', .43, 0);
    else if (event.kind === 'alienHatch') this.play('lock', .33, 0);
    else if (event.kind === 'alienPunch') this.play('strike', .53, 0);
    else if (event.kind === 'alienTaunt') this.play('taunt', .37, 0, clamp(5.2 / (event.duration || 5.2), 1, 1.35));
    else if (event.kind === 'alienExit') this.play('departure', .49, 0);
    else if (event.kind === 'trophyDescent') this.play('ceremony', .35, 0);
    else if (event.kind === 'trophyCatch') this.play('catch', .50, 0);
    else if (event.kind === 'championLift') this.play('fanfare', .49, 0, clamp(4.4 / (event.duration || 4.4), 1, 1.35));
    else if (event.kind === 'trophyFlight') this.play('flight', .27, 0);
    else if (event.kind === 'portalReset' || event.kind === 'reset' && !event.actor) this.play('reset', .28, 0);
    else if (event.kind === 'finishReached') this.play('finish', .36, .5);
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
    const attached=!sim.active||sim.active.travelAt===undefined||sim.active.elapsed>=sim.active.travelAt;
    const kind = on&&attached ? sim.active?.kind || '' : '';
    let next = { magnet: 'droneBed', cloud: 'boardBed', rocket: 'laserBed', vortex: 'rideBed',meteor:'fallBed' }[kind] || '';
    if(['vortex','meteor'].includes(kind)&&Number.isFinite(sim.active.elapsed)){
      const p=giftFrame(sim.active).progress;
      if(kind==='vortex'&&p>=VEX_BOARD_RELEASE)next='fallBed';
      if(p>=VEX_TOUCHDOWN)next='';
    }
    if (this.bedKind !== next) { this.stopLoop('bed'); this.bedKind = next; }
    if (next && !this.bed) {
      const source = this.source(next, true, this.bedGain);
      if (source) { this.bed = source; source.start(); }
    }
    this.bedGain.gain.setTargetAtTime(next === 'laserBed' ? .12 : .09, ac.currentTime, .08);
    const countdown = sim.phase === 'holding' ? Math.ceil(Math.max(0, sim.settings.winCountdown - sim.hold)) : null;
    if (on && countdown > 0 && countdown !== this.countdown) this.play('tick', .24, .15, countdown <= 3 ? 1.2 : 1);
    this.countdown = countdown;
    if (!on) for (const source of [...this.voices]) this.stopVoice(source);
  }
  dispose() {
    this.disposed = true; this.stopLoop('music'); this.stopLoop('bed');
    for (const source of [...this.voices]) this.stopVoice(source);
    this.context?.close().catch(() => {});
  }
}
