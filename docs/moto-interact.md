# Moto Interact

A separate daylight motorcycle game derived from Neon Interact, available as
`moto-interact` in the catalog, Game Center, favorites and LIVE Studio.
Play it at `GAME/MOTO-INTERACT/Moto-Interact.html`; presentation is `index.html`
in the same folder. Neon Interact is preserved as its own game.

The interface imports the original Neon Interact CSS, retaining its 540 × 960
layout, typography and control placement, with compact motorcycle telemetry.
Daylight color overrides use white/pale-blue surfaces, dark text and RED/BLUE
accents, including pause and results overlays. The website and Neon palette stay unchanged.
The active scenery is the user's approved `scenery/day-boulevard.png` illustration
and its optimized WebP, preserving its skyline, river and asphalt. Matching
motorcycle/rider sprites use the original coupe's flat angular shading,
dark panels, simple hubs and thin red/blue lighting. Original and optimized assets,
wheel/contact metadata and complete built-in image-generation prompts are
in `assets/moto-interact/`.

## Gameplay

The shared `neon-race2-engine.js` keeps exactly the Neon Interact rules:
RED/BLUE join per round; base 50 km/h, likes up to 100, gifts up to 150,
nitro up to 200, first 100 gift points unlock nitro, attacks/shields,
comeback, 4 km / 120 seconds, Top 5 coin/like totals and a 15-second next-round
countdown. A dedicated high-revving motorcycle engine timbre is used instead
of the car engine sound; one engine mix starts enabled at 70/20/40
master/engine/effects.
Studio owns TEST MENU; only supported Test and Audio tabs appear.

## Wheelie

Only active nitro lifts the front wheel. Its target angle is 0–26 degrees
as displayed speed moves from 150 to 200 km/h. Lifting and landing are smoothed;
nitro fading lowers the bike progressively. The transform pivots around the
measured rear tire contact, preserving asphalt contact throughout the lift.
Both bikes start level at equal positions. Pausing freezes the pose; a new round
resets it. Reduced-motion mode keeps the correct gameplay pose without tweening.

Telemetry sits above each bike, exactly as in Neon Interact.
Its motorcycle variant uses 14px speed, 7px team names and a 58px nitro bar.
Exhaust jets originate at a dedicated tail outlet above the rear tire; their
position and direction follow the same wheelie transform as the sprite.
Both games use equal lanes and matching tire-contact insets through
`assets/interact-track.js`. Moto's image compositor in `assets/moto-interact-track.js`
maps the road from y=438 to 900 into two 231-unit lanes, with divider y=669 and
tire contacts y=649/880. Neon retains its original 248-unit lanes.
The original skyline and near railing scroll left in mirrored loops at different
speeds, driven by the speed-sensitive race clock. Pause/results freeze the scenery;
reduced-motion mode keeps it still. Moto's ambient hearts have stronger contrast,
and contribution hints use slightly larger icons with an 0.8-second lifetime.
Tiny semitransparent heart/gift icons, generated nitro/impact/shield sprites,
pause/results overlays and victory effects are reused from Neon Interact.

## Verification

```text
npm test
node scripts/verify-moto-interact.mjs
```

The browser check compares interface geometry and computed fonts against
Neon Interact, then verifies the approved daylight asset, light palette, equal lanes, normal and nitro poses, grounded
rear contact, gradual landing, paused animation, 540/390px layouts, reduced
motion, real Studio-to-game SDK chat/likes/gifts and external controls. It also
captures genuine gameplay images for the catalog and presentation. Test SDK
events do not open an actual TikTok connection.
