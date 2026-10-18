export const STEP = 1 / 120;
export const WIDTH = 480;
export const GRAVITY = 2100;
export const JUMP_SPEED = 1320;
export const MOVE_SPEED = 420;
export const MIN_DISTANCE = -1000000;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const CHARACTER_COLORS = Object.freeze({ Cyan: { hue: 0, color: "#b92b48" }, Mint: { hue: 0, color: "#e8e1e0", filter: "saturate(.12) brightness(1.12)" }, Violet: { hue: 0, color: "#55515e", filter: "saturate(.25) brightness(.66) contrast(1.15)" }, Rose: { hue: -8, color: "#d52e4a", filter: "hue-rotate(-8deg) saturate(1.18)" }, Amber: { hue: -22, color: "#c9798c", filter: "hue-rotate(-22deg) saturate(.65) brightness(1.08)" }, Red: { hue: 0, color: "#bcbcc6", filter: "saturate(0) brightness(1.02)" } });
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
  windMeters: 50, vortexMeters: 150, balloonMeters: 5, anvilMeters: 5, meteorMeters: 300,
  characterColor: 'Cyan', backgroundTheme: 'Auto',
  worldSeed: 'SkyShift-1', soundEnabled: true, musicEnabled: true,
  soundVolume: 0.55, musicVolume: 0.18, showContributors: true,
  effectsIntensity: 0.8, visualQuality: 'Balanced'
});
export const ACTIONS = Object.freeze({
  balloon: { setting: 'balloonMeters', sign: 1, sprite: 'balloon', color: '#d37891' },
  anvil: { setting: 'anvilMeters', sign: -1, sprite: 'anvil', color: '#c9b1b8' },
  meteor: { setting: 'meteorMeters', sign: -1, sprite: 'meteor', color: '#ff9c35' },
  magnet: { setting: 'magnetMeters', sign: 1, sprite: 'magnet', color: '#d55a7c' },
  cloud: { setting: 'cloudMeters', sign: 1, sprite: 'cloud', color: '#ede2e8' },
  rocket: { setting: 'rocketMeters', sign: 1, sprite: 'rocket', color: '#e1a4b6' },
  wind: { setting: 'windMeters', sign: -1, sprite: 'tornado', color: '#c9bac7' },
  vortex: { setting: 'vortexMeters', sign: -1, sprite: 'vortex', color: '#c97090' },
  reset: { sprite: 'portal', color: '#e4c3d2' },
  winAdd: { sprite: 'trophy', color: '#ffdf88' },
  winRemove: { sprite: 'alien', color: '#dca8b8' }
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
