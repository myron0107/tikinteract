import { WIDTH, CHARACTER_COLORS, clamp, lerp } from './config.js';
import { distance, winLabel } from './copy.js';

const TAU = Math.PI * 2;
export const SHOWS = Object.freeze({
  gain: { duration: 4.4, busyDuration: 3.4, settle: .82, cues: [[.025, 'trophyDescent'], [.34, 'trophyCatch'], [.49, 'championLift'], [.70, 'trophyFlight'], [.82, 'trophyGain']] },
  // Legacy cue IDs keep saved scenes/audio compatible; this is a board drive-by.
  theft: { duration: 3.5, busyDuration: 2.9, settle: .50, cues: [[.015, 'alienArrival'], [.23, 'alienHatch'], [.43, 'vexGrab'], [.50, 'vexHairPull'], [.50, 'trophyTheft'], [.64, 'vexRelease'], [.74, 'alienExit']] }
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
    t,phase:t<.23?'arrival':t<.32?'brake':t<.43?'reach':t<.50?'grip':t<.64?'tug':t<.74?'release':'departure',
    reaction:t>=.42&&t<.83,
    pose:t<.42?'idle':t<.50?'reactStart':t<.64?'reactPull':t<.83?'reactRecover':'idle',
    squash:track(t,[[0,0],[.49,0],[.54,-.035],[.60,-.02],[.68,.035],[.78,0]]),
    tilt:track(t,[[0,0],[.42,0],[.455,-.07],[.49,-.02],[.54,.27],[.60,.20],[.68,-.10],[.80,0]]),
    offsetX:track(t,[[0,0],[.42,0],[.455,-3],[.49,0],[.54,16],[.60,12],[.68,-6],[.80,0]]),
    recoil:track(t,[[0,0],[.42,0],[.455,-2],[.49,0],[.54,-7],[.60,-4],[.68,2],[.80,0]])
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
  board(ctx, x, y, size, angle, clock, thrust = 1) {
    const p = this.r.shipBounds; if (!p) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    glow(ctx, 0, size * .21, size * .39, '#43dfff55', thrust * .55);
    for (const dx of [-.30, 0, .30]) {
      const length = size * (.10 + thrust * .14) * (1 + Math.sin(clock * 32 + dx * 8) * .08);
      const g = ctx.createLinearGradient(0, size * .19, 0, size * .19 + length);
      g.addColorStop(0, '#d9faffbb'); g.addColorStop(.32, '#41ddff77'); g.addColorStop(1, '#319aff00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(size * dx - size * .047, size * .19); ctx.quadraticCurveTo(size * dx - size * .018, size * .19 + length, size * dx, size * .19 + length); ctx.quadraticCurveTo(size * dx + size * .018, size * .19 + length, size * dx + size * .047, size * .19); ctx.closePath(); ctx.fill();
    }
    const h = size * p.h / p.w;
    ctx.drawImage(this.r.props.board, p.x, p.y, p.w, p.h, -size / 2, -h / 2, size, h);
    ctx.restore();
  }
  rival(ctx,x,feetY,height,pose='idle',tilt=0,face=1,clench=0){
    const source=this.r.rivalPoses[pose],width=height*source.w/source.h;
    const image=source.sheet==='vexAction'?this.r.props.vexActions:this.r.props.rival;
    ctx.save();ctx.translate(x,feetY);ctx.rotate(tilt);ctx.scale(face*(source.mirror?-1:1),1);
    if(pose==='grab'){
      // Articulate the authored open hand using a clenched-hand crop from the
      // same character sheet. The raised arm, wrist and skin stay consistent.
      ctx.save();ctx.beginPath();ctx.rect(-width/2,-height,width,height);
      ctx.rect(-width/2,-height,width*.47,height*.22);ctx.clip('evenodd');
      ctx.drawImage(this.r.props.rival,source.x,source.y,source.w,source.h,-width/2,-height,width,height);ctx.restore();
      ctx.save();ctx.globalAlpha*=1-clench;
      ctx.drawImage(this.r.props.rival,source.x,source.y,source.w*.47,source.h*.22,-width/2,-height,width*.47,height*.22);ctx.restore();
      const fist=this.r.rivalPoses.shove;
      ctx.save();ctx.globalAlpha*=clench;ctx.translate(-width*.285,-height*.88);ctx.rotate(-.18);
      ctx.drawImage(this.r.props.rival,fist.x+fist.w*.13,fist.y+fist.h*.19,fist.w*.29,fist.h*.15,-9,-8.5,18,17);ctx.restore();
    }else ctx.drawImage(image,source.x,source.y,source.w,source.h,-width/2,-height,width,height);
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
    const left = -(this.r.offsetX || 0), right = WIDTH + (this.r.offsetX || 0);
    const x = clamp(target.x, left + margin, right - margin), y = target.y + 62 - age * 24;
    ctx.strokeText(label, x, y); ctx.fillStyle = job.kind === 'gain' ? '#ffe681' : '#ffa4b8'; ctx.fillText(label, x, y); ctx.restore();
  }
  behind(ctx, sim, job, hero, target) {
    if (!job) return;
    const { t } = showFrame(job, sim.clock), intensity = sim.settings.effectsIntensity;
    const envelope = Math.min(1, t / .12, (1 - t) / .14);
    ctx.save(); ctx.globalAlpha = envelope;
    ctx.fillStyle = job.kind === 'theft' ? '#0a172a12' : '#21142833'; ctx.fillRect(-(this.r.offsetX || 0), 0, this.r.viewWidth || WIDTH, this.r.height);
    if (job.kind === 'gain') {
      glow(ctx, hero.x, hero.y - 70, 170, '#ffdb6044', intensity);
      const count = sim.settings.visualQuality === 'Low' ? 5 : 11;
      ctx.save(); ctx.translate(hero.x, hero.y - 73); ctx.rotate(sim.clock * .14); ctx.globalAlpha = .13 * intensity;
      for (let i = 0; i < count; i++) { ctx.rotate(TAU / count); const g = ctx.createLinearGradient(0, 0, 0, -240); g.addColorStop(0, '#fff7ad'); g.addColorStop(1, '#ffd34100'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-29, -240); ctx.lineTo(29, -240); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill(); } ctx.restore();
      ring(ctx, hero.x, hero.y + 4, 50 + Math.sin(t * Math.PI) * 28, '#ffdf77', .7 * intensity, 2);
    } else glow(ctx, hero.x + 30, hero.y - 65, 135, '#a151ff44', intensity * .7);
    ctx.restore();
  }
  front(ctx, sim, job, hero, target) {
    if (!job) return;
    const f = showFrame(job, sim.clock); job.phase = f.phase;
    if (job.kind === 'gain') this.gain(ctx, sim, job, hero, target, f);
    else this.theft(ctx, sim, job, hero, target, f);
    // Gift amounts already appear beside the gift; no duplicate label above.
    if(!job.contributions?.length)this.award(ctx, job, target, f.t, this.r.language);
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
    const side=hero.x>WIDTH/2?-1:1;
    const arrival=out(segment(t,0,.23)),brake=segment(t,.18,.32);
    const leave=segment(t,.74,1),acceleration=leave*leave;
    const edge=this.r.offsetX||0,startX=side>0?WIDTH+edge+105:-edge-105,stopX=hero.x+side*61;
    const skid=-side*Math.sin(brake*Math.PI)*12;
    const bx=lerp(lerp(startX,stopX,arrival)+skid,side>0?WIDTH+edge+145:-edge-145,acceleration);
    const by=hero.y+7-(1-arrival)*18-Math.sin(arrival*Math.PI)*12-acceleration*82;
    const reach=ease(t,.32,.43)*(1-ease(t,.64,.72));
    const grip=ease(t,.42,.45)*(1-ease(t,.62,.68));
    const pull=track(t,[[0,0],[.49,0],[.54,1],[.60,.7],[.64,0]]);
    const bank=side*((1-arrival)*-.15+Math.sin(brake*Math.PI)*.18-leave*.18);
    const alpha=Math.min(1,t/.035,(1-t)/.035),intensity=sim.settings.effectsIntensity;
    ctx.save();ctx.globalAlpha*=alpha;
    // Sideways wake and a brake skid replace the old overhead arrival/beam.
    if((t<.28||t>.74)&&intensity>0){
      const wakeSide=t>.74?-side:side;
      const speed=t>.74?leave:1-arrival;
      ctx.lineCap='round';
      for(let i=0;i<4;i++){
        ctx.globalAlpha=alpha*intensity*(.18+speed*.45)*(1-i*.16);
        ctx.strokeStyle=i%2?'#e6a2ff':'#8af6ff';ctx.lineWidth=i%2?1.5:2.5;
        ctx.beginPath();ctx.moveTo(bx+wakeSide*35,by+2+i*5);
        ctx.lineTo(bx+wakeSide*(65+speed*80+i*13),by+2+i*5);ctx.stroke();
      }
      ctx.globalAlpha=alpha;
    }
    if(t>.20&&t<.35&&intensity>0){
      const amount=Math.sin(segment(t,.20,.35)*Math.PI)*intensity;
      for(let i=0;i<7;i++){
        const phase=(sim.clock*3+i*.17)%1;
        const sx=bx+side*(40+phase*36),sy=by+8+phase*(8+i*2);
        ctx.strokeStyle=i%2?'#ffd87c':'#c2fcff';ctx.lineWidth=1.8;ctx.globalAlpha=amount*(1-phase);
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+side*(5+phase*7),sy+2);ctx.stroke();
      }
      ctx.globalAlpha=alpha;
    }
    this.board(ctx,bx,by,105,bank,sim.clock,t>.74?1+leave*2:.75);
    const riderX=bx-side*(reach*25-pull*14),riderFeet=by-5-Math.sin(brake*Math.PI)*2;
    const lean=-side*(reach*.14-pull*.06+(1-arrival)*.12-leave*.12);
    if(grip>.01){
      // Hair stays attached to the scalp and follows the actual rotated hand.
      const f=showFrame(job,sim.clock),height=88*(1-f.squash),angle=f.tilt*side,localX=side*9,localY=-height*.4;
      const hx=hero.x+f.offsetX*side+Math.cos(angle)*localX-Math.sin(angle)*localY;
      const hy=hero.y-height/2+f.recoil+Math.sin(angle)*localX+Math.cos(angle)*localY;
      const width=96*this.r.rivalPoses.grab.w/this.r.rivalPoses.grab.h;
      const handX=riderX+Math.cos(lean)*(-width*.285*side)-Math.sin(lean)*(-96*.88);
      const handY=riderFeet+Math.sin(lean)*(-width*.285*side)+Math.cos(lean)*(-96*.88);
      ctx.save();ctx.globalAlpha*=grip;ctx.lineCap='round';
      for(let i=0;i<3;i++){
        ctx.strokeStyle=i===1?'#75424b':'#382333';ctx.lineWidth=i===1?1.1:3.1;
        ctx.beginPath();ctx.moveTo(hx,hy+i*.8);
        ctx.quadraticCurveTo((hx+handX)/2,Math.min(hy,handY)-3-(1-pull)*4+i,handX,handY+i*.7);ctx.stroke();
      }
      ctx.restore();
    }
    this.rival(ctx,riderX,riderFeet,96,reach>.24?'grab':'idle',lean,side,grip);
    ctx.restore();
  }
}
