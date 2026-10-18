# Moto Interact artwork

The game uses the user's approved boulevard illustration and motorcycle sprites
generated with the built-in `image_gen` tool using the original coupe as reference.
The boulevard's original prompt is in [generation-prompts.json](generation-prompts.json);
the active bike prompts are in [generation-prompts-v2.json](generation-prompts-v2.json).

- `scenery/reference-neon-track.png`: original Neon Interact track reference.
- `scenery/day-boulevard.png`: the exact approved user attachment, with daylight
  skyline, river and road. `day-boulevard.webp` is the active runtime image.
  Source SHA-256: `657b0f1eaf3239ce8a29182d555059b1c4b89d956ea0b0c97abae5d77d1765de`.
- `bikes/sport-red-v2.png`: red motorcycle and rider in the original coupe's
  angular cel-shaded style, with matching simple hubs and red LED trim.
- `bikes/sport-blue-v2.png`: matching blue colorway of the same sprite.
- `bikes/sport-red-v2.webp` and `bikes/sport-blue-v2.webp`: active cropped sprites.
- `bikes/manifest.json` / `manifest.js`: alpha bounds, wheel centers, animated
  hub radii, rear tire contact and tail exhaust outlet measured on the sprites.

`node scripts/prepare-moto-interact-assets.mjs` prepares runtime WebPs with
native browser Canvas, preserving source alpha. The rear tire contact is the
wheelie pivot, so lifting the front does not lift the bike off the road.
The Moto renderer applies a modest daylight exposure to the bike/rider and its
animated wheel crops, lifting dark panels while preserving the original RED/BLUE skins.

`assets/moto-interact-track.js` fits the approved illustration into the game,
preserving the skyline and mapping its original asphalt into two equal lanes.
The centered lane markings animate over that asphalt. Neon Interact's base CSS is imported,
with daylight color overrides confined to Moto Interact;
compact team/speed/nitro telemetry stays above the vehicles, as in the original.
Nitro, heart/gift icons, pause and reduced-motion behavior remain native layers.

Earlier `sport-red.png`, `sport-blue.png` and the alternate `day-neon-v2.png`
scenery and their WebPs are unused drafts. The active bikes remain the v2 sprites.
