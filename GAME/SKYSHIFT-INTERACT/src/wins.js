import { WIDTH, CHARACTER_COLORS, clamp, lerp } from './config.js';
import { distance, winLabel } from './copy.js';

const TAU = Math.PI * 2;
export const SHOWS = Object.freeze({
  gain: { duration: 4.4, busyDuration: 3.4, settle: .82, cues: [[.025, 'trophyDescent'], [.34, 'trophyCatch'], [.49, 'championLift'], [.70, 'trophyFlight'], [.82, 'trophyGain']] },
  theft: { duration: 5.2, busyDuration: 4.1, settle: .78, cues: [[.025, 'alienArrival'], [.17, 'alienHatch'], [.39, 'alienPunch'], [.47, 'alienTaunt'], [.78, 'trophyTheft'], [.91, 'alienExit']] }
});
const smooth = t => t * t * (3 - 2 * t);
const segment = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = (t, a, b) => smooth(segment(t, a, b));
const out = t => 1 - (1 - t) ** 3;
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], ease(t, keys[i - 1][0], keys[i][0]));
  return keys.at(-1)[1];
}
export function showFrame(job, clock) {
  const t = clamp((clock - job.clock) / job.duration, 0, 1);
  if (job.kind === 'theft') return {
    t, phase: t < .17 ? 'arrival' : t < .31 ? 'descent' : t < .39 ? 'windup' : t < .46 ? 'impact' : t < .61 ? 'taunt' : t < .78 ? 'reach' : t < .91 ? 'escape' : 'departure',
    squash: track(t, [[0, 0], [.385, 0], [.40, .46], [.43, .12], [.46, .25], [.52, 0]]),
    tilt: track(t, [[0, 0], [.385, 0], [.403, -.20], [.445, .12], [.49, -.06], [.60, 0]]),
    recoil: track(t, [[0, 0], [.385, 0], [.41, 10], [.45, 0], [.49, 3], [.56, 0]])
  };
  return {
    t, phase: t < .17 ? 'summon' : t < .34 ? 'descent' : t < .49 ? 'catch' : t < .70 ? 'champion' : t < .82 ? 'flight' : 'award',
    squash: track(t, [[0, 0], [.325, 0], [.36, .30], [.41, .06], [.46, .12], [.49, 0]]),
    tilt: track(t, [[0, 0], [.34, 0], [.38, -.035], [.43, .025], [.50, 0]]),
    recoil: track(t, [[0, 0], [.34, 0], [.36, 9], [.43, 2], [.49, 0]])
  };
}

// Cues belong to the persisted scene, not a transient audio node. Every crossed
// beat runs once even after a long frame; pause/reload cannot repeat a theft.
export function cueShow(job, clock, emit, settle) {
  const t = showFrame(job, clock).t, spec = SHOWS[job.kind];
  job.cueFlags ||= {};
  for (const [at, kind] of spec.cues) {
    if (t + 1e-9 < at || job.cueFlags[kind]) continue;
    job.cueFlags[kind] = true;
    if (at === spec.settle && !job.scoreApplied) { job.scoreApplied = true; settle(job.appliedDelta ?? job.delta); }
    try { emit?.({ kind, sequence: job.sequence, clock, sceneTime: t, duration: job.duration }); }
    catch { job.presentationErrors = (job.presentationErrors || 0) + 1; }
  }
}

function glow(ctx, x, y, radius, color, alpha = 1) {
  if (radius <= 0 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color); g.addColorStop(1, color.slice(0, 7) + '00');
  ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
}
function star(ctx, x, y, size, angle, color = '#fff1a7') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? size * .22 : size; const a = i * Math.PI / 4; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(r, 0); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function arcPoint(a, control, b, t) {
  return { x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t * t * b.y };
}
function ring(ctx, x, y, radius, color, alpha, thickness = 2) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = thickness;
  ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .33, 0, 0, TAU); ctx.stroke(); ctx.restore();
}

export class WinShow {
  constructor(renderer) { this.r = renderer; }
  part(ctx, name, x, y, width, angle = 0, mirror = false, alpha = 1) {
    const r = this.r, p = r.alienParts?.[name]; if (!p || !r.props?.alien) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(mirror ? -1 : 1, 1); ctx.globalAlpha *= alpha;
    ctx.drawImage(r.props.alien, p.x, p.y, p.w, p.h, -width / 2, -width * p.h / p.w / 2, width, width * p.h / p.w); ctx.restore();
  }
  ship(ctx, x, y, size, angle, clock, hatch, thrust = 1) {
    const p = this.r.shipBounds; if (!p) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    glow(ctx, 0, size * .21, size * .39, '#df718f55', thrust * .55);
    for (const dx of [-.30, 0, .30]) {
      const length = size * (.10 + thrust * .14) * (1 + Math.sin(clock * 32 + dx * 8) * .08);
      const g = ctx.createLinearGradient(0, size * .19, 0, size * .19 + length);
      g.addColorStop(0, '#ffe3ecbb'); g.addColorStop(.32, '#d44b7277'); g.addColorStop(1, '#b92b4800');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(size * dx - size * .047, size * .19); ctx.quadraticCurveTo(size * dx - size * .018, size * .19 + length, size * dx, size * .19 + length); ctx.quadraticCurveTo(size * dx + size * .018, size * .19 + length, size * dx + size * .047, size * .19); ctx.closePath(); ctx.fill();
    }
    const h = size * p.h / p.w;
    ctx.drawImage(this.r.props.ship, p.x, p.y, p.w, p.h, -size / 2, -h / 2, size, h);
    if (hatch > .01) {
      ctx.fillStyle = '#172432'; ctx.strokeStyle = '#ecc1ce'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(0, h * .39, size * .098, size * .030 * hatch, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  beam(ctx, sx, sy, x, y, amount, clock) {
    if (amount <= 0) return;
    ctx.save(); ctx.globalAlpha *= amount;
    const g = ctx.createLinearGradient(sx, sy, x, y + 35); g.addColorStop(0, '#e691ac88'); g.addColorStop(.8, '#c9537822'); g.addColorStop(1, '#d16d8d11');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 10, sy); ctx.lineTo(x - 42, y + 35); ctx.quadraticCurveTo(x, y + 44, x + 42, y + 35); ctx.lineTo(sx + 10, sy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e9acc055'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const t = (clock * .38 + i / 4) % 1; ring(ctx, lerp(sx, x, t), lerp(sy, y + 32, t), lerp(9, 36, t), '#e9acc0', .4 * Math.sin(t * Math.PI), 1.2); }
    ctx.restore();
  }
  arm(ctx, shoulder, elbow, hand, kind, rotation = 0, mirror = false, previousKind = null, mix = 1) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); };
    ctx.strokeStyle = '#131a3c'; ctx.lineWidth = 10; path(); ctx.stroke();
    ctx.strokeStyle = '#9d354e'; ctx.lineWidth = 7; path(); ctx.stroke();
    ctx.strokeStyle = '#e19aac'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(shoulder.x - 1, shoulder.y - 2); ctx.lineTo(elbow.x - 1, elbow.y - 2); ctx.stroke();
    if (previousKind && mix < 1) this.part(ctx, previousKind, hand.x, hand.y, 21, rotation, mirror, 1 - mix);
    this.part(ctx, kind, hand.x, hand.y, kind === 'taunt' ? 22 : 21, rotation, mirror, mix); ctx.restore();
  }
  alien(ctx, x, y, scale, clock, pose = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(pose.tilt || 0); ctx.scale(scale, scale);
    const floating = Number(pose.floating || 0), sway = Math.sin(clock * 5.5) * lerp(.7, 2.5, floating);
    for (const side of [-1, 1]) {
      const swing = Math.sin(clock * 6 + side) * lerp(.035, .24, floating);
      ctx.save(); ctx.translate(side * 8, 12); ctx.rotate(swing + side * .12 * floating);
      ctx.strokeStyle = '#161b3b'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * 2, 10); ctx.stroke(); ctx.strokeStyle = '#9d354e'; ctx.lineWidth = 5; ctx.stroke();
      this.part(ctx, 'boot', side * 2, 17, 20, -swing * .45, side === -1); ctx.restore();
    }
    const right = pose.right || { x: 26, y: 10 }, left = pose.left || { x: -24, y: 10 };
    this.arm(ctx, { x: 11, y: -9 }, pose.rightElbow || { x: 25, y: -4 }, right, pose.rightKind || 'grip', pose.rightRotation || 0, true);
    this.part(ctx, 'torso', 0, 1, 31, 0);
    this.arm(ctx, { x: -12, y: -9 }, pose.leftElbow || { x: -26, y: -2 }, left, pose.leftKind || 'fist', pose.leftRotation || 0, false, pose.leftPreviousKind, pose.leftMix ?? 1);
    this.part(ctx, 'head', sway * .35, -31 + sway * .3, 52, pose.headTilt || Math.sin(clock * 3) * .025);
    // A brief lid blink and laugh bob keep the face alive between authored poses.
    const blink = Math.sin(clock * 1.85) > .998 || pose.blink;
    if (blink) { ctx.strokeStyle = '#183433'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; for (const dx of [-13, 13]) { ctx.beginPath(); ctx.moveTo(dx - 5, -28); ctx.quadraticCurveTo(dx, -25, dx + 5, -28); ctx.stroke(); } }
    ctx.restore();
  }
  crown(ctx, x, y, scale, clock, alpha = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(clock * 2.3) * .025); ctx.scale(scale, scale); ctx.globalAlpha *= alpha;
    glow(ctx, 0, 0, 35, '#ffd87544');
    const g = ctx.createLinearGradient(0, -17, 0, 11); g.addColorStop(0, '#fffac9'); g.addColorStop(.3, '#ffe776'); g.addColorStop(.7, '#ffb524'); g.addColorStop(1, '#bb6816');
    ctx.fillStyle = g; ctx.strokeStyle = '#6b381d'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-22, -13); ctx.lineTo(-10, -4); ctx.lineTo(0, -20); ctx.lineTo(10, -4); ctx.lineTo(22, -13); ctx.lineTo(17, 10); ctx.lineTo(-17, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff5a1'; ctx.fillRect(-17, 3, 34, 2); ctx.fillStyle = '#23cbe0'; ctx.strokeStyle = '#ad6c17'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(5, 2); ctx.lineTo(0, 8); ctx.lineTo(-5, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const dx of [-22, 0, 22]) { ctx.fillStyle = '#fff7bb'; ctx.beginPath(); ctx.arc(dx, dx ? -13 : -20, 2.5, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  fireworks(ctx, sim, x, y, age) {
    if (age <= 0 || age >= 1) return;
    const count = sim.settings.visualQuality === 'Low' ? 10 : 26;
    ctx.save(); ctx.globalAlpha = Math.sin(age * Math.PI) * sim.settings.effectsIntensity;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996, radius = (22 + i % 5 * 16) * out(age);
      const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius + age * age * 32;
      ctx.strokeStyle = i % 3 ? '#ffd959' : '#fff5c3'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(px - Math.cos(angle) * 7 * (1 - age), py - Math.sin(angle) * 7 * (1 - age)); ctx.lineTo(px, py); ctx.stroke();
      star(ctx, px, py, 2.5 * (1 - age) + 1, angle + age * 2);
    } ctx.restore();
  }
  award(ctx, job, target, t, language) {
    const at = SHOWS[job.kind].settle, age = segment(t, at, 1);
    if (t < at) return;
    ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, age * 1.25));
    const label = (job.delta < 0 ? '−' : '+') + distance(Math.abs(job.delta), language) + ' ' + winLabel(Math.abs(job.delta), language).toUpperCase();
    const fontSize = Math.max(16, 28 - Math.max(0, label.length - 8)); ctx.font = '700 ' + fontSize + 'px Fredoka'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#172339';
    const margin = Math.min(WIDTH / 2, ctx.measureText(label).width / 2 + 14);
    const x = clamp(target.x, margin, WIDTH - margin), y = target.y + 62 - age * 24;
    ctx.strokeText(label, x, y); ctx.fillStyle = job.kind === 'gain' ? '#ffe681' : '#ffa4b8'; ctx.fillText(label, x, y); ctx.restore();
  }
  behind(ctx, sim, job, hero, target) {
    if (!job) return;
    const { t } = showFrame(job, sim.clock), intensity = sim.settings.effectsIntensity;
    const envelope = Math.min(1, t / .12, (1 - t) / .14);
    ctx.save(); ctx.globalAlpha = envelope;
    ctx.fillStyle = job.kind === 'theft' ? '#0a172a58' : '#21142833'; ctx.fillRect(0, 0, WIDTH, this.r.height);
    if (job.kind === 'gain') {
      glow(ctx, hero.x, hero.y - 70, 170, '#ffdb6044', intensity);
      const count = sim.settings.visualQuality === 'Low' ? 5 : 11;
      ctx.save(); ctx.translate(hero.x, hero.y - 73); ctx.rotate(sim.clock * .14); ctx.globalAlpha = .13 * intensity;
      for (let i = 0; i < count; i++) { ctx.rotate(TAU / count); const g = ctx.createLinearGradient(0, 0, 0, -240); g.addColorStop(0, '#fff7ad'); g.addColorStop(1, '#ffd34100'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-29, -240); ctx.lineTo(29, -240); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill(); } ctx.restore();
      ring(ctx, hero.x, hero.y + 4, 50 + Math.sin(t * Math.PI) * 28, '#ffdf77', .7 * intensity, 2);
    } else glow(ctx, hero.x + 30, hero.y - 65, 135, '#d85e8344', intensity * .7);
    ctx.restore();
  }
  front(ctx, sim, job, hero, target) {
    if (!job) return;
    const f = showFrame(job, sim.clock); job.phase = f.phase;
    if (job.kind === 'gain') this.gain(ctx, sim, job, hero, target, f);
    else this.theft(ctx, sim, job, hero, target, f);
    this.award(ctx, job, target, f.t, this.r.language);
  }
  gain(ctx, sim, job, hero, target, { t }) {
    const h = { x: hero.x, y: hero.y - 88 + showFrame(job, sim.clock).recoil };
    const lift = ease(t, .46, .61); h.y -= lift * 30;
    const drop = segment(t, .14, .34), falling = drop < 1;
    let cup = { x: h.x, y: lerp(-80, h.y, drop * drop * drop) }, size = 104;
    if (!falling) { cup = h; size = 104 + Math.sin(segment(t, .34, .42) * Math.PI) * 4; }
    const flight = segment(t, .70, .82);
    if (t >= .70) { const p = out(flight); cup = arcPoint(h, { x: target.x - 85, y: h.y - 195 }, target, p); size = lerp(104, 34, smooth(flight)); }
    if (t < .14) {
      const amount = ease(t, .01, .14); glow(ctx, hero.x, 45, 92 * amount, '#fff2b977', .8);
      ring(ctx, hero.x, 45, 38 * amount, '#ffefaa', amount, 2.5);
      for (let i = 0; i < 5; i++) star(ctx, hero.x + Math.sin(i * 2.4) * 42 * amount, 45 + Math.cos(i * 2.4) * 11, 4 * amount, sim.clock + i);
    }
    if (t >= .14 && t < .82) {
      if (falling || flight > 0) {
        for (let i = 7; i > 0; i--) { const radius = (size * .48 + i * 2) * (1 - i / 14); glow(ctx, cup.x, cup.y - (falling ? i * 8 : -i * 2), radius, '#ffd45022', sim.settings.effectsIntensity); }
      }
      glow(ctx, cup.x, cup.y, size * .77, '#fff29c55', sim.settings.effectsIntensity);
      this.r.sprite('trophy', cup.x, cup.y, size, size, falling ? Math.sin(drop * 5) * .045 : Math.sin(t * 20) * .025 * (1 - flight), 1, ctx);
      if (!falling && t < .71) this.hands(ctx, sim, hero, cup, size, ease(t, .32, .35) * (1 - ease(t, .69, .72)));
      star(ctx, cup.x + size * .19, cup.y - size * .25, 5 + Math.sin(sim.clock * 10) * 2, sim.clock * .6);
    }
    if (t >= .34 && t < .46) {
      const impact = segment(t, .34, .46); ring(ctx, hero.x, hero.y - 30, 16 + impact * 53, '#fff2b3', (1 - impact) * sim.settings.effectsIntensity, 3);
    }
    if (t >= .49) {
      const crownT = ease(t, .49, .59); this.crown(ctx, hero.x, hero.y - 71 - (1 - crownT) * 23, .83, sim.clock, crownT * Math.min(1, (1 - t) / .10));
      this.fireworks(ctx, sim, clamp(hero.x - 105, 45, WIDTH - 45), hero.y - 145, segment(t, .49, .83));
      this.fireworks(ctx, sim, clamp(hero.x + 105, 45, WIDTH - 45), hero.y - 135, segment(t, .54, .88));
    }
    if (t >= .82) {
      const age = segment(t, .82, 1); glow(ctx, target.x, target.y, 60, '#ffd86b88', (1 - age) * sim.settings.effectsIntensity);
      this.r.sprite('trophy', target.x, target.y, 34 + Math.sin(age * Math.PI) * 19, 34 + Math.sin(age * Math.PI) * 19, 0, 1 - age, ctx);
      this.fireworks(ctx, sim, target.x, target.y, age);
    }
  }
  hands(ctx, sim, hero, cup, size, alpha) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = 'round';
    const color = CHARACTER_COLORS[sim.settings.characterColor].color;
    for (const side of [-1, 1]) {
      const sx = hero.x + side * 16, sy = hero.y - 39, hx = cup.x + side * size * .18, hy = cup.y + size * .29;
      ctx.strokeStyle = '#172a56'; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + side * 14, hy + 19, hx, hy); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.stroke();
      const g = ctx.createLinearGradient(hx - 7, hy - 7, hx + 7, hy + 8); g.addColorStop(0, '#d7ffff'); g.addColorStop(.4, color); g.addColorStop(1, '#23577b'); ctx.fillStyle = g; ctx.strokeStyle = '#142951'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(hx, hy, 8, 7, side * -.3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hx - 1, hy - 1, 4, 3.4, 5.6); ctx.stroke();
    } ctx.restore();
  }
  theft(ctx, sim, job, hero, target, { t }) {
    const side = hero.x > WIDTH * .59 ? -1 : 1;
    const ground = { x: clamp(hero.x + side * 64, 58, WIDTH - 58), y: hero.y - 29 };
    const park = { x: clamp(ground.x + side * 18, 100, WIDTH - 100), y: Math.max(180, hero.y - 237) };
    const late = ease(t, .60, .78), entrance = out(segment(t, 0, .17)), departure = segment(t, .91, 1);
    let ship = { x: lerp(WIDTH + 120, park.x, entrance), y: lerp(-95, park.y, entrance) };
    ship.x = lerp(ship.x, clamp(target.x + side * 38, 100, WIDTH - 100), late);
    ship.y = lerp(ship.y, Math.max(48, target.y - 57), late);
    const hover = Math.sin(sim.clock * 5.5) * 2 * entrance * (1 - departure);
    ship.y += hover - departure * departure * (this.r.height + 70); ship.x += departure * departure * 165;
    const descend = ease(t, .17, .31), ascend = ease(t, .61, .78);
    const grab = { x: target.x - side * 37, y: target.y + 46 };
    let alien = { x: lerp(park.x, ground.x, descend), y: lerp(park.y + 25, ground.y, descend) };
    alien = arcPoint(alien, { x: ground.x + side * 45, y: (ground.y + grab.y) / 2 }, grab, ascend);
    const escape = ease(t, .81, .91); alien.x = lerp(alien.x, ship.x, escape); alien.y = lerp(alien.y, ship.y + 16, escape);
    const visible = segment(t, .17, .20) * (1 - segment(t, .885, .92)), scale = lerp(1.07, .60, escape);
    const hatch = segment(t, .13, .20) * (1 - segment(t, .87, .93));
    const beam = segment(t, .14, .20) * (1 - segment(t, .32, .38)) + segment(t, .61, .65) * (1 - segment(t, .88, .92));
    this.beam(ctx, ship.x, ship.y + 29, alien.x, alien.y, Math.min(1, beam) * sim.settings.effectsIntensity, sim.clock);
    if (t > .27 && t < .64) ring(ctx, ground.x, hero.y + 2, 24, '#e5a9bc', Math.min(1, (t - .27) / .04, (.64 - t) / .05) * .45 * sim.settings.effectsIntensity, 1.5);
    if (visible > 0) {
      const punch = ease(t, .31, .37) * (1 - ease(t, .412, .46));
      const contactX = -Math.abs(ground.x - hero.x) / 1.07, contactY = (hero.y - 56 - ground.y) / 1.07;
      const tauntAmount = ease(t, .46, .49) * (1 - ease(t, .59, .62)), reach = t >= .69 && t < .815, holding = t >= .78;
      let hand = {
        x: track(t, [[0, -25], [.31, -25], [.37, -9], [.39, contactX], [.412, contactX], [.46, -25], [.49, -29], [.59, -29], [.62, -25]]),
        y: track(t, [[0, 8], [.31, 8], [.37, -51], [.39, contactY], [.412, contactY], [.46, 8], [.49, -31], [.59, -31], [.62, 8]])
      };
      let elbow = { x: track(t, [[0, -26], [.36, -29], [.41, -27], [.48, -27]]), y: lerp(-2 - punch * 27, -2, tauntAmount) };
      const reachAmount = ease(t, .69, .78), holdAmount = ease(t, .78, .815);
      if (t >= .69) {
        hand = { x: lerp(lerp(hand.x, side * (target.x - alien.x) / scale, reachAmount), -12, holdAmount), y: lerp(lerp(hand.y, (target.y - alien.y) / scale, reachAmount), 5, holdAmount) };
        elbow = { x: lerp(elbow.x, lerp(hand.x * .65, -26, holdAmount), reachAmount), y: lerp(elbow.y, lerp(hand.y * .36, 1, holdAmount), reachAmount) };
      }
      const rotation = -.10 * tauntAmount - 1.15 * ease(t, .35, .39) * (1 - ease(t, .412, .46));
      const leftKind = tauntAmount > 0 ? 'taunt' : reach || holding ? 'grip' : 'fist';
      const handMix = tauntAmount > 0 ? tauntAmount : t >= .69 ? ease(t, .69, .72) : 1;
      const handPrevious = tauntAmount > 0 || t >= .69 ? 'fist' : null;
      const floating = (1 - ease(t, .29, .34)) + ease(t, .60, .65);
      ctx.save(); ctx.globalAlpha *= visible; ctx.translate(alien.x, alien.y); ctx.scale(side, 1);
      this.alien(ctx, 0, 0, scale, sim.clock, { left: hand, leftElbow: elbow, leftKind, leftPreviousKind: handPrevious, leftMix: handMix, leftRotation: rotation, right: { x: lerp(26, 10, ease(t, .76, .815)), y: lerp(8, 6, holdAmount) }, rightKind: 'grip', floating: Math.min(1, floating), tilt: lerp(-.025 * punch, -.07 + Math.sin(sim.clock * 13) * .025, tauntAmount), headTilt: lerp(-.05 * punch, Math.sin(sim.clock * 14) * .06, tauntAmount) });
      ctx.restore();
    }
    if (t >= .39 && t < .61) {
      const age = segment(t, .39, .48);
      if (age < 1) { glow(ctx, hero.x, hero.y - 56, 43 + age * 25, '#fff0bdaa', (1 - age) * sim.settings.effectsIntensity); for (let i = 0; i < 6; i++) star(ctx, hero.x + Math.cos(i * TAU / 6) * (12 + age * 35), hero.y - 57 + Math.sin(i * TAU / 6) * (8 + age * 19), 5 * (1 - age), i + age * 3, '#fff3b2'); }
      const alpha = Math.min(1, (t - .39) / .025, (.61 - t) / .05);
      ctx.save(); ctx.globalAlpha *= alpha * sim.settings.effectsIntensity;
      for (let i = 0; i < 4; i++) { const a = sim.clock * 7 + i * TAU / 4; star(ctx, hero.x + Math.cos(a) * 25, hero.y - 85 + Math.sin(a) * 7, 4.3, a, '#ffe882'); } ctx.restore();
    }
    if (t >= .78 && t < .92) {
      const pull = ease(t, .78, .815), cup = { x: lerp(target.x, alien.x - side * 3 * scale, pull), y: lerp(target.y, alien.y + 2 * scale, pull) };
      const size = lerp(34, 33 * scale, pull); glow(ctx, cup.x, cup.y, 31, '#ffe57a44', sim.settings.effectsIntensity);
      this.r.sprite('trophy', cup.x, cup.y, size, size, side * -.18 * pull, visible, ctx);
      if (pull > .2) { this.part(ctx, 'grip', alien.x - side * 13 * scale, alien.y + 8 * scale, 15 * scale, -.15, side < 0, visible); this.part(ctx, 'grip', alien.x + side * 11 * scale, alien.y + 8 * scale, 15 * scale, .15, side > 0, visible); }
    }
    this.ship(ctx, ship.x, ship.y, 179, (1 - entrance) * -.23 + Math.sin(sim.clock * 4) * .013 + departure * .22, sim.clock, hatch, 1 + departure * 2);
  }
}
