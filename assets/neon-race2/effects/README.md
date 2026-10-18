# Night Run effects

Four transparent images were created with the built-in image generation tool:
`nitro.png`, `boost.png`, `impact.png`, `shield.png`. Optimized WebP copies are
loaded by the game. Exact prompts are in `generation-prompts.json`; dimensions,
alpha bounds and transparency checks are in `manifest.json`.

- Cyan nitro jet: at displayed speeds of 150 km/h and above, growing up to 200.
- Amber acceleration flame: at displayed speeds of 100–149 km/h. It grows toward
  the cyan jet's starting size for a smooth transition. Neither flame appears
  below 100. Effect selection follows displayed speed during deceleration too.
- Violet EMP impact: the original .55-second hit window; a short electrical arc
  connects the attacker to its target.
- Cyan shield: only when active nitro blocks an attack; its center is transparent.
- Comeback: fine team-colored speed streaks tied to the actual comeback rule.
- Victory: 36 lightweight confetti particles in the winning team's palette,
  ending after 6.5 seconds of the result countdown. Draws use deterministic
  particles, not an accumulating particle queue.

The road, cars and telemetry remain readable. Pause freezes all in-race effects.
Reduced-motion mode removes moving streaks, bolts and victory particles and
holds the continuous exhaust pose still. Race mechanics are unchanged.

To rebuild optimized images from the original generated PNGs:

```powershell
node scripts/prepare-neon-race2-effects.mjs
```
