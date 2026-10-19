import { STEP, ACTIONS, CHARACTER_COLORS, clamp } from './config.js';
import { Simulation } from './simulation.js';
import { Renderer } from './render.js';
import { GameAudio } from './audio.js';
import { LANGUAGES, text, distance, quantity, winLabel } from './copy.js';
import { capture, restore, openRecovery, Checkpoints } from './recovery.js';
import {connectStudioGame} from './studio-integration.js';

const $ = id => document.getElementById(id), sdk = null;
const embedded = false;
const params = new URLSearchParams(location.search);
const qa = ['localhost', '127.0.0.1'].includes(location.hostname) && params.has('qa');
document.body.classList.toggle('embedded', window.parent!==window);
let language = LANGUAGES.includes(params.get('lang')) ? params.get('lang') : 'ro';
let renderer = null, loaded = false, initialized = !embedded, manualClock = qa, disposed = false;
let frameId, last = 0, accumulator = 0, reportAt = 0, noticeUntil = 0, dirty = true;
let recovery = null, recoveryScope = null, recovering = null, initSequence = 0;
let assetsReady;
const assetsGate = new Promise(resolve => { assetsReady = resolve; });
const pending = [], cards = [], keys = new Set(), touches = new Set(), pointers = { left: new Set(), right: new Set() };
const audio = new GameAudio();
const sim = new Simulation({}, event);
if (embedded) audio.route({ enabled: false, volume: 0 });

function releaseInput() {
  keys.clear(); touches.clear(); pointers.left.clear(); pointers.right.clear(); sim.releaseInput();
}
function input() {
  sim.input.left = keys.has('KeyA') || keys.has('ArrowLeft') || pointers.left.size > 0;
  sim.input.right = keys.has('KeyD') || keys.has('ArrowRight') || pointers.right.size > 0;
}
function label(job) {
  const key = job.action || job.kind;
  if (ACTIONS[key]?.setting) return (job.delta > 0 ? '+' : '−') + distance(Math.abs(job.delta), language) + ' m';
  if (key === 'winAdd' || key === 'winRemove') { const amount = Math.max(1, Math.round(job.amount)); return (key === 'winAdd' ? '+' : '−') + distance(amount, language) + ' ' + winLabel(amount, language); }
  return text(key, language);
}
function refreshCard(c) {
  const key = c.job.action || c.job.kind;
  c.element.classList.toggle('negative', ACTIONS[key]?.sign < 0 || key === 'winRemove');
  c.caption.textContent = label(c.job);
  const count = quantity(c.job.gift?.repeatCount || c.job.amount);
  c.multiplier.textContent = 'x' + count;
  const length = c.caption.textContent.length + Math.max(0, count.length - 2);
  c.caption.style.fontSize = Math.max(16, Math.min(29, $('stage').clientWidth * .075) - Math.max(0, length - 9)) + 'px';
  c.element.setAttribute('aria-label', '@' + c.job.actor.username + ' · ' + text(key, language) + ' · ' + c.caption.textContent + ' · ' + c.multiplier.textContent);
}
function card(job, phase = 'receipt') {
  if (!sim.settings.showContributors || !job.actor) return;
  const key = job.action || job.kind;
  let old = cards.find(c => (c.job.action || c.job.kind) === key && c.job.actor.username === job.actor.username && c.job.simulated === job.simulated);
  if (phase === 'receipt' && old?.phase === 'active' && sim.clock < old.until) return;
  if (old) {
    const combine = phase === 'receipt' && sim.clock - old.receivedAt < 1.6 || phase === 'active' && job.sceneId && old.job.sceneId === job.sceneId;
    const copy = { ...job, gift: job.gift ? { ...job.gift } : null };
    old.job = combine ? { ...copy, delta: old.job.delta + job.delta, amount: old.job.amount + job.amount, gift: old.job.gift || job.gift ? { ...(job.gift || old.job.gift), repeatCount: (old.job.gift?.repeatCount || old.job.amount) + (job.gift?.repeatCount || job.amount) } : null } : copy;
    old.until = sim.clock + (phase === 'active' ? (job.duration || sim.active?.duration || 1) + .4 : 3.2);
    old.receivedAt = sim.clock; old.phase = phase; old.element.classList.remove('leaving'); refreshCard(old); return;
  }
  if (cards.length >= 3) {
    const at = cards.findIndex(c => c.phase !== 'active' || sim.clock >= c.until);
    if (phase === 'receipt' && at < 0) return;
    cards.splice(at < 0 ? 0 : at, 1)[0].element.remove();
  }
  const element = document.createElement('div'); element.className = 'gift-card'; element.dataset.action = key;
  const icon = document.createElement('canvas'); icon.width = icon.height = 112; icon.setAttribute('aria-hidden', 'true');
  const content = document.createElement('div'); content.className = 'copy';
  const name = document.createElement('b'); name.textContent = '@' + job.actor.username;
  const row = document.createElement('div'); row.className = 'caption';
  const caption = document.createElement('span'); caption.className = 'value';
  const multiplier = document.createElement('span'); multiplier.className = 'multiplier';
  row.append(caption, multiplier); content.append(name, row); element.append(icon, content); $('feed').append(element);
  renderer?.icon(icon, ACTIONS[key]?.sprite || 'trophy');
  const c = { element, caption, multiplier, icon, phase, job: { ...job, gift: job.gift ? { ...job.gift } : null }, receivedAt: sim.clock, until: sim.clock + (phase === 'active' ? (job.duration || sim.active?.duration || 1) + .4 : 3.2) };
  cards.push(c); refreshCard(c);
}
function notice(key) { $('notice').textContent = text(key, language); $('notice').hidden = false; noticeUntil = performance.now() + 2400; }
function event(e) {
  dirty = true;
  renderer?.event(e); audio.effect(e);
  if (e.kind === 'received') card(e);
  if (e.kind === 'effectStart') card({ ...e, kind: e.action }, 'active');
  if (e.kind === 'rejected') notice('rejected');
  if (e.kind === 'settings' && e.pending) notice('pending');
  if (e.kind === 'reset' || e.kind === 'roundStart' || e.kind === 'control') releaseInput();
  if (e.kind === 'reset' || e.kind === 'roundStart' || e.kind === 'control' && ['session.end', 'session.panic'].includes(e.action)) {
    for (const c of cards) c.element.remove(); cards.length = 0;
    if (e.kind === 'reset' && e.actor) card({ ...e, action: 'reset' }, 'active');
  }
}
function localize(value = language) {
  if (typeof value === 'object') value = value?.language;
  if (LANGUAGES.includes(value)) language = value;
  document.documentElement.lang = language; $('language').value = language;
  if (renderer) renderer.language = language;
  for (const el of document.querySelectorAll('[data-copy]')) el.textContent = text(el.dataset.copy, language);
  for (const [id, key] of [['menu-toggle', 'settings'], ['menu-close', 'closeMenu'], ['game-menu', 'gameMenu'], ['dock', 'gameControls'], ['scene', 'gameWorld'], ['language', 'language'], ['sound', 'audio'], ['test-toggle', 'test'], ['setup-toggle', 'settings']]) $(id).setAttribute('aria-label', text(key, language));
  $('victory-award').textContent = '+1 ' + winLabel(1, language).toUpperCase();
  for (const c of cards) refreshCard(c);
  for (const button of document.querySelectorAll('[data-color]')) button.setAttribute('aria-label', text(button.dataset.color, language));
  $('character-colors').setAttribute('aria-label', text('characterColor', language));
  $('character-color-value').value = text(sim.settings.characterColor, language);
  for (const button of document.querySelectorAll('.gift-button[data-action]')) button.querySelector('strong').textContent = text(button.dataset.action, language);
}
async function recover(scope) {
  if (!scope || scope === recoveryScope) return recovering;
  recoveryScope = scope;
  recovering = (async () => {
    try {
      const store = await openRecovery(scope);
      const checkpoint=await store.read();
      const saved = restore(checkpoint, sim, renderer);
      if(saved&&saved.giftValuesVersion!==checkpoint.giftValuesVersion)await store.write(saved);
      if (saved) {
        language = LANGUAGES.includes(saved.language) ? saved.language : language;
        for (const c of cards) c.element.remove(); cards.length = 0;
        for (const label of saved.labels || []) {
          card(label.job, label.phase);
          const restored = cards.at(-1);
          if (restored) { restored.until = label.until; restored.receivedAt = label.receivedAt; }
        }
      }
      if (saved) localize(language);
      recovery = new Checkpoints(store,
        () => capture(sim, renderer, cards.map(c => ({ job: c.job, phase: c.phase, until: c.until, receivedAt: c.receivedAt })), language),
        (id, status) => sdk?.acknowledge?.(id, status),
        () => notice('recoveryFailed'));
    } catch { notice('recoveryFailed'); }
  })();
  await recovering;
}
async function init(state) {
  if (!state || state.gameId && state.gameId !== 'skyshift') return;
  const sequence = ++initSequence; initialized = false;
  await assetsGate;
  await recover(qa ? params.get('persist') : state.recoveryKey);
  if (sequence !== initSequence) return;
  sim.setSettings(state.settings || {}, !initialized);
  sim.paused = state.paused === true;
  if (Number.isSafeInteger(state.round) && state.round > 0) sim.round = Math.max(sim.round, state.round);
  localize(state.language); audio.route(state.audio || { enabled: false, volume: 0 });
  initialized = true;
  drainPending();
  last = 0; accumulator = 0;
}
function dispatch(type, payload) {
  if (!initialized || !loaded) {
    pending.push([type, payload]); return;
  }
  deliver(type, payload);
}
function deliver(type, payload) {
  const applied = type === 'action' ? sim.action(payload) : sim.control(payload);
  const status = applied ? 'accepted' : sim.seen.has(String(payload?.commandId)) ? 'duplicate' : 'rejected';
  if (recovery) recovery.mark(payload?.commandId, status);
  else if (payload?.commandId !== undefined && !recoveryScope) sdk?.acknowledge?.(payload.commandId, status);
}
function drainPending() {
  if (!loaded || !initialized) return;
  for (const [type, payload] of pending.splice(0)) deliver(type, payload);
}
sdk?.on('init', init);
sdk?.on('settings', value => sim.setSettings(value));
sdk?.on('action', payload => dispatch('action', payload));
sdk?.on('control', payload => dispatch('control', payload));
sdk?.on('audio', value => audio.route(value));
sdk?.on('language', localize);
// Raw events deliberately have no game mechanics; rules trigger the action hook.
sdk?.on('event', () => {});
if (embedded && sdk?.getState()) init(sdk.getState());

function hud(position) {
  const state = sim.stats(), now = performance.now();
  const value = distance(state.meter, language);
  if ($('distance').textContent !== value) $('distance').textContent = value;
  $('distance').parentElement.classList.toggle('negative', state.meter < 0);
  const shownWins = renderer.presentedWins ?? state.wins;
  const winText = distance(shownWins, language);
  $('wins').textContent = winText;
  $('wins').style.fontSize = Math.max(12, 23 - Math.max(0, winText.length - 3) * 1.7) + 'px';
  $('wins').parentElement.classList.toggle('negative-score', shownWins < 0);
  $('progress-fill').style.width = clamp(state.distance / sim.settings.finishDistance, 0, 1) * 100 + '%';
  $('remaining').textContent = distance(Math.max(0, sim.settings.finishDistance - state.meter), language) + ' m ' + text('remaining', language);
  $('hud').classList.toggle('is-holding', state.phase === 'holding');
  $('finish-card').hidden = state.phase !== 'holding' || state.paused;
  $('countdown').textContent = Math.ceil(state.countdown || 0);
  $('victory').hidden = state.phase !== 'celebrating';
  $('status').hidden = !state.paused && !state.ended;
  $('status').textContent = text(state.ended ? 'ended' : 'paused', language);
  $('pause').setAttribute('aria-pressed', String(state.paused));
  const pauseCopy = text(state.paused ? 'resume' : 'pause', language); $('pause-copy').textContent = pauseCopy; $('pause').setAttribute('aria-label', pauseCopy);
  const visualUnits = renderer.pendingVisualUnits || 0;
  $('queue').hidden = !state.queued && !visualUnits; $('queue').textContent = text('queued', language) + ' · x' + quantity(state.queuedUnits + visualUnits);
  $('biome').textContent = text(sim.settings.backgroundTheme === 'Auto' ? sim.world.biome(state.distance) : sim.settings.backgroundTheme, language).toUpperCase();
  $('notice').hidden = now > noticeUntil;
  for (const c of [...cards]) {
    if (!sim.settings.showContributors || sim.clock >= c.until) { c.element.remove(); cards.splice(cards.indexOf(c), 1); }
    else if (sim.clock > c.until - .15) c.element.classList.add('leaving');
  }
  if (position) {
    const stage = $('stage'), width = $('feed').offsetWidth;
    $('feed').style.left = clamp(position.x - width / 2, 10, stage.clientWidth - width - 10) + 'px';
    $('feed').style.top = clamp(position.y + (state.phase === 'holding' ? 76 : 17), 170, stage.clientHeight - $('feed').offsetHeight - 32) + 'px';
  }
  if (embedded && now - reportAt > 250) { reportAt = now; sdk?.report({ wins: state.wins, countdown: state.countdown || 0 }); }
  const size = Math.max(27, Math.min(79, $('stage').clientWidth * 0.165) - Math.max(0, value.length - 5) * 5);
  $('distance').style.fontSize = size + 'px';
  const room = $('hud').clientWidth - $('wins').parentElement.offsetWidth - $('distance').nextElementSibling.offsetWidth - 28;
  if ($('distance').offsetWidth > room) $('distance').style.fontSize = Math.max(18, size * room / $('distance').offsetWidth) + 'px';
}
function draw(dt = 0, alpha = 1) { if (renderer && loaded) hud(renderer.render(sim, alpha, dt)); audio.update(sim); dirty = false; }
function frame(now) {
  if (disposed) return;
  const elapsed = last ? Math.max(0, (now - last) / 1000) : 0; last = now;
  if (initialized && loaded && !document.hidden && !manualClock && !sim.paused && !sim.ended) {
    accumulator += Math.min(elapsed, 0.25);
    while (accumulator + 1e-9 >= STEP) { sim.step(); accumulator -= STEP; }
  } else accumulator = 0;
  if (!document.hidden && (!manualClock || dirty)) draw(Math.min(elapsed, 0.05), manualClock || sim.paused ? 1 : clamp(accumulator / STEP, 0, 1));
  frameId = requestAnimationFrame(frame);
}

const moveKeys = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'];
addEventListener('keydown', e => {
  if (!moveKeys.includes(e.code) || e.target.closest?.('input,textarea,select')) return;
  e.preventDefault(); keys.add(e.code); input(); audio.unlock();
});
addEventListener('keyup', e => { if (moveKeys.includes(e.code)) { keys.delete(e.code); input(); } });
function touchDirection(e) {
  const rect = $('stage').getBoundingClientRect(), position = (e.clientX - rect.left) / rect.width;
  pointers.left.delete(e.pointerId); pointers.right.delete(e.pointerId);
  if (position < .46) pointers.left.add(e.pointerId);
  else if (position > .54) pointers.right.add(e.pointerId);
  input();
}
$('stage').addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.closest('button,input,select,textarea,#game-menu')) return;
  closeMenu(); e.preventDefault(); $('stage').setPointerCapture(e.pointerId); touches.add(e.pointerId); touchDirection(e);
});
$('stage').addEventListener('pointermove', e => { if (touches.has(e.pointerId)) touchDirection(e); });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('stage').addEventListener(type, e => { touches.delete(e.pointerId); pointers.left.delete(e.pointerId); pointers.right.delete(e.pointerId); input(); });
addEventListener('blur', releaseInput);
document.addEventListener('visibilitychange', () => {
  releaseInput(); last = 0; accumulator = 0;
  if (document.hidden) audio.update({ settings: sim.settings, paused: true, ended: sim.ended });
});
document.addEventListener('pointerdown', () => audio.unlock(), { capture: true, passive: true });
$('sound').onclick = () => { audio.muted = !audio.muted; $('sound').setAttribute('aria-pressed', String(audio.muted)); audio.update(sim); };
$('pause').onclick = () => sim.control({ action: sim.paused ? 'session.resume' : 'session.pause' });
function closeMenu() { $('game-menu').hidden = true; $('menu-toggle').setAttribute('aria-expanded', 'false'); }
const sliders = [['fx-volume', 'soundVolume'], ['music-volume', 'musicVolume'], ['detail-input', 'effectsIntensity']];
function syncSettings() {
  const value = sim.pendingSettings || sim.settings;
  $('finish-input').value = value.finishDistance; $('hold-input').value = value.winCountdown;
  $('autoplay-input').checked = value.autoplay; $('music-input').checked = value.musicEnabled; $('contributors-input').checked = value.showContributors;
  $('quality-input').value = value.visualQuality;
  $('background-input').value = value.backgroundTheme;
  $('character-color-value').value = text(value.characterColor, language);
  for (const button of document.querySelectorAll('[data-color]')) { button.setAttribute('aria-checked', String(button.dataset.color === value.characterColor)); button.tabIndex = button.dataset.color === value.characterColor ? 0 : -1; }
  for (const [id, key] of sliders) { const percent = Math.round(value[key] * 100); $(id).value = percent; $(id + '-value').value = percent + '%'; }
  for (const [kind, spec] of Object.entries(ACTIONS)) {
    const amount = document.querySelector('[data-action="' + kind + '"] small');
    if (amount) amount.textContent = spec.setting ? (spec.sign > 0 ? '+' : '−') + distance(value[spec.setting], language) + ' m' : kind === 'winAdd' ? '+1' : kind === 'winRemove' ? '−1' : '↻';
  }
}
$('menu-toggle').onclick = () => { releaseInput(); const open = $('game-menu').hidden; if (open) syncSettings(); $('game-menu').hidden = !open; $('menu-toggle').setAttribute('aria-expanded', String(open)); };
$('menu-close').onclick = closeMenu;
addEventListener('keydown', e => { if (e.code === 'Escape') closeMenu(); });
function panel(name) {
  releaseInput(); const target = $(name + '-panel');
  for (const id of ['test', 'setup']) { $(id + '-panel').hidden = true; $(id + '-toggle').setAttribute('aria-expanded', 'false'); }
  target.hidden = false; $(name + '-toggle').setAttribute('aria-expanded', 'true');
}
$('test-toggle').onclick = () => panel('test'); $('setup-toggle').onclick = () => panel('setup');
$('language').onchange = () => localize($('language').value);
for (const [id, key] of sliders) $(id).oninput = () => { $(id + '-value').value = $(id).value + '%'; sim.setSettings({ [key]: Number($(id).value) / 100 }); };
for (const [id, key] of [['music-input', 'musicEnabled'], ['autoplay-input', 'autoplay'], ['contributors-input', 'showContributors']]) $(id).onchange = () => sim.setSettings({ [key]: $(id).checked });
$('quality-input').onchange = () => sim.setSettings({ visualQuality: $('quality-input').value });
$('background-input').onchange = () => { sim.setSettings({ backgroundTheme: $('background-input').value }); draw(); };
$('setup-panel').onsubmit = e => {
  e.preventDefault(); if (!$('setup-panel').reportValidity()) return;
  sim.setSettings({ finishDistance: Number($('finish-input').value), winCountdown: Number($('hold-input').value), autoplay: $('autoplay-input').checked, musicEnabled: $('music-input').checked, showContributors: $('contributors-input').checked, visualQuality: $('quality-input').value });
  sim.control({ action: 'session.restart' }); noticeUntil = 0; $('notice').hidden = true; closeMenu();
};
for (const [name, spec] of Object.entries(CHARACTER_COLORS)) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'color-choice'; button.dataset.color = name;
  button.setAttribute('role', 'radio'); button.setAttribute('aria-label', text(name, language)); button.style.setProperty('--color', spec.color);
  button.onclick = () => { sim.setSettings({ characterColor: name }); syncSettings(); draw(); };
  button.onkeydown = e => {
    const names = Object.keys(CHARACTER_COLORS), at = names.indexOf(name);
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? names.length - 1 : (at + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1) + names.length) % names.length;
      document.querySelector('[data-color="' + names[next] + '"]').click(); document.querySelector('[data-color="' + names[next] + '"]').focus();
    }
  };
  $('character-colors').append(button);
}
for (const [kind, spec] of Object.entries(ACTIONS)) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'gift-button'; button.dataset.action = kind;
  button.title = spec.description || '';
  button.style.setProperty('--accent', spec.color);
  const icon = document.createElement('canvas'); icon.width = icon.height = 64; icon.dataset.sprite = spec.sprite; icon.setAttribute('aria-hidden', 'true');
  const copy = document.createElement('div'), title = document.createElement('strong'), amount = document.createElement('small');
  title.textContent = text(kind, language);
  amount.textContent = spec.setting ? (spec.sign > 0 ? '+' : '−') + distance(sim.settings[spec.setting], language) + ' m' : kind === 'winAdd' ? '+1' : kind === 'winRemove' ? '−1' : '↻';
  copy.append(title, amount); button.append(icon, copy);
  button.onclick = async () => {
    if (!$('gift-quantity').reportValidity()) return;
    const payload = { action: kind, amount: Number($('gift-quantity').value), actor: { username: $('viewer').value || 'studio' }, source: { simulated: true } };
    await audio.unlock(); dispatch('action', payload);
  };
  $('gift-buttons').append(button);
}

for(const button of document.querySelectorAll('[data-quick-action]'))button.addEventListener('click',async()=>{
  await audio.unlock();dispatch('action',{action:button.dataset.quickAction,amount:1,actor:{username:'preview'},source:{simulated:true}});
});
async function boot() {
  try {
    localize(); renderer = new Renderer($('scene')); renderer.language = language;
    await Promise.all([renderer.loaded, audio.prepare(), document.fonts.ready]);
    assetsReady();
    // Keep the existing browser save key after the public folder rename.
    if (!embedded) await recover(qa ? params.get('persist') : 'review:' + location.pathname.replace('/GAME/NOVA-VEX/','/GAME/NEON-ASCENT/'));
    loaded = true; renderer.resize(); renderer.onCue = cue => audio.effect(cue); renderer.onScoreStart = job => { for (const source of job.contributions) card({ ...source, sceneId: 'utility-' + job.sequence + '@' + job.clock, duration: job.duration }, 'active'); };
    renderer.icon($('trophy'), 'trophy'); renderer.icon($('victory-cup'), 'trophy'); renderer.icon($('finish-flag'), 'finish'); syncSettings();
    for (const canvas of document.querySelectorAll('[data-sprite]')) renderer.icon(canvas, canvas.dataset.sprite);
    for (const c of cards) renderer.icon(c.icon, ACTIONS[c.job.action || c.job.kind].sprite);
    drainPending(); $('loading').hidden = true; draw(); sdk?.ready({ gameId: 'skyshift', commandAck: true });
    connectStudioGame({action:payload=>sim.action(payload),control:payload=>sim.control(payload),
      getSettings:()=>({...sim.settings}),getState:()=>sim.stats()});
    frameId = requestAnimationFrame(frame);
    if (qa) window.__neonAscent = {
      sim, renderer, audio, stats: () => sim.stats(), action: payload => sim.action(payload), control: payload => sim.control(payload),
      language: code => { localize(code); draw(); },
      checkpoint: async () => { if (recovery) { recovery.mark(); await recovery.settle(); } },
      recovery: () => ({ enabled: Boolean(recovery), pending: recovery?.pending.size || 0, scope: recoveryScope }),
      advance: seconds => { for (let i = 0; i < Math.round(seconds / STEP); i++) sim.step(); draw(); return sim.stats(); },
      render: () => draw(), live: on => { manualClock = !on; accumulator = 0; last = 0; },
      teleport: meter => { sim.active = null; sim.phase = 'playing'; sim.player.y = sim.world.heightAt(meter); sim.player.x = sim.world.platform(Math.floor(meter)).x; sim.distance = meter; sim.previous = { ...sim.player }; sim.world.stream(sim.player.y, sim.clock); renderer.camera = null; draw(); }
    };
  } catch (error) {
    console.error(error); $('loading-copy').textContent = text('failed', language); $('loading').classList.add('failed');
  }
}
const observer = new ResizeObserver(() => { renderer?.resize(); if (loaded) draw(); }); observer.observe($('stage'));
setInterval(() => { if (recovery && sim.ledger.accepted > 0 && !disposed) recovery.mark(); }, 250);
addEventListener('pagehide', e => { recovery?.mark(); recovery?.flush().catch(() => {}); disposed = true; cancelAnimationFrame(frameId); observer.disconnect(); releaseInput(); if (e.persisted) audio.update({ settings: sim.settings, paused: true }); else audio.dispose(); });
addEventListener('pageshow', e => { if (e.persisted) { disposed = false; last = 0; accumulator = 0; observer.observe($('stage')); frameId = requestAnimationFrame(frame); audio.unlock(); } });
boot();
