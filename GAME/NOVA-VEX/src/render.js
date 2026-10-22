import { WIDTH, ACTIONS, CHARACTER_COLORS, BACKGROUNDS, clamp, lerp } from './config.js';
import { NeonGiftFX as GiftFX } from './neon-gifts.js?v=2';
import { text } from './copy.js';
import { WinShow, SHOWS, showFrame, cueShow } from './wins.js?v=2';
import {giftFrame,ease} from './gift-motion.js';
import {sceneViewport} from './viewport.js';

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
    this.giftFX = new GiftFX(this); this.colorCache = new Map(); this.characterColor = 'Cyan';
    this.loaded = this.load(); this.resize();
  }
  async load() {
    const art=window.__NEON_ASCENT_ASSETS;
    const [atlas,rival,board,actions,blast,reactions,vexActions,interactions,rigResponse,metadataResponse,actionResponse,reactionResponse,vexResponse,interactionResponse,...backgrounds]=await Promise.all([
      loadImage(art.atlas),loadImage(art.rival),loadImage(art.board),loadImage(art.actions),loadImage(art.blast),loadImage(art.reactions),loadImage(art.vexActions),loadImage(art.interactions),fetch(art.rig),fetch(art.metadata),fetch(art.actionMetadata),fetch(art.reactionMetadata),fetch(art.vexMetadata),fetch(art.interactionMetadata),...Object.keys(BACKGROUNDS).map(name=>loadImage(art.backgrounds[name]))
    ]);
    if(!rigResponse.ok||!metadataResponse.ok||!actionResponse.ok||!reactionResponse.ok||!vexResponse.ok||!interactionResponse.ok)throw new Error('ART_METADATA_FAILED');
    const [rig,metadata,gifts,reactionData,vexData,interactionData]=await Promise.all([rigResponse.json(),metadataResponse.json(),actionResponse.json(),reactionResponse.json(),vexResponse.json(),interactionResponse.json()]);
    this.atlas=atlas;this.reactionAtlas=reactions;this.interactionAtlas=interactions;this.sprites={...metadata.sprites,...reactionData.sprites,...interactionData.sprites};this.actionAtlas=actions;
    // Vex's gift icon uses the SAME silver-haired character as the heist scene.
    this.actionSprites={...gifts.sprites,vexCarry:interactionData.sprites.rideHold,vexShove:interactionData.sprites.pushTouch,vex:{...rig.portrait,sheet:'rival'},trophy:gifts.sprites.crown,portal:gifts.sprites.reboot};
    this.rivalPoses={...rig.poses,...vexData.poses};this.shipBounds=rig.board;this.props={rival,board,blast,vexActions};
    this.backgrounds=Object.fromEntries(Object.keys(BACKGROUNDS).map((name,index)=>[name,backgrounds[index]]));
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width); this.cssHeight = Math.max(1, rect.height);
    this.ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssWidth * this.ratio); this.canvas.height = Math.round(this.cssHeight * this.ratio);
    if (this.fxCanvas) { this.fxCanvas.width = this.canvas.width; this.fxCanvas.height = this.canvas.height; }
    const view = sceneViewport(this.cssWidth, this.cssHeight);
    this.height = view.height; this.viewWidth = view.viewWidth; this.offsetX = view.offsetX;
    this.scale = this.canvas.width / this.viewWidth;
  }
  sprite(name, x, y, w, h, rotation = 0, alpha = 1, context = this.ctx) {
    const source = this.actionSprites?.[name] || this.sprites?.[name]; if (!source) return;
    context.save(); context.translate(x, y); context.rotate(rotation); context.globalAlpha *= clamp(alpha, 0, 1);
    const colored = this.colorCache.get(this.characterColor)?.[name];
    if (colored) context.drawImage(colored, -w / 2, -h / 2, w, h);
    else context.drawImage(source.sheet==='interaction'?this.interactionAtlas:source.sheet==='rival'?this.props.rival:source.sheet==='vexAction'?this.props.vexActions:source.sheet==='reaction'?this.reactionAtlas:this.actionSprites?.[name]?this.actionAtlas:this.atlas, source.x, source.y, source.w, source.h, -w / 2, -h / 2, w, h);
    context.restore();
  }
  color(name) {
    this.characterColor = name;
    if (name === 'Cyan' || this.colorCache.has(name)) return;
    const variants = {}, tint = CHARACTER_COLORS[name].color;
    const target = [1,3,5].map(at=>parseInt(tint.slice(at,at+2),16));
    for (const pose of ['idle','rise','fall','land','reactStart','reactPull','reactRecover','pushTouch','pushExtend','rideCatch','rideHold']) {
      const s=this.sprites[pose],canvas=document.createElement('canvas'),size=['reaction','interaction'].includes(s.sheet)?Math.min(1,256/s.h):1;
      canvas.width=Math.round(s.w*size);canvas.height=Math.round(s.h*size);
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(s.sheet==='interaction'?this.interactionAtlas:s.sheet==='reaction'?this.reactionAtlas:this.atlas,s.x,s.y,s.w,s.h,0,0,canvas.width,canvas.height);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
      for(let at=0;at<data.length;at+=4){
        const [r,g,b]=data.slice(at,at+3);
        if(s.sheet==='interaction'&&(at/4)%canvas.width>canvas.width*.63)continue;
        // Only dye the cyan clothing; preserve warm skin, face, hair and whites.
        if(data[at+3]<10||b<r*1.18||g<r*1.25||g<70||b<70||Math.max(r,g,b)-Math.min(r,g,b)<28)continue;
        const light=Math.max(r,g,b)/255,shine=Math.min(r,g,b)/255;
        for(let channel=0;channel<3;channel++)data[at+channel]=Math.min(255,target[channel]*light*(1-shine*.5)+255*shine*.4);
      }
      ctx.putImageData(pixels,0,0);variants[pose]=canvas;
    }
    this.colorCache.set(name,variants);
  }
  prop(name, x, y, width, alpha = 1, rotation = 0, ctx = this.ctx) {
    const image = this.props?.[name]; if (!image) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.globalAlpha *= clamp(alpha, 0, 1);
    ctx.drawImage(image, -width / 2, -width * image.height / image.width / 2, width, width * image.height / image.width); ctx.restore();
  }
  icon(canvas,name) {
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    if(name==='finish')name='checkpoint';
    const source=this.actionSprites?.[name]||this.sprites?.[name];if(!source)return;
    if(['vexCarry','vexShove'].includes(name)){
      ctx.save();ctx.scale(canvas.width/100,canvas.height/100);
      const fit=Math.min(94/source.w,78/source.h);
      this.winShow.board(ctx,50,87,94,-.04,0,.1);
      this.sprite(name,50,47,source.w*fit,source.h*fit,0,1,ctx);
      ctx.restore();return;
    }
    const fit=Math.min(canvas.width/source.w,canvas.height/source.h)*.92;
    this.sprite(name,canvas.width/2,canvas.height/2,source.w*fit,source.h*fit,0,1,ctx);
    if(['banana','glove','weight'].includes(name)){
      const radius=canvas.width*.215,cx=radius+1,cy=canvas.height-radius-1;
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fillStyle='#171128';ctx.fill();ctx.strokeStyle='#f290e4';ctx.lineWidth=1.5;ctx.stroke();ctx.clip();
      this.sprite('vex',cx,cy,radius*1.72,radius*1.94,0,1,ctx);ctx.restore();
    }
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
  finishPlatform(ctx,x,y,width,clock){
    const source=this.sprites.finish,height=Math.min(145,width*.64);
    ctx.save();ctx.shadowColor='#48eaff55';ctx.shadowBlur=18;
    ctx.drawImage(this.atlas,source.x,source.y,source.w,source.h,x-width/2,y-height*.57,width,height);
    ctx.shadowBlur=0;ctx.font='800 14px sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#121432';
    const label=text('finishLabel',this.language).toUpperCase();ctx.strokeText(label,x,y+height*.43+24);ctx.fillStyle='#baf9ff';ctx.fillText(label,x,y+height*.43+24);ctx.restore();
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
      const fit = Math.max(this.viewWidth / image.width, h / image.height) * 1.035, w = image.width * fit, ih = image.height * fit;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.drawImage(image, (WIDTH - w) / 2 + Math.sin(this.camera * .0003) * 4, (h - ih) / 2 + Math.sin(this.camera * .00017) * 9, w, ih);
      ctx.restore();
    };
    const mix = clamp((sim.clock - this.backgroundChanged) / .55, 0, 1);
    draw(this.backgroundPrevious); if (this.backgroundPrevious !== key) draw(key, mix);
    if (mix >= 1) this.backgroundPrevious = key;
    const ambient = BACKGROUNDS[key].ambient, count = sim.settings.visualQuality === 'Low' ? 6 : 15;
    ctx.save();
    for (let i = 0; i < count; i++) {
      const p = (sim.clock * (ambient === 'embers' ? .085 : .02) + i * .137) % 1;
      const x = (i * 131.73 + Math.sin(sim.clock * .3 + i) * 15) % this.viewWidth - this.offsetX, y = (1 - p) * h;
      ctx.globalAlpha = (.12 + Math.sin(p * Math.PI) * .35) * sim.settings.effectsIntensity;
      ctx.fillStyle = ambient === 'embers' ? '#ffba63' : ambient === 'fireflies' ? '#e9b1bf' : '#f4fcff';
      ctx.beginPath(); ctx.arc(x, y, ambient === 'mist' ? 2.1 : 1 + i % 3 * .45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  courseEdges(sim) {
    if (this.offsetX < 1) return;
    const ctx = this.ctx, top = 0, bottom = this.height;
    const pixel = this.viewWidth / this.cssWidth;
    ctx.save();
    for (const [x, color] of [[0, '82,221,255'], [WIDTH, '184,134,255']]) {
      const fade = ctx.createLinearGradient(0, top, 0, bottom);
      fade.addColorStop(0, `rgba(${color},.45)`);
      fade.addColorStop(.1, `rgba(${color},1)`);
      fade.addColorStop(.93, `rgba(${color},1)`);
      fade.addColorStop(1, `rgba(${color},.5)`);
      ctx.lineWidth = 3.5 * pixel;
      ctx.strokeStyle = fade; ctx.shadowColor = `rgb(${color})`;
      ctx.shadowBlur = sim.settings.visualQuality === 'Low' ? 0 : 16;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      const core = ctx.createLinearGradient(0, top, 0, bottom);
      core.addColorStop(0, '#eafbff55'); core.addColorStop(.1, '#eafbffdd');
      core.addColorStop(.93, '#eafbffdd'); core.addColorStop(1, '#eafbff66');
      ctx.lineWidth = pixel; ctx.shadowBlur = 0; ctx.strokeStyle = core; ctx.stroke();
    }
    ctx.restore();
  }
  playerSprites(sim, x, y) {
    const ctx = this.ctx;
    // Portrait's wrap copies used to be hidden by the canvas edges. In a wide
    // viewport they would appear as a second full Nova outside the course.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, WIDTH, this.height); ctx.clip();
    this.character(sim, x, y);
    if (this.offsetX < 1) {
      if (x < 40) this.character(sim, x + WIDTH, y);
      if (x > WIDTH - 40) this.character(sim, x - WIDTH, y);
    }
    ctx.restore();
  }
  platforms(sim) {
    const ctx=this.ctx;
    for(const p of [...sim.world.cache.values()].sort((a,b)=>a.y-b.y)){
      const sy=this.screenY(p.y),x=sim.world.x(p,sim.clock);
      if(sy < -140 || sy > this.height+100)continue;
      if(p.type==='finish'){this.finishPlatform(ctx,x,sy,p.w,sim.clock);continue;}
      const unavailable=!sim.world.available(p,sim.clock),cycle=(sim.clock+p.phase)%6.4;
      const sprite=p.type==='spring'?'spring':p.type==='crumble'||p.type==='vanish'?'ice':'grass';
      const source=this.sprites[sprite],width=p.w+8,height=Math.min(66,width*source.h/source.w);
      ctx.save();ctx.globalAlpha=unavailable?.08:p.type==='vanish'&&cycle>4.3?.45+Math.sin(sim.clock*18)*.3:1;
      ctx.drawImage(this.atlas,source.x,source.y,source.w,source.h,x-width/2,sy-height*.10,width,height);
      ctx.shadowColor=p.type==='spring'?'#c06cff':p.type==='crumble'?'#ff62d6':'#3de5ff';ctx.shadowBlur=sim.settings.visualQuality==='Low'?0:7;
      ctx.strokeStyle=p.type==='spring'?'#e5bcff':p.type==='crumble'?'#ffb9ef':'#b7f8ff';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(x-p.w*.39,sy-1);ctx.lineTo(x+p.w*.39,sy-1);ctx.stroke();ctx.shadowBlur=0;
      if(p.type==='moving'){
        ctx.fillStyle='#e8fdff';ctx.font='700 11px sans-serif';ctx.textAlign='center';ctx.fillText('↔',x,sy+13);
      }
      if(p.type==='crumble'){
        ctx.strokeStyle='#d22eaa';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-8,sy+2);ctx.lineTo(x-3,sy+9);ctx.lineTo(x-6,sy+15);ctx.stroke();
      }
      ctx.restore();
      if(sim.world.hasGift(p)){
        const gift=ACTIONS[p.gift],float=Math.sin(sim.clock*3+p.phase)*3,gy=sy-27+float;
        ctx.save();ctx.globalAlpha=unavailable?.2:1;ctx.shadowColor=gift.color;ctx.shadowBlur=sim.settings.visualQuality==='Low'?0:14;
        ctx.fillStyle='#10152b';ctx.strokeStyle=gift.color;ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(x,gy,17,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
        this.sprite(gift.sprite,x,gy,23,23);ctx.restore();
      }
      if(sy>180&&!p.branch&&(p.level%10===0||p.level===0)){
        ctx.save();ctx.font='600 10px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#10152bd9';ctx.strokeText(p.level+' m',x,sy+height+11);ctx.fillStyle='#d7f5ff';ctx.fillText(p.level+' m',x,sy+height+11);ctx.restore();
      }
    }
  }
  effects(sim,x,y) {
    this.giftFX.objects(this.ctx,sim,x,y);
    if (this.moment) {
      const elapsed = sim.clock - this.moment.clock;
      if (elapsed > 1.3) this.moment = null;
      else if (this.moment.kind === 'portal') this.sprite('portal', x, y - 33, 135, 135, Math.sin(sim.clock*3)*.04, Math.sin(elapsed / 1.3 * Math.PI) * 0.8);
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
      this.sprite('portal', x, y - 33, 165 + Math.sin(t * Math.PI) * 40, 165 + Math.sin(t * Math.PI) * 40, Math.sin(sim.clock*3)*.04, Math.sin(t * Math.PI) * .85);
    }
  }
  character(sim, x, y) {
    const ctx = this.ctx, p = sim.player;
    let pose = p.squash > 0.5 ? 'land' : p.vy < -80 || sim.active?.delta < 0 ? 'fall' : p.vy > 80 || sim.active ? 'rise' : 'idle';
    const scene = this.scoreMoment ? showFrame(this.scoreMoment, sim.clock) : null;
    if (scene) pose = scene.pose || (scene.squash > .15 ? 'land' : this.scoreMoment.kind === 'gain' && scene.t >= .32 && scene.t < .76 ? 'fall' : 'idle');
    const gift=scene?null:this.giftFX.hero(sim);
    if(gift?.pose)pose=gift.pose;
    const source = this.sprites[pose], stretch = scene||gift?.stableBody ? 0 : clamp(p.vy / 1320, -.5, 1) * .065;
    const squash = scene ? scene.squash : gift?.stableBody?0:p.squash * .19;
    const h = 88 * (1 + stretch - squash), w = 88 * source.w / source.h * (1 - stretch * .45 + squash * .70);
    const hitSide=scene&&this.scoreMoment.kind==='theft'?(x>WIDTH/2?-1:1):1;
    ctx.save(); ctx.translate(x+(gift?.x||0)+(scene?.offsetX||0)*hitSide, y - h / 2 + (scene?.recoil || 0)+(gift?.y||0)+(gift?h/2*(1-gift.sy):0)); ctx.rotate((scene?.tilt || 0)*hitSide+(gift?.rotation||0) + p.vx / 420 * 0.045 * (scene ? 0 : 1));
    if(gift){ctx.scale(gift.sx,gift.sy);ctx.globalAlpha*=gift.alpha;}
    // Ordinary movement follows the last direction of travel. Authored gift
    // scenes keep their own orientation so Vex's contact poses stay aligned.
    const facing=scene?(scene.reaction?hitSide:1):(gift?.flip??p.facing);
    if(facing<0)ctx.scale(-1,1);
    if (false) {
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
    if (this.scoreMoment && this.scoreMoment.cinematicVersion !== 4) {
      const job = this.scoreMoment, progress = clamp((sim.clock - job.clock) / job.duration, 0, 1);
      job.duration = SHOWS[job.kind].duration; job.clock = sim.clock - progress * job.duration; job.cinematicVersion = 4;
      if (job.cued) { job.scoreApplied = true; job.cueFlags = Object.fromEntries(SHOWS[job.kind].cues.filter(([at]) => at <= SHOWS[job.kind].settle).map(([, kind]) => [kind, true])); }
      if(job.kind==='theft'){
        job.cueFlags||={};
        for(const [at,kind]of SHOWS.theft.cues)if(at<=progress)job.cueFlags[kind]=true;
        if(progress>=SHOWS.theft.settle&&!job.scoreApplied){job.scoreApplied=true;settle(job.appliedDelta??job.delta);}
      }
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
      this.scoreMoment = { ...job, clock: sim.clock, cinematicVersion: 4, duration: this.scoreJobs.length > 8 ? SHOWS[job.kind].busyDuration : SHOWS[job.kind].duration, cueFlags: {}, scoreApplied: false };
      sim.cinematicUntil = sim.clock + this.scoreMoment.duration;
      sim.releaseInput();
      this.pendingVisualUnits -= job.contributions.reduce((n, c) => n + c.amount, 0);
      try { this.onScoreStart?.(this.scoreMoment); }
      catch { this.scoreMoment.presentationErrors = (this.scoreMoment.presentationErrors || 0) + 1; }
    }
    if (!this.scoreMoment && !this.scoreJobs.length) this.presentedWins = sim.wins;
  }
  scoreTarget() {
    const stage = this.canvas.getBoundingClientRect(), badge = this.hudTrophy.getBoundingClientRect(), factor = this.viewWidth / this.cssWidth;
    return { x: (badge.left - stage.left + badge.width / 2) * factor - this.offsetX, y: (badge.top - stage.top + badge.height / 2) * factor };
  }
  scoreFX(sim, hero, target) {
    const ctx = this.fx;
    if (!ctx || !this.hudTrophy || !this.scoreBadge) return;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX * this.scale, 0);
    ctx.clearRect(-this.offsetX, 0, this.viewWidth, this.height);
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
    const ctx = this.ctx; ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX * this.scale, 0);
    this.color(sim.settings.characterColor);
    this.advanceScore(sim);
    if(sim.active){
      const f=giftFrame(sim.active),margin=ease(f.time/Math.max(.1,f.contact*.7))*(1-f.exit);
      x=lerp(x,clamp(x,110,370),margin);
    }
    if (this.scoreMoment) {
      const t = showFrame(this.scoreMoment, sim.clock).t;
      const frame = Math.min(clamp(t / .15, 0, 1), clamp((1 - t) / .10, 0, 1));
      x = lerp(x, clamp(x, 67, WIDTH - 67), frame * frame * (3 - 2 * frame));
    }
    ctx.save(); const shake = this.giftFX.shake(sim); ctx.translate(shake, shake * .55);
    this.background(sim); this.courseEdges(sim); this.platforms(sim); ctx.restore();
    const sy = this.screenY(y);
    const hero = { x, y: sy }, target = this.scoreTarget();
    this.winShow.behind(ctx, sim, this.scoreMoment, hero, target);
    this.giftFX.behind(ctx, sim, x, sy);
    this.effects(sim, x, sy); this.playerSprites(sim, x, sy);
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
    return { x: (x + this.offsetX) / this.viewWidth * this.cssWidth, y: sy / this.viewWidth * this.cssWidth };
  }
}
