# Neon Interact — Night Run

A separate game, available in the catalog and LIVE Studio as `neon-race-2`.
The original Neon Race and the homepage animation are preserved.

The native Canvas renderer retains the homepage's city, stars, red moon,
track and audience hearts. Its two custom AI-generated cel-illustrated coupes
use transparent sprites, neon underglow, illuminated wheels and nitro trails.
They are 18% smaller than the initial cars, with individually measured wheel
centers for animation. Sources, optimized assets and generation prompts are in
`assets/neon-race2/cars/`. The 540 × 960 streaming
layout scales to phones and the existing Studio preview.

Generated nitro/acceleration exhaust, EMP impact and shield art is stored in
`assets/neon-race2/effects/`. The four transparent optimized sprites total about
283 KB. Their animation follows the actual race state; a separate bounded
36-particle victory layer runs briefly during the result countdown. See the
effects folder README for source artwork, prompts and reduced-motion behavior.
Tiny semitransparent heart and gift icons appear above the rear of the contributing
car, without text or numbers, and fade within 0.55 seconds. Repeated events replace the same hint instead
of stacking; each car has at most one like hint and one gift hint. Reduced
motion keeps the hints still while they fade.

## Racing and LIVE

- The rules match Neon Race 1, verified against its actual engine over a full race.
- Base speed is 50 km/h; five likes add one km/h, up to 100. The original
  three-second activity window, ten-like maintenance threshold and 12 km/h/s
  decay are preserved. Gifts independently raise cruise speed up to 150,
  with a three-second grace period then 6 km/h/s decay.
- First 100 cumulative gift points unlock nitro: every point adds .03 seconds,
  including subsequent one-point gifts. Nitro reaches 200 km/h and fades over
  its final 1.5 seconds. The bar uses the same scale as Neon Race 1.
- New 25-point gift charges trigger a 25% speed hit, with a five-second cooldown;
  active nitro shields the rival. Trailing nitro cars with a higher score receive
  the original 10/20/30% comeback bonus, capped at the gap.
- Track length is 4,000 meters; movement converts km/h to m/s. First crossing
  wins (sub-frame comparison, tied crossings resolved by points). At 120 seconds,
  results use 70% distance and 30% relative team points, as in Neon Race 1.
- The result overlay shows the outcome, distances, points and a 15-second next
  round countdown. Pause has its own overlay and freezes the cars/timer.
- Cars share the same initial horizontal position and follow the original
  progress/gap mapping. Tire contact shadows sit directly on flat asphalt lanes.
- Both lanes use shared geometry from `assets/interact-track.js`: road edges
  at 392/888, a centered separator at 640 and equal 248-unit lanes. Vehicles
  use the same 20-unit inset from each lane's lower edge.
- The first chat team selection is locked for a round; players must rejoin the
  next round. Session rankings persist, separately displaying total gift coin
  value and likes, with gift/heart icons. A 10-coin gift adds 10 to the gift
  column; a three-gift streak of 10 coins adds 30. Ranking uses likes + gift points.
- A new LIVE session clears session rankings and team wins.
- No bot contributions are added unless the operator explicitly enables
  the labeled simulation. Local test contributions are labeled `Test`.
- Audio is enabled when the game starts. If the browser blocks autoplay, the first click or key press in the game or LIVE Studio unlocks playback. TEST MENU can turn sound off; it stays off through pauses and new rounds until manually enabled again.

## Sound

`assets/neon-race2-audio.js` synthesizes the engine layers and distinct start,
acceleration, nitro, EMP hit, shield, comeback, gift, like, victory and final
countdown cues. Default levels are master 70%, engine 20%, effects 40%.
One shared engine follows the faster car, so the two cars do not play overlapping engine tones.
All three controls are available through Studio's Audio tab in TEST MENU.
Engine pitch/filter/noise follow speed; stronger event cues briefly lower the
engine. A compressor and a 24-voice limit control overlapping event peaks.
Pause, hidden-page state and sound-off silence playback. Muted/paused race
events do not replay when sound resumes. One-shot cues fire on state changes,
with cooldowns for frequent likes/gifts and comeback re-entry.

The native offline-audio verification measures actual samples, checks that
there is one shared engine and the requested default mix is quieter,
and checks zero-volume silence, pause, headroom and connected Studio controls.

The existing versioned `TikInteractGame` SDK receives typed chat/like/gift
callbacks. Studio proxies the real controls from `testPanel`; the original
menu is hidden inside the game when embedded. Unavailable control categories
are omitted from the Studio tabs.

## Verification

```powershell
npm.cmd test
node scripts/verify-neon-race2.mjs
node scripts/verify-neon-race2-effects.mjs
node scripts/verify-neon-race2-audio.mjs
```

The browser check covers real canvas rendering, phone layout, pause, likes,
nitro, external Studio controls, SDK events and supporter rankings. It also
captures actual game images for the catalog. This checks local event delivery;
an actual TikTok broadcast still requires an authenticated LIVE session.
