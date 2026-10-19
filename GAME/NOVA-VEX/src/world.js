import { WIDTH, clamp, lerp } from './config.js';

const PICKUP_GIFTS = ['balloon', 'magnet', 'cloud', 'rocket'];
const PICKUP_CHANCE = .14;

function seedHash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function hash(n, seed) {
  let h = Math.imul((n | 0) ^ seed, 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Original course phrases: each spans 960px over eight ledges. More frequent
// forks offer two independent landing routes without a regular column grid.
const CHUNK_HEIGHT = 960;
const COURSES = [
  { gaps: [96, 112, 124, 104, 144, 116, 128, 136], x: [240, 328, 172, 382, 112, 280, 70, 355] },
  { gaps: [130, 94, 144, 108, 156, 84, 124, 120], x: [88, 282, 406, 182, 62, 242, 382, 138] },
  { gaps: [104, 128, 192, 84, 104, 152, 96, 100], x: [286, 94, 358, 190, 416, 146, 312, 72] },
  { gaps: [116, 156, 88, 140, 116, 164, 80, 100], x: [84, 224, 376, 132, 306, 410, 184, 72] }
];
export class World {
  constructor(seed = 'NeonAscent-1', finish = 10000) {
    this.seed = seedHash(seed); this.phase = (this.seed % 6283) / 1000;
    this.finish = finish; this.cache = new Map(); this.unavailable = new Map(); this.collectedGifts = new Set();
  }
  course(chunk) {
    return COURSES[chunk === 0 ? 0 : 1 + Math.floor(hash(chunk, this.seed ^ 741) * 3)];
  }
  height(level) {
    const chunk = Math.floor(level / 8), slot = level - chunk * 8;
    return chunk * CHUNK_HEIGHT + this.course(chunk).gaps.slice(0, slot).reduce((sum, gap) => sum + gap, 0);
  }
  heightAt(distance) {
    const level = Math.floor(distance);
    return lerp(this.height(level), this.height(level + 1), distance - level);
  }
  levelAt(height) {
    const chunk = Math.floor(height / CHUNK_HEIGHT), gaps = this.course(chunk).gaps;
    let y = chunk * CHUNK_HEIGHT, level = chunk * 8;
    for (const gap of gaps) { if (height < y + gap - 1e-7) break; y += gap; level++; }
    return level;
  }
  distanceAt(height) {
    const level = this.levelAt(height);
    return level + (height - this.height(level)) / (this.height(level + 1) - this.height(level));
  }
  platform(level) {
    if (this.cache.has(level)) return this.cache.get(level);
    const chunk = Math.floor(level / 8), slot = level - chunk * 8, r = hash(level, this.seed ^ 9337);
    let type = Math.abs(level) < 6 ? 'normal' : r < .08 ? 'spring' : r < .23 ? 'crumble' : r < .34 && ((level % 4) + 4) % 4 === 2 ? 'vanish' : r < .5 ? 'moving' : 'normal';
    if (level === this.finish) type = 'finish';
    const difficulty = clamp(Math.abs(level) / 160, 0, 1);
    const w = type === 'finish' ? 224 : level === 0 ? 140 : 102 - difficulty * 34 + (hash(level, this.seed ^ 197) - .5) * 16;
    const mirrored = chunk !== 0 && hash(chunk, this.seed ^ 649) > .5;
    const lane = this.course(chunk).x[slot];
    const x = level === 0 || type === 'finish' ? WIDTH / 2 : clamp((mirrored ? WIDTH - lane : lane) + (hash(level, this.seed ^ 341) - .5) * 22, w / 2 + 12, WIDTH - w / 2 - 12);
    const giftRoll = hash(level, this.seed ^ 6721);
    const gift = type !== 'finish' && type !== 'crumble' && type !== 'vanish' && giftRoll < PICKUP_CHANCE
      ? PICKUP_GIFTS[Math.floor(hash(level, this.seed ^ 1987) * PICKUP_GIFTS.length)]
      : null;
    const p = Object.freeze({ id: 'p' + level, level, x, y: this.height(level), w, type, gift, phase: hash(level, this.seed ^ 425) * Math.PI * 2, movingRange: 25 + hash(level, this.seed ^ 798) * 21 });
    this.cache.set(level, p); return p;
  }
  branch(level) {
    if (Math.abs(level) < 2 || level === this.finish || ((level % 2) + 2) % 2 !== 0 || hash(level, this.seed ^ 522) > .92) return;
    const id = 'b' + level; if (this.cache.has(id)) return;
    const primary = this.platform(level), w = 66 + hash(level, this.seed ^ 216) * 18;
    const x = Math.abs(primary.x - WIDTH / 2) < 74 ? (primary.x < WIDTH / 2 ? 395 : 85) : WIDTH - primary.x;
    this.cache.set(id, Object.freeze({ ...primary, id, branch: true, x: clamp(x, w / 2 + 12, WIDTH - w / 2 - 12), w, type: hash(level, this.seed ^ 872) < .55 ? 'normal' : 'crumble', gift: null }));
  }
  collectGift(platform) {
    if (!platform.gift || this.collectedGifts.has(platform.id)) return null;
    this.collectedGifts.add(platform.id);
    return platform.gift;
  }
  hasGift(platform) {
    return Boolean(platform.gift && !this.collectedGifts.has(platform.id));
  }
  x(p, clock) {
    return clamp(p.x + (p.type === 'moving' ? Math.sin(clock * 1.35 + p.phase) * p.movingRange : 0), p.w / 2 + 8, WIDTH - p.w / 2 - 8);
  }
  available(p, clock) {
    return (this.unavailable.get(p.id) || 0) <= clock && (p.type !== 'vanish' || ((clock + p.phase) % 6.4) < 4.9);
  }
  touch(p, clock) {
    if (p.type === 'crumble' || p.type === 'vanish') this.unavailable.set(p.id, clock + (p.type === 'crumble' ? 2.5 : 3.5));
  }
  stream(height, clock, below = 18, above = 24) {
    const level = this.levelAt(height), lo = level - below, hi = Math.min(this.finish, level + above);
    for (let n = lo; n <= hi; n++) { this.platform(n); this.branch(n); }
    for (const [key, p] of this.cache) if (p.level < lo || p.level > hi) this.cache.delete(key);
    for (const [key, until] of this.unavailable) if (until <= clock) this.unavailable.delete(key);
    return this.cache;
  }
  biome(distance) {
    if (distance < -1000) return 'abyss';
    if (distance < -400) return 'crystal';
    if (distance < -80) return 'lava';
    if (distance < 80) return 'earth';
    if (distance < 300) return 'grass';
    if (distance < 800) return 'clouds';
    if (distance < 1600) return 'space';
    return 'cosmos';
  }
}
