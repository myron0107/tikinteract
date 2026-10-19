import { WIDTH, METEOR, clamp, lerp } from './config.js';
const TAU = Math.PI * 2;

function light(ctx, x, y, radius, alpha) {
  const fill = ctx.createRadialGradient(x, y, 0, x, y, radius);
  fill.addColorStop(0, '#fff0aa'); fill.addColorStop(.2, '#ffbd4ca0');
  fill.addColorStop(.6, '#ff632e40'); fill.addColorStop(1, '#ff442000');
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = fill;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
}

export function meteorApproach(renderer, sim, x, y) {
  const a = sim.active; if (!a || a.kind !== 'meteor' || a.impacted) return;
  const ctx = renderer.ctx, strength = sim.settings.effectsIntensity;
  const flight = clamp((a.elapsed - METEOR.launchAt) / (a.impactAt - METEOR.launchAt), 0, 1);
  const fall = flight * flight, warning = Math.min(1, a.elapsed * 9) * (1 - flight);
  ctx.save();
  ctx.fillStyle = '#200b1b'; ctx.globalAlpha = warning * .16 * strength; ctx.fillRect(0, 0, WIDTH, renderer.height);
  ctx.globalAlpha = warning * strength; light(ctx, x, y - 62, 135 + Math.sin(a.elapsed * 18) * 9, .35);
  ctx.strokeStyle = '#ffcb6c'; ctx.lineWidth = 2; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -a.elapsed * 80;
  ctx.beginPath(); ctx.ellipse(x, y - 54, 86 + flight * 25, 43 + flight * 12, -.3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (a.elapsed >= METEOR.launchAt) {
    const copies = Math.min(3, Math.ceil(a.amount));
    for (let i = copies - 1; i >= 0; i--) {
      const offset = i * 33, headX = x + (1 - fall) * 305 + offset;
      const headY = y - 65 - (1 - fall) * 450 - offset * 1.3;
      const size = (i ? 155 : lerp(225, 320, flight));
      ctx.globalAlpha = i ? .68 : 1;
      light(ctx, headX, headY, size * .7, .5 * strength);
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#ffd277'; ctx.globalAlpha *= .4 * strength;
      for (let streak = 0; streak < 5; streak++) {
        ctx.lineWidth = 2 + streak * .8;
        ctx.beginPath(); ctx.moveTo(headX + 18 + streak * 7, headY - 24 - streak * 10);
        ctx.lineTo(headX + 67 + streak * 15, headY - 95 - streak * 18); ctx.stroke();
      }
      ctx.restore();
      // The fire trail points up-right; the rock head is at (.27w, .72h).
      renderer.prop('meteor', headX + size * .23, headY - size * .22, size, i ? .75 : 1);
    }
  }
  ctx.restore();
}

export function meteorImpact(renderer, sim, burst) {
  const age = sim.clock - burst.clock; if (age < 0 || age > 1.35) return;
  const ctx = renderer.ctx, detail = sim.settings.effectsIntensity;
  const low = sim.settings.visualQuality === 'Low', x = burst.x, y = renderer.screenY(burst.y) - 63;
  const strength = Math.min(1.2, 1 + Math.log2(1 + burst.amount) * .035);
  ctx.save(); ctx.globalAlpha = detail;
  if (age < .17) {
    ctx.save(); ctx.globalAlpha = (1 - age / .17) * .24 * detail;
    ctx.fillStyle = '#fff0c2'; ctx.fillRect(0, 0, WIDTH, renderer.height); ctx.restore();
  }
  light(ctx, x, y, (130 + age * 220) * strength, Math.max(0, 1 - age / .7) * .85);
  if (age < .92) {
    const size = (100 + Math.min(1, age / .16) * 325 + age * 95) * strength;
    renderer.prop('blast', x, y, size, Math.min(1, age * 30 + .15) * Math.max(0, 1 - Math.max(0, age - .22) / .7) * detail, age * .08);
  }
  for (let ring = 0; ring < (low ? 2 : 3); ring++) {
    const t = clamp((age - ring * .045) / .65, 0, 1); if (!t || t >= 1) continue;
    ctx.globalAlpha = (1 - t) * detail * .85; ctx.strokeStyle = ring % 2 ? '#fff6d2' : '#ffab42';
    ctx.lineWidth = 6 * (1 - t); ctx.beginPath();
    ctx.ellipse(x, y + 10, 24 + t * 245, 9 + t * 104, ring * .07, 0, TAU); ctx.stroke();
  }
  const count = low ? 14 : 40;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399, speed = 150 + (Math.sin(i * 12.3) + 1) * 135;
    const px = x + Math.cos(angle) * age * speed, py = y + Math.sin(angle) * age * speed + age * age * 260;
    const size = 3 + i % 5, fade = Math.max(0, 1 - age / (1 + (i % 3) * .12));
    ctx.save(); ctx.translate(px, py); ctx.rotate(angle + age * (i % 2 ? 5 : -4));
    ctx.globalAlpha = fade * detail; ctx.fillStyle = '#392f39'; ctx.strokeStyle = i % 3 ? '#ff9f38' : '#ffe3a7'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-size, -size * .6); ctx.lineTo(size * .3, -size); ctx.lineTo(size, -size * .1);
    ctx.lineTo(size * .6, size * .8); ctx.lineTo(-size * .7, size); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffb349'; ctx.globalAlpha *= .5; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(angle) * 18, -Math.sin(angle) * 18); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}
