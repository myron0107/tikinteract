import { WIDTH, ACTIONS, CHARACTER_COLORS, BACKGROUNDS, clamp, lerp } from './config.js';
import { GiftFX } from './fx.js';
import { meteorApproach, meteorImpact } from './meteor.js';
import { text } from './copy.js';
import { WinShow, SHOWS, showFrame, cueShow } from './wins.js';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => resolve(img); img.onerror = () => reject(new Error('ASSET_LOAD_FAILED: ' + url)); img.src = url;
  });
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('CANVAS_UNAVAILABLE');
    this.camera = null; this.giftTracked = false; this.particles = []; this.moment = null;
    this.fxCanvas = document.getElementById('hud-fx'); this.fx = this.fxCanvas?.getContext('2d');
    this.hudTrophy = document.getElementById('trophy'); this.scoreBadge = document.querySelector('.wins-bubble');
    this.scoreJobs = []; this.scoreMoment = null; this.portalJobs = []; this.portalMoment = null;
    this.presentedWins = null; this.winShow = new WinShow(this);
    this.sceneLedger = { receivedCommands: 0, completedCommands: 0, cancelledCommands: 0 }; this.pendingVisualUnits = 0;
    this.language = 'ro';
    this.giftFX = new GiftFX(); this.colorCache = new Map(); this.characterColor = 'Cyan';
    this.loaded = this.load(); this.resize();
  }
  async load() {
    const art = window.__SKYSHIFT_ASSETS;
    const [atlas, anvil, meteor, blast, alien, ship, rigResponse, response, ...backgrounds] = await Promise.all([loadImage(art.atlas), loadImage(art.anvil), loadImage(art.meteor), loadImage(art.blast), loadImage(art.alien), loadImage(art.ship), fetch(art.rig), fetch(art.metadata), ...Object.keys(BACKGROUNDS).map(name => loadImage(art.backgrounds[name]))]);
    if (!response.ok || !rigResponse.ok) throw new Error('ATLAS_METADATA_FAILED');
    const metadata = await response.json();
    const rig = await rigResponse.json(); this.alienParts = rig.parts; this.shipBounds = rig.ship;
    this.atlas = atlas; this.sprites = metadata.sprites;
    this.backgrounds = Object.fromEntries(Object.keys(BACKGROUNDS).map((name, index) => [name, backgrounds[index]]));
    this.props = { anvil, meteor, blast, alien, ship };
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width); this.cssHeight = Math.max(1, rect.height);
    this.ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssWidth * this.ratio); this.canvas.height = Math.round(this.cssHeight * this.ratio);
    if (this.fxCanvas) { this.fxCanvas.width = this.canvas.width; this.fxCanvas.height = this.canvas.height; }
    this.height = this.cssHeight / this.cssWidth * WIDTH; this.scale = this.canvas.width / WIDTH;
  }
  sprite(name, x, y, w, h, rotation = 0, alpha = 1, context = this.ctx) {
    const source = this.sprites?.[name]; if (!source) return;
    context.save(); context.translate(x, y); context.rotate(rotation); context.globalAlpha *= clamp(alpha, 0, 1);
    const colored = this.colorCache.get(this.characterColor)?.[name];
    if (colored) context.drawImage(colored, -w / 2, -h / 2, w, h);
    else context.drawImage(this.atlas, source.x, source.y, source.w, source.h, -w / 2, -h / 2, w, h);
    context.restore();
  }
  color(name) {
    this.characterColor = name;
    if (name === 'Cyan' || this.colorCache.has(name)) return;
    const variants = {};
    for (const pose of ['idle', 'rise', 'fall', 'land']) {
      const s = this.sprites[pose], canvas = document.createElement('canvas'); canvas.width = s.w; canvas.height = s.h;
      const ctx = canvas.getContext('2d'); ctx.filter = CHARACTER_COLORS[name].filter || 'hue-rotate(' + CHARACTER_COLORS[name].hue + 'deg)';
      ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h); variants[pose] = canvas;
    }
    this.colorCache.set(name, variants);
  }
  prop(name, x, y, width, alpha = 1, rotation = 0, ctx = this.ctx) {
    const image = this.props?.[name]; if (!image) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.globalAlpha *= clamp(alpha, 0, 1);
    ctx.drawImage(image, -width / 2, -width * image.height / image.width / 2, width, width * image.height / image.width); ctx.restore();
  }
  icon(canvas, name) {
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (name === 'alien') { this.winShow.part(ctx, 'head', canvas.width / 2, canvas.height / 2, canvas.width * .92); return; }
    if (name === 'anvil' || name === 'meteor') { this.prop(name, canvas.width / 2, canvas.height / 2, canvas.width * .94, 1, 0, ctx); return; }
    if (name === 'balloon') { this.smallEffect(ctx, name, canvas.width / 2, canvas.height / 2, canvas.width * .82); return; }
    if (name === 'finish') { this.flag(ctx, canvas.width * .2, canvas.height * .94, canvas.width * .62, canvas.height * .36, 0); return; }
    const source = this.sprites?.[name]; if (!source) return;
    const fit = Math.min(canvas.width / source.w, canvas.height / source.h) * 0.9;
    this.sprite(name, canvas.width / 2, canvas.height / 2, source.w * fit, source.h * fit, 0, 1, ctx);
  }
  smallEffect(ctx, kind, x, y, size, clock = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 80, size / 80);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#263958';
    if (kind === 'balloon') {
      const fill = ctx.createLinearGradient(-22, -35, 24, 20); fill.addColorStop(0, '#ffb9df'); fill.addColorStop(.4, '#ff54a0'); fill.addColorStop(1, '#bc2578');
      ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(0, -6, 25, 31, Math.sin(clock * 2) * .04, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff4c9e'; ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(-5, 30); ctx.lineTo(6, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff7fd'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(-9, -15, 7, 12, .35, 3.7, 5.8); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = '#f6eafc'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(9, 34, 2, 39); ctx.stroke();
    } else {
      const fill = ctx.createLinearGradient(0, -22, 0, 22); fill.addColorStop(0, '#dceaff'); fill.addColorStop(.42, '#7c99c8'); fill.addColorStop(1, '#354d76');
      ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-33, -18); ctx.lineTo(34, -18); ctx.lineTo(26, -3); ctx.lineTo(9, 2); ctx.lineTo(9, 12); ctx.lineTo(23, 18); ctx.lineTo(23, 25); ctx.lineTo(-23, 25); ctx.lineTo(-23, 18); ctx.lineTo(-9, 12); ctx.lineTo(-9, 2); ctx.lineTo(-27, -2); ctx.lineTo(-39, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#edf7ff'; ctx.beginPath(); ctx.roundRect(-30, -21, 64, 7, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffba99'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(0, -3); ctx.lineTo(6, -9); ctx.stroke();
    }
    ctx.restore();
  }
  flag(ctx, x, base, width = 54, height = 32, clock = 0) {
    const top = base - height * 2.3;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#172c46'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top - 6); ctx.stroke();
    ctx.strokeStyle = '#e9f4ff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#ffc65b'; ctx.beginPath(); ctx.arc(x, top - 7, 3.5, 0, Math.PI * 2); ctx.fill();
    const point = (u, v) => ({ x: x + u * width, y: top + v * height + Math.sin(clock * 3.4 - u * 7) * height * .11 * u - u * height * .08 });
    const quad = points => { ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); for (const p of points.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath(); };
    for (let col = 0; col < 6; col++) for (let row = 0; row < 4; row++) {
      quad([point(col / 6, row / 4), point((col + 1) / 6, row / 4), point((col + 1) / 6, (row + 1) / 4), point(col / 6, (row + 1) / 4)]);
      ctx.fillStyle = (row + col) % 2 ? '#182334' : '#fafdff'; ctx.fill();
    }
    const outline = [point(0, 0), ...Array.from({ length: 6 }, (_, i) => point((i + 1) / 6, 0)), ...Array.from({ length: 7 }, (_, i) => point((6 - i) / 6, 1))];
    quad(outline); ctx.strokeStyle = '#1c2943'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.clip();
    const shine = ctx.createLinearGradient(x, 0, x + width, 0); shine.addColorStop(0, '#fff0'); shine.addColorStop(.3, '#ffffff44'); shine.addColorStop(.6, '#091b3544'); shine.addColorStop(.82, '#ffffff33'); shine.addColorStop(1, '#0b132955');
    ctx.fillStyle = shine; ctx.fillRect(x, top - height / 2, width, height * 2); ctx.restore();
  }
  finishPlatform(ctx, x, y, width, clock) {
    const left = x - width / 2;
    ctx.save(); ctx.shadowColor = '#d5698b55'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#67263c'; ctx.beginPath(); ctx.roundRect(left, y - 2, width, 31, 9); ctx.fill(); ctx.shadowBlur = 0;
    const gold = ctx.createLinearGradient(0, y - 8, 0, y + 16); gold.addColorStop(0, '#f8eef2'); gold.addColorStop(.4, '#d19bad'); gold.addColorStop(1, '#a23d5b');
    ctx.fillStyle = gold; ctx.strokeStyle = '#442133'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(left - 3, y - 5, width + 6, 20, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff2f7'; ctx.fillRect(left + 10, y - 3, width - 20, 2);
    ctx.save(); ctx.beginPath(); ctx.roundRect(left + 8, y + 14, width - 16, 11, 3); ctx.clip();
    for (let col = 0; col < Math.ceil(width / 12); col++) for (let row = 0; row < 2; row++) { ctx.fillStyle = (col + row) % 2 ? '#233047' : '#fffaf0'; ctx.fillRect(left + 8 + col * 12, y + 14 + row * 6, 12, 6); }
    ctx.restore(); this.flag(ctx, x + width * .34, y - 5, 61, 37, clock);
    const label = text('finishLabel', this.language).toUpperCase();
    ctx.font = '700 18px Fredoka'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#402233'; ctx.strokeText(label, x, y + 48); ctx.fillStyle = '#fff2f6'; ctx.fillText(label, x, y + 48); ctx.restore();
  }
  enqueueScene(queue, kind, delta, source, appliedDelta = delta) {
    const last = queue.at(-1), existing = last?.contributions.find(c => c.actor.username === source?.actor.username && c.simulated === source?.simulated);
    if (last?.kind === kind && last.sequence === this.sceneSequence && (!source || existing || last.contributions.length < 3)) {
      last.delta += delta; last.commands += source?.commands || (source ? 1 : 0);
      last.appliedDelta = (last.appliedDelta ?? last.delta - delta) + appliedDelta;
      if (existing) {
        if (existing.gift || source.gift) existing.gift = { ...(source.gift || existing.gift), repeatCount: (existing.gift?.repeatCount || existing.amount) + (source.gift?.repeatCount || source.amount) };
        existing.amount += source.amount; existing.commands += source.commands || 1;
      }
      else if (source) last.contributions.push({ ...source, gift: source.gift ? { ...source.gift } : null, commands: source.commands || 1 });
    } else { this.sceneSequence = (this.sceneSequence || 0) + 1; queue.push({ kind, delta, appliedDelta, sequence: this.sceneSequence, commands: source?.commands || (source ? 1 : 0), contributions: source ? [{ ...source, gift: source.gift ? { ...source.gift } : null, commands: source.commands || 1 }] : [] }); }
    this.sceneLedger.receivedCommands += source?.commands || (source ? 1 : 0);
    this.pendingVisualUnits = (this.pendingVisualUnits || 0) + (source?.amount || 0);
  }
  event(e) {
    this.giftFX.event(e);
    if (['reset', 'roundStart'].includes(e.kind)) {
      this.camera = null; this.particles.length = 0;
      if (e.kind === 'reset' && e.actor) this.enqueueScene(this.portalJobs, 'portal', 0, { ...e, action: 'reset' });
      else this.moment = { kind: 'portal', clock: e.clock };
    }
    if (e.kind === 'win') this.moment = { kind: 'trophy', clock: e.clock };
    if (e.kind === 'win' || (e.kind === 'winAdd' || e.kind === 'winRemove') && (e.requestedWins || e.changed)) {
      const delta = e.kind === 'win' ? 1 : e.requestedWins || e.changed, kind = delta < 0 ? 'theft' : 'gain';
      const source = e.actor ? { ...e, action: e.kind, amount: Math.abs(delta), delta: 0 } : null;
      if (!this.scoreMoment && !this.scoreJobs.length && Number.isFinite(e.winsBefore)) this.presentedWins = e.winsBefore;
      this.enqueueScene(this.scoreJobs, kind, delta, source, e.changed ?? delta);
    }
    if (e.kind === 'control' && ['session.end', 'session.panic'].includes(e.action)) {
      this.sceneLedger.cancelledCommands += [...this.scoreJobs, ...this.portalJobs, this.scoreMoment, this.portalMoment].reduce((sum, j) => sum + (j?.commands || 0), 0);
      this.scoreJobs.length = this.portalJobs.length = 0; this.scoreMoment = this.portalMoment = null;
      this.pendingVisualUnits = 0;
      this.presentedWins = null;
    }
    if (e.kind !== 'landing' && e.kind !== 'effectEnd' && e.kind !== 'win') return;
    const n = e.kind === 'win' ? 18 : e.kind === 'effectEnd' ? 9 : 5;
    for (let i = 0; i < n && this.particles.length < 96; i++) {
      this.particles.push({ x: e.x, y: e.y, anchor: e.kind !== 'landing', clock: e.clock, life: e.kind === 'win' ? 1 : 0.5,
        vx: Math.sin(i * 2.4 + e.clock) * (e.kind === 'win' ? 130 : 55), vy: Math.cos(i * 1.7) * 45 + 50,
        size: e.kind === 'win' ? 4 : 2.5, color: e.kind === 'win' ? '#ffe997' : '#fffbea' });
    }
  }
  screenY(y) { return this.height * 0.65 + this.camera - y; }
  background(sim) {
    const ctx = this.ctx, h = this.height;
    const key = sim.settings.backgroundTheme === 'Auto' ? sim.world.biome(sim.distance) : sim.settings.backgroundTheme;
    if (this.backgroundKey !== key) { this.backgroundPrevious = sim.paused ? key : this.backgroundKey || key; this.backgroundKey = key; this.backgroundChanged = sim.clock; }
    const draw = (biome, alpha = 1) => {
      const image = this.backgrounds[biome];
      const fit = Math.max(WIDTH / image.width, h / image.height) * 1.035, w = image.width * fit, ih = image.height * fit;
      ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(image, (WIDTH - w) / 2 + Math.sin(this.camera * .0003) * 4, (h - ih) / 2 + Math.sin(this.camera * .00017) * 9, w, ih);
      ctx.restore();
    };
    const mix = clamp((sim.clock - this.backgroundChanged) / .55, 0, 1);
    draw(this.backgroundPrevious); if (this.backgroundPrevious !== key) draw(key, mix);
    if (mix >= 1) this.backgroundPrevious = key;
    const ambient = BACKGROUNDS[key].ambient, count = sim.settings.visualQuality === 'Low' ? 6 : 15;
    ctx.save();
    for (let i = 0; i < count; i++) {
      const p = (sim.clock * (ambient === 'embers' ? .085 : .02) + i * .137) % 1;
      const x = (i * 131.73 + Math.sin(sim.clock * .3 + i) * 15) % WIDTH, y = (1 - p) * h;
      ctx.globalAlpha = (.12 + Math.sin(p * Math.PI) * .35) * sim.settings.effectsIntensity;
      ctx.fillStyle = ambient === 'embers' ? '#ffba63' : ambient === 'fireflies' ? '#e9b1bf' : '#f4fcff';
      ctx.beginPath(); ctx.arc(x, y, ambient === 'mist' ? 2.1 : 1 + i % 3 * .45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  platforms(sim) {
    const ctx = this.ctx;
    const platforms = [...sim.world.cache.values()].sort((a, b) => a.y - b.y);
    for (const p of platforms) {
      const sy = this.screenY(p.y), x = sim.world.x(p, sim.clock);
      if (sy < -110 || sy > this.height + 100) continue;
      if (p.type === 'finish') { this.finishPlatform(ctx, x, sy, p.w, sim.clock); continue; }
      const unavailable = !sim.world.available(p, sim.clock), left = x - p.w / 2;
      const colors = p.type === 'spring' ? ['#e1a9bf', '#7e324c'] : p.type === 'crumble' ? ['#c4b5a1', '#6f554a'] : p.type === 'vanish' ? ['#f4d8e3', '#a05a76'] : p.type === 'moving' ? ['#d7dce4', '#657082'] : ['#e7dfe3', '#8d344d'];
      const cycle = (sim.clock + p.phase) % 6.4;
      ctx.save(); ctx.globalAlpha = unavailable ? .08 : p.type === 'vanish' && cycle > 4.3 ? .45 + Math.sin(sim.clock * 18) * .3 : 1;
      ctx.fillStyle = 'rgba(37,81,113,.12)'; ctx.beginPath(); ctx.ellipse(x, sy + 23, p.w * .48, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colors[1]; ctx.beginPath(); ctx.roundRect(left, sy - 1, p.w, 16, 5); ctx.fill();
      const surface = ctx.createLinearGradient(0, sy - 4, 0, sy + 10); surface.addColorStop(0, colors[0]); surface.addColorStop(1, colors[1]);
      ctx.fillStyle = surface; ctx.beginPath(); ctx.roundRect(left, sy - 4, p.w, 13, 4); ctx.fill();
      ctx.strokeStyle = '#241c28'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(left + 7, sy - 2); ctx.lineTo(left + p.w - 7, sy - 2); ctx.stroke();
      if (p.type === 'crumble') {
        ctx.strokeStyle = '#503c3e'; ctx.lineWidth = 1.8;
        for (const offset of [-.22, .15]) { ctx.beginPath(); ctx.moveTo(x + p.w * offset, sy - 3); ctx.lineTo(x + p.w * offset + 4, sy + 2); ctx.lineTo(x + p.w * offset, sy + 8); ctx.stroke(); }
        const broken = sim.clock - ((sim.world.unavailable.get(p.id) || 0) - 2.5);
        if (unavailable && broken >= 0 && broken < .55) {
          ctx.globalAlpha = 1 - broken / .55;
          for (let i = 0; i < 4; i++) {
            ctx.save(); ctx.translate(left + p.w * (i + .5) / 4 + (i - 1.5) * broken * 34, sy + 12 + broken * broken * 250); ctx.rotate((i - 1.5) * broken * 1.7);
            ctx.fillStyle = colors[0]; ctx.fillRect(-p.w / 10, -5, p.w / 5, 11); ctx.strokeRect(-p.w / 10, -5, p.w / 5, 11); ctx.restore();
          }
        }
      }
      if (p.type === 'spring') {
        ctx.strokeStyle = '#80364f'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.beginPath();
        ctx.moveTo(x - 14, sy - 7); ctx.lineTo(x + 13, sy - 11); ctx.lineTo(x - 12, sy - 15); ctx.lineTo(x + 11, sy - 19); ctx.stroke();
        ctx.fillStyle = '#fff1f4'; ctx.beginPath(); ctx.roundRect(x - 18, sy - 23, 36, 6, 3); ctx.fill();
      }
      if (p.type === 'moving') {
        ctx.strokeStyle = '#434351'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        for (const direction of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + direction * 10, sy); ctx.lineTo(x + direction * 15, sy + 3); ctx.lineTo(x + direction * 10, sy + 6); ctx.stroke(); }
      }
      ctx.restore();
      if (p.type === 'moving') {
        ctx.save(); ctx.strokeStyle = 'rgba(63,96,124,.22)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(p.x - p.movingRange, sy + 27); ctx.lineTo(p.x + p.movingRange, sy + 27); ctx.stroke(); ctx.restore();
      }
      if (sy > 180 && !p.branch && (p.level % 5 === 0 || p.level === 0 || p.type === 'finish')) {
        ctx.save(); ctx.font = '700 12px Fredoka'; ctx.textAlign = 'center'; ctx.lineWidth = 3;
        const label = p.type === 'finish' ? text('finishLabel', this.language).toUpperCase() : String(p.level) + ' m';
        ctx.strokeStyle = 'rgba(28,66,87,.65)'; ctx.strokeText(label, x, sy + 35);
        ctx.fillStyle = '#fff8dc'; ctx.fillText(label, x, sy + 35); ctx.restore();
      }
    }
  }
  effects(sim, x, y) {
    const a = sim.active, ctx = this.ctx;
    if (a) {
      const t = a.elapsed / a.duration, alpha = Math.min(1, a.elapsed * 9, (1 - t) * 8);
      const copies = Math.min(3, Math.max(1, Math.ceil(a.amount)));
      if (a.kind === 'balloon' && !a.released) {
        for (let i = 0; i < copies; i++) {
          const offset = copies === 1 ? 0 : (i - (copies - 1) / 2) * 42;
          const bx = x + offset + Math.sin(sim.clock * 2.6 + i) * 11, by = y - 126 - (i % 2) * 15;
          const inflation = Math.min(1, a.elapsed / .2);
          ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = '#fff2ef'; ctx.lineWidth = 2.2; ctx.beginPath();
          ctx.moveTo(x + 13, y - 37); ctx.quadraticCurveTo(bx + 23, y - 76, bx, by + 34); ctx.stroke();
          this.smallEffect(ctx, 'balloon', bx, by, (copies > 1 ? 71 : 88) * (.45 + inflation * .55), sim.clock + i); ctx.restore();
        }
      }
      if (a.kind === 'anvil') {
        const fall = clamp(a.elapsed / a.impactAt, 0, 1), age = Math.max(0, a.elapsed - a.impactAt);
        const width = copies > 1 ? 94 : 124, height = width * this.props.anvil.height / this.props.anvil.width;
        const contact = y - 67 - height / 2;
        const ay = contact - (1 - fall * fall) * Math.min(this.height * .6, 390) - Math.sin(age * 18) * 7 * Math.exp(-age * 6);
        for (let i = 0; i < copies; i++) {
          const ax = x + (i - (copies - 1) / 2) * 61;
          this.prop('anvil', ax, ay - (i % 2) * 6, width, Math.min(1, a.elapsed * 20, (1 - t) * 7), (1 - fall) * -.12);
          if (!a.impacted) {
            ctx.save(); ctx.strokeStyle = '#d9efffa0'; ctx.lineWidth = 2.5;
            for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(ax + side * 32, ay - height / 2 - 10); ctx.lineTo(ax + side * 32, ay - height / 2 - 48); ctx.stroke(); } ctx.restore();
          }
        }
      }
      if (a.kind === 'meteor') meteorApproach(this, sim, x, y);
      if (a.kind === 'cloud') this.sprite('cloud', x, y + 17, 135, 81, Math.sin(sim.clock * 2) * 0.025, alpha);
      if (a.kind === 'rocket') this.sprite('rocket', x, y + 38, 72, 132, Math.sin(sim.clock * 3) * 0.02, alpha);
      if (a.kind === 'wind') this.sprite('tornado', x, y - 5, 142, 169, Math.sin(sim.clock * 5) * 0.04, alpha * 0.82);
      if (a.kind === 'vortex') this.sprite('vortex', x, y + 24, 151, 151, sim.clock * 0.8, alpha * 0.9);
      if (a.kind === 'magnet') this.sprite('magnet', x, y - 112, 73, 91, Math.sin(sim.clock * 2) * 0.035, alpha);
    }
    if (this.moment) {
      const elapsed = sim.clock - this.moment.clock;
      if (elapsed > 1.3) this.moment = null;
      else if (this.moment.kind === 'portal') this.sprite('portal', x, y - 33, 135, 135, sim.clock * 0.4, Math.sin(elapsed / 1.3 * Math.PI) * 0.8);
      else this.sprite('trophy', x, y - 115 - Math.sin(elapsed * Math.PI / 1.3) * 30, 86, 86, Math.sin(elapsed * 5) * 0.1, Math.min(1, elapsed * 7, (1.3 - elapsed) * 6));
    }
    if (this.portalMoment && sim.clock - this.portalMoment.clock >= this.portalMoment.duration) {
      if (!this.portalMoment.cued) this.onCue?.({ kind: 'portalReset' });
      this.sceneLedger.completedCommands += this.portalMoment.commands; this.portalMoment = null;
    }
    if (!this.portalMoment && !this.scoreMoment && !sim.active && this.portalJobs.length && (this.portalJobs[0].sequence < (this.scoreJobs[0]?.sequence ?? Infinity))) {
      this.portalMoment = { ...this.portalJobs.shift(), clock: sim.clock, duration: this.portalJobs.length > 8 ? .8 : 1.3 };
      this.pendingVisualUnits -= this.portalMoment.contributions.reduce((n, c) => n + c.amount, 0);
      this.onScoreStart?.(this.portalMoment);
    }
    if (this.portalMoment) {
      const job = this.portalMoment, t = (sim.clock - job.clock) / job.duration;
      if (!job.cued && t >= .1) { job.cued = true; this.onCue?.({ kind: 'portalReset' }); }
      this.sprite('portal', x, y - 33, 165 + Math.sin(t * Math.PI) * 40, 165 + Math.sin(t * Math.PI) * 40, sim.clock * .6, Math.sin(t * Math.PI) * .85);
    }
  }
  character(sim, x, y) {
    const ctx = this.ctx, p = sim.player;
    let pose = p.squash > 0.5 ? 'land' : p.vy < -80 || sim.active?.delta < 0 ? 'fall' : p.vy > 80 || sim.active ? 'rise' : 'idle';
    const scene = this.scoreMoment ? showFrame(this.scoreMoment, sim.clock) : null;
    if (scene) pose = scene.squash > .15 ? 'land' : this.scoreMoment.kind === 'gain' && scene.t >= .32 && scene.t < .76 ? 'fall' : 'idle';
    const source = this.sprites[pose], stretch = scene ? 0 : clamp(p.vy / 1320, -.5, 1) * .065;
    const squash = scene ? scene.squash : p.squash * .19;
    const h = 69 * (1 + stretch - squash), w = 69 * source.w / source.h * (1 - stretch * .45 + squash * .70);
    ctx.save(); ctx.translate(x, y - h / 2 + (scene?.recoil || 0)); ctx.rotate((scene?.tilt || 0) + p.vx / 420 * 0.045 * (scene ? 0 : 1));
    if (scene && this.scoreMoment.kind === 'gain' && scene.t >= .32 && scene.t < .72) {
      // The authored trophy arms replace the baked sprite arms while lifting.
      ctx.beginPath(); ctx.rect(-w * .345, -h / 2 - 1, w * .69, h + 2); ctx.clip();
    }
    this.sprite(pose, 0, 0, w, h);
    ctx.restore();
  }
  advanceScore(sim) {
    const settle = delta => { this.presentedWins = (this.presentedWins ?? sim.wins - delta) + delta; };
    if (this.presentedWins === undefined || this.presentedWins === null) {
      const outstanding = this.scoreJobs.reduce((sum, j) => sum + (j.appliedDelta ?? j.delta), 0) + (this.scoreMoment && !this.scoreMoment.scoreApplied && !this.scoreMoment.cued ? this.scoreMoment.appliedDelta ?? this.scoreMoment.delta : 0);
      this.presentedWins = clamp(sim.wins - outstanding, -100000000, 100000000);
    }
    if (this.scoreMoment && this.scoreMoment.cinematicVersion !== 2) {
      const job = this.scoreMoment, progress = clamp((sim.clock - job.clock) / job.duration, 0, 1);
      job.duration = SHOWS[job.kind].duration; job.clock = sim.clock - progress * job.duration; job.cinematicVersion = 2;
      if (job.cued) { job.scoreApplied = true; job.cueFlags = Object.fromEntries(SHOWS[job.kind].cues.filter(([at]) => at <= SHOWS[job.kind].settle).map(([, kind]) => [kind, true])); }
      sim.cinematicUntil = job.clock + job.duration;
    }
    if (this.scoreMoment) {
      cueShow(this.scoreMoment, sim.clock, this.onCue, settle);
      if (sim.clock - this.scoreMoment.clock >= this.scoreMoment.duration - 1e-9) {
        this.sceneLedger.completedCommands += this.scoreMoment.commands;
        this.scoreMoment = null;
      }
    }
    if (!this.scoreMoment && !this.portalMoment && !sim.active && !sim.paused && !sim.ended && this.scoreJobs.length && (this.scoreJobs[0].sequence < (this.portalJobs[0]?.sequence ?? Infinity))) {
      const job = this.scoreJobs.shift();
      this.scoreMoment = { ...job, clock: sim.clock, cinematicVersion: 2, duration: this.scoreJobs.length > 8 ? SHOWS[job.kind].busyDuration : SHOWS[job.kind].duration, cueFlags: {}, scoreApplied: false };
      sim.cinematicUntil = sim.clock + this.scoreMoment.duration;
      sim.releaseInput();
      this.pendingVisualUnits -= job.contributions.reduce((n, c) => n + c.amount, 0);
      try { this.onScoreStart?.(this.scoreMoment); }
      catch { this.scoreMoment.presentationErrors = (this.scoreMoment.presentationErrors || 0) + 1; }
    }
    if (!this.scoreMoment && !this.scoreJobs.length) this.presentedWins = sim.wins;
  }
  scoreTarget() {
    const stage = this.canvas.getBoundingClientRect(), badge = this.hudTrophy.getBoundingClientRect(), factor = WIDTH / this.cssWidth;
    return { x: (badge.left - stage.left + badge.width / 2) * factor, y: (badge.top - stage.top + badge.height / 2) * factor };
  }
  scoreFX(sim, hero, target) {
    const ctx = this.fx;
    if (!ctx || !this.hudTrophy || !this.scoreBadge) return;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0); ctx.clearRect(0, 0, WIDTH, this.height);
    const job = this.scoreMoment;
    const t = job ? showFrame(job, sim.clock).t : 0;
    this.hudTrophy.style.visibility = job?.kind === 'theft' && t >= SHOWS.theft.settle ? 'hidden' : 'visible';
    this.scoreBadge.classList.toggle('score-gain', job?.kind === 'gain' && t >= SHOWS.gain.settle);
    this.scoreBadge.classList.toggle('score-theft', job?.kind === 'theft' && t >= SHOWS.theft.settle);
    this.winShow.front(ctx, sim, job, hero, target);
  }
  render(sim, alpha = 1, dt = 0) {
    if (!this.atlas) return null;
    let x = Math.abs(sim.player.x - sim.previous.x) > WIDTH / 2 ? sim.player.x : lerp(sim.previous.x, sim.player.x, alpha);
    const y = lerp(sim.previous.y, sim.player.y, alpha);
    // Gift travel can cover thousands of pixels per frame. Follow the same
    // interpolated player position, including the release frame, without lag.
    if (this.camera === null || sim.active || this.giftTracked || (!sim.paused && dt === 0)) this.camera = y;
    else if (!sim.paused && !sim.ended) {
      // Let a normal jump rise through the frame before the camera scrolls.
      // Negative gifts keep their exact lock; falling remains recoverable.
      const upper = y - this.height * .2, lower = y + this.height * .12;
      if (this.camera < upper) this.camera = lerp(this.camera, upper, 1 - Math.exp(-dt * 15));
      if (this.camera > lower) this.camera = lerp(this.camera, lower, 1 - Math.exp(-dt * 15));
      this.camera = clamp(this.camera, y - this.height * .25, y + this.height * .17);
    }
    this.giftTracked = Boolean(sim.active);
    const ctx = this.ctx; ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.color(sim.settings.characterColor);
    this.advanceScore(sim);
    if (this.scoreMoment) {
      const t = showFrame(this.scoreMoment, sim.clock).t;
      const frame = Math.min(clamp(t / .15, 0, 1), clamp((1 - t) / .10, 0, 1));
      x = lerp(x, clamp(x, 67, WIDTH - 67), frame * frame * (3 - 2 * frame));
    }
    ctx.save(); const shake = this.giftFX.shake(sim); ctx.translate(shake, shake * .55);
    this.background(sim); this.platforms(sim); ctx.restore();
    const sy = this.screenY(y);
    const hero = { x, y: sy }, target = this.scoreTarget();
    this.winShow.behind(ctx, sim, this.scoreMoment, hero, target);
    this.giftFX.behind(ctx, sim, x, sy);
    for (const b of this.giftFX.bursts) if (b.kind === 'meteor') meteorImpact(this, sim, b);
    this.effects(sim, x, sy); this.character(sim, x, sy);
    if (x < 40) this.character(sim, x + WIDTH, sy);
    if (x > WIDTH - 40) this.character(sim, x - WIDTH, sy);
    this.particles = this.particles.filter(p => sim.clock - p.clock <= p.life);
    if (sim.settings.visualQuality !== 'Low') for (const p of this.particles) {
      const age = sim.clock - p.clock;
      const px = (p.anchor ? x : p.x) + p.vx * age;
      const py = p.anchor ? sy - p.vy * age : this.screenY(p.y + p.vy * age - age * age * 120);
      ctx.save(); ctx.globalAlpha = (1 - age / p.life) * sim.settings.effectsIntensity; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    this.giftFX.front(ctx, sim, x, sy);
    this.scoreFX(sim, hero, target);
    return { x: x / WIDTH * this.cssWidth, y: sy / WIDTH * this.cssWidth };
  }
}
