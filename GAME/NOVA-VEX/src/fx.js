import { ACTIONS, clamp } from './config.js';

const TAU = Math.PI * 2;
const phase = n => (n % 1 + 1) % 1;
function star(ctx, x, y, radius, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = rotation + i * Math.PI / 4, r = i % 2 ? radius * .25 : radius;
    const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
    if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}
function glow(ctx, x, y, radius, color, alpha) {
  ctx.save(); ctx.globalAlpha *= alpha;
  const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
  light.addColorStop(0, color + '99'); light.addColorStop(.5, color + '25'); light.addColorStop(1, color + '00');
  ctx.fillStyle = light; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
}

// The scene follows the jumper; only the scenery shakes at an impact. All
// particles derive from simulation time, so pause also freezes the spectacle.
export class GiftFX {
  constructor() { this.bursts = []; this.lastImpact = null; }
  event(e) {
    if (e.kind === 'reset' || e.kind === 'roundStart') { this.bursts.length = 0; this.lastImpact = null; }
    if (e.kind === 'impact' || e.kind === 'balloonPop') {
      this.bursts.push({ kind: e.kind === 'balloonPop' ? 'balloon' : e.action, clock: e.clock, amount: e.amount || 1, x: e.x, y: e.y });
      if (this.bursts.length > 8) this.bursts.shift();
      if (e.kind === 'impact') this.lastImpact = { kind: e.action, clock: e.clock };
    }
  }
  shake(sim) {
    const age = this.lastImpact ? sim.clock - this.lastImpact.clock : 10;
    const meteor = this.lastImpact?.kind === 'meteor', power = meteor ? 11 : 4, duration = meteor ? .6 : .38;
    return age < duration ? Math.sin(age * 100) * power * (1 - age / duration) : 0;
  }
  behind(ctx, sim, x, y) {
    const a = sim.active; if (!a) return;
    const detail = sim.settings.effectsIntensity, low = sim.settings.visualQuality === 'Low';
    const t = a.elapsed / a.duration, fade = Math.min(1, a.elapsed * 8, (a.duration - a.elapsed) * 7);
    const strength = Math.min(1.35, 1 + Math.log2(1 + a.amount) * .045);
    const color = ACTIONS[a.kind].color;
    ctx.save(); ctx.globalAlpha = fade * detail;
    glow(ctx, x, y - 35, (a.kind === 'meteor' ? 145 : 115) * strength, color, .7);
    ctx.lineCap = 'round';
    if (['magnet', 'vortex', 'wind'].includes(a.kind)) {
      const count = low ? 2 : 5;
      for (let i = 0; i < count; i++) {
        const p = phase(sim.clock * .9 + i / count), radius = 26 + p * 105;
        ctx.strokeStyle = i % 2 ? '#f3ffff' : color; ctx.globalAlpha = fade * detail * (1 - p) * .65;
        ctx.lineWidth = 1.5 + (1 - p) * 1.5;
        ctx.beginPath(); ctx.ellipse(x, y - 27, radius, radius * .46, sim.clock * (a.kind === 'vortex' ? .7 : -.3), 0, TAU); ctx.stroke();
      }
      if (a.kind === 'magnet' || a.kind === 'vortex') {
        ctx.globalAlpha = fade * detail * .85; ctx.strokeStyle = '#e3faff'; ctx.lineWidth = 1.8;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          for (let i = 0; i <= 9; i++) {
            const xx = x + side * (30 + Math.sin(i * 1.7 + sim.clock * 22) * 10), yy = y - 105 + i * 12;
            if (!i) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
          }
          ctx.stroke();
        }
      }
    }
    if (a.kind === 'cloud') {
      const beam = ctx.createLinearGradient(0, y - 200, 0, y + 10); beam.addColorStop(0, '#c4f8ff00'); beam.addColorStop(1, '#efffff66');
      ctx.globalAlpha = fade * detail * .65; ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x - 72, y - 205); ctx.lineTo(x + 72, y - 205); ctx.lineTo(x + 41, y + 10); ctx.lineTo(x - 41, y + 10); ctx.fill();
      ctx.fillStyle = '#e6fbff';
      for (let i = 0; i < (low ? 3 : 7); i++) {
        const p = phase(sim.clock * .45 + i * .17); ctx.globalAlpha = fade * detail * Math.sin(p * Math.PI) * .38;
        ctx.beginPath(); ctx.ellipse(x + Math.sin(i * 2.5) * (58 + p * 30), y + 27 + p * 48, 15 + p * 12, 8 + p * 6, 0, 0, TAU); ctx.fill();
      }
    }
    if (a.kind === 'rocket' || a.kind === 'meteor' && a.impacted) {
      const up = a.kind === 'meteor', center = y + (up ? -10 : 85);
      ctx.globalAlpha = fade * detail;
      const flame = ctx.createLinearGradient(0, center, 0, center + (up ? -125 : 125));
      flame.addColorStop(0, '#fff8c2'); flame.addColorStop(.25, '#ffbf45cc'); flame.addColorStop(.65, '#ff653a88'); flame.addColorStop(1, '#ff443300');
      ctx.fillStyle = flame; ctx.beginPath(); ctx.moveTo(x - 18, center);
      ctx.quadraticCurveTo(x - 40, center + (up ? -65 : 65), x + Math.sin(sim.clock * 25) * 10, center + (up ? -135 : 135));
      ctx.quadraticCurveTo(x + 42, center + (up ? -65 : 65), x + 18, center); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffe29f'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const p = phase(sim.clock * 1.2 + i / 3); ctx.globalAlpha = fade * detail * (1 - p) * .6; ctx.beginPath(); ctx.ellipse(x, center + p * (up ? -105 : 105), 15 + p * 46, 4 + p * 8, 0, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = fade * detail;
    for (let i = 0; i < (low ? 7 : 26); i++) {
      const p = phase(sim.clock * (a.kind === 'wind' ? 1.2 : .65) + i * .137), side = Math.sin(i * 4.67);
      const px = x + side * (35 + p * 85), py = y - 105 + p * 230;
      ctx.globalAlpha = fade * detail * Math.sin(p * Math.PI) * .8;
      ctx.fillStyle = ['cloud', 'balloon', 'magnet'].includes(a.kind) ? (i % 3 ? '#f5ffff' : color) : color;
      if (a.kind === 'wind') {
        ctx.save(); ctx.translate(x + Math.sin(p * TAU + i) * (50 + p * 42), py); ctx.rotate(sim.clock * 3 + i); ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.5, 0, 0, TAU); ctx.fill(); ctx.restore();
      } else if (a.kind === 'anvil' || a.kind === 'meteor' || a.kind === 'rocket') {
        ctx.strokeStyle = i % 3 ? color : '#ffe6ad'; ctx.lineWidth = i % 3 === 0 ? 2.5 : 1.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - side * 3, py + (a.delta < 0 ? -1 : 1) * (12 + p * 25)); ctx.stroke();
      } else star(ctx, px, py, 2 + Math.sin(i) ** 2 * 3, sim.clock + i);
    }
    ctx.restore();
  }
  front(ctx, sim, x, y) {
    this.bursts = this.bursts.filter(b => sim.clock - b.clock < (b.kind === 'meteor' ? 1.35 : .95));
    for (const b of this.bursts) {
      if (b.kind === 'meteor') continue; // Its textured explosion uses the impact's world position.
      const age = sim.clock - b.clock, t = age / .95, meteor = b.kind === 'meteor', balloon = b.kind === 'balloon';
      const center = y - (balloon ? 122 : 63), count = sim.settings.visualQuality === 'Low' ? 12 : meteor ? 46 : 28;
      ctx.save();
      if (!balloon && age < .15) {
        ctx.fillStyle = meteor ? '#fff4a5' : '#fffbee'; ctx.globalAlpha = (1 - age / .15) * .85;
        star(ctx, x, center, (meteor ? 86 : 59) * (1 + age * 2), age * .3);
      }
      glow(ctx, x, center, (meteor ? 155 : 85) * (1 + t), meteor ? '#ff9540' : balloon ? '#ffb6ef' : '#b7d8ff', (1 - t) * .8);
      ctx.globalAlpha = (1 - t) * sim.settings.effectsIntensity;
      for (let ring = 0; ring < 2; ring++) {
        ctx.strokeStyle = ring ? '#ffffff' : meteor ? '#ffaf4b' : balloon ? '#ff8bd2' : '#d6efff';
        ctx.lineWidth = (1 - t) * (meteor ? 5 : 3); ctx.beginPath();
        ctx.ellipse(x, center, 12 + t * (meteor ? 175 : 110) + ring * 15, 5 + t * (meteor ? 82 : 50) + ring * 5, 0, 0, TAU); ctx.stroke();
      }
      for (let i = 0; i < count; i++) {
        const angle = i * 2.399, speed = 65 + (Math.sin(i * 8) + 1) * (meteor ? 130 : 70);
        const px = x + Math.cos(angle) * age * speed, py = center + Math.sin(angle) * age * speed + age * age * 160;
        ctx.fillStyle = balloon ? ['#ff6cb2', '#fff5bb', '#b5f6ff', '#b699ff'][i % 4] : meteor ? ['#fff0af', '#ff9b37', '#703a37'][i % 3] : ['#fff3c3', '#f2fbff', '#ffb568'][i % 3];
        if (balloon || meteor && i % 3 === 2) { ctx.save(); ctx.translate(px, py); ctx.rotate(angle + age * 5); ctx.fillRect(-3, -2, 6 + i % 3, 4); ctx.restore(); }
        else star(ctx, px, py, (1 - t) * (3 + i % 4), angle + age * 4);
      }
      ctx.restore();
    }
  }
}
