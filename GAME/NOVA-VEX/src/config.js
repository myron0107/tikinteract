import {NEON_GIFTS} from './gift-definitions.js';
export const STEP = 1 / 120;
export const WIDTH = 480;
export const GRAVITY = 2100;
export const JUMP_SPEED = 1320;
export const MOVE_SPEED = 420;
export const MIN_DISTANCE = -1000000;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const CHARACTER_COLORS = Object.freeze({ Cyan: { hue:0,color:"#3de5ff" }, Mint: { hue:0,color:"#67f0ae" }, Violet: { hue:0,color:"#a78bfa" }, Rose: { hue:0,color:"#ff64b5" }, Amber: { hue:0,color:"#ffd166" }, Red: { hue:0,color:"#f6f7ff" } });
export const BACKGROUNDS = Object.freeze({
  earth: { color: '#a77c52', ambient: 'dust' }, grass: { color: '#50bb63', ambient: 'fireflies' },
  clouds: { color: '#8bcfe9', ambient: 'mist' }, space: { color: '#132d60', ambient: 'stars' },
  cosmos: { color: '#433d84', ambient: 'stars' }, lava: { color: '#6d271d', ambient: 'embers' },
  crystal: { color: '#14637d', ambient: 'crystals' }, abyss: { color: '#143d3e', ambient: 'fireflies' }
});
export const METEOR = Object.freeze({ launchAt: .22, impactAt: .86, hitStop: .18 });
export const DEFAULTS = Object.freeze({
  finishDistance: 10000, winCountdown: 10, autoplay: false,
  magnetMeters: 50, cloudMeters: 150, rocketMeters: 300,
  windMeters: 50, vortexMeters: 300, balloonMeters: 5, anvilMeters: 5, meteorMeters: 150,
  characterColor: 'Cyan', backgroundTheme: 'Auto',
  worldSeed: 'NeonAscent-1', soundEnabled: true, musicEnabled: true,
  soundVolume: 0.55, musicVolume: 0.18, showContributors: true,
  effectsIntensity: 0.8, visualQuality: 'Balanced'
});
export const ACTIONS = Object.freeze({
  balloon: { setting: 'balloonMeters', sign: 1, ...NEON_GIFTS.balloon },
  anvil: { setting: 'anvilMeters', sign: -1, ...NEON_GIFTS.anvil },
  meteor: { setting: 'meteorMeters', sign: -1, ...NEON_GIFTS.meteor },
  magnet: { setting: 'magnetMeters', sign: 1, ...NEON_GIFTS.magnet },
  cloud: { setting: 'cloudMeters', sign: 1, ...NEON_GIFTS.cloud },
  rocket: { setting: 'rocketMeters', sign: 1, ...NEON_GIFTS.rocket },
  wind: { setting: 'windMeters', sign: -1, ...NEON_GIFTS.wind },
  vortex: { setting: 'vortexMeters', sign: -1, ...NEON_GIFTS.vortex },
  reset: {...NEON_GIFTS.reset},
  winAdd: {...NEON_GIFTS.winAdd},
  winRemove: {...NEON_GIFTS.winRemove}
});
const numbers = {
  finishDistance: [10, 1000000, true], winCountdown: [1, 120],
  magnetMeters: [1, 1000000, true], cloudMeters: [1, 1000000, true],
  rocketMeters: [1, 1000000, true], windMeters: [1, 1000000, true],
  vortexMeters: [1, 1000000, true], balloonMeters: [1, 1000000, true], anvilMeters: [1, 1000000, true], meteorMeters: [1, 1000000, true],
  soundVolume: [0, 1], musicVolume: [0, 1], effectsIntensity: [0, 1]
};
export function settings(value = {}, previous = DEFAULTS) {
  const next = { ...previous };
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    const v = value?.[key];
    if (numbers[key] && typeof v === 'number' && Number.isFinite(v)) {
      const [lo, hi, integer] = numbers[key];
      next[key] = clamp(integer ? Math.round(v) : v, lo, hi);
    } else if (typeof fallback === 'boolean' && typeof v === 'boolean') next[key] = v;
    else if (key === 'worldSeed' && typeof v === 'string') next[key] = v.slice(0, 100) || DEFAULTS.worldSeed;
    else if (key === 'visualQuality' && ['High', 'Balanced', 'Low'].includes(v)) next[key] = v;
    else if (key === 'characterColor' && Object.hasOwn(CHARACTER_COLORS, v)) next[key] = v;
    else if (key === 'backgroundTheme' && (v === 'Auto' || Object.hasOwn(BACKGROUNDS, v))) next[key] = v;
  }
  return Object.freeze(next);
}
export function actor(value) {
  return Object.freeze({
    username: String(value?.username || value?.displayName || 'Creator').replace(/^@/, '').slice(0, 60),
    displayName: String(value?.displayName || value?.username || 'Creator').slice(0, 60)
  });
}
