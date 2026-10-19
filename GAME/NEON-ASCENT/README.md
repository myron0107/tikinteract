# NOVA & VEX

A separate neon parkour prototype starring Nova and her rival Vex. The existing SkyShift edition and the
supplied original file are preserved.

Open `http://127.0.0.1:3001/GAME/NEON-ASCENT/Neon-Ascent.html` while the local
preview server is running. This is a playable visual prototype, not a registered
LIVE Studio game. A/D or touch the left/right side to steer. The three **TEST**
buttons preview upward/downward gifts and the rival; the gear opens all settings
and test actions. No real LIVE gifts are sent by these controls.

Visual identity: cyan, violet, hot pink and navy; a human runner in a hoodie,
a human masked street rival and a hoverboard. Six clothing colors preserve skin
tones. Generated ledges, finish platform and props are rendered from the new
atlas. All eight height zones now have distinct generated images: Deep Grid,
Power Core, Undergrid, Neon District, Rooftop Run, Skyline, Sky Circuit and Neon
Heights. Their ranges/files are in `art/zones.json`; there are no shared stage
images. Ambient details and transitions remain animated.

The new gift pack has its own atlas and animations:

| Upward power | Distance | Downward power | Distance |
| --- | ---: | --- | ---: |
| Spring Pad | +5 m | Vex Banana Prank | -5 m |
| Grappling Hook | +50 m | Vex Spring Punch | -50 m |
| Jetpack | +150 m | Vex Push / Împingerea lui Vex | -150 m |
| Portal Jump | +300 m | Vex Board Ride / Cursa lui Vex | -300 m |

Each object has anticipation, physical contact, travel and release. Height stays
unchanged until contact. The spring has separately animated plates and coil;
the grappling rope casts and reels; the jetpack attaches and ignites two jets;
portal transit hides and reveals the runner. All downward gifts are performed
by Vex: he tosses the banana beneath Nova, extends a spring glove from his hand,
collects Nova onto one shared board and carries her down before throwing her
off, or approaches and shoves her off the ledge. In the ride, both characters'
feet stay over the same enlarged board; Vex carries her through the first 88%
of the distance, then throws her for the last accelerating fall. During the
push, Vex stays at his original height while Nova falls away. Both scenes land
at the exact requested destination, with a separate landing sound and reaction.
The push now uses two paired keyframes: both open palms placed on Nova's upper
back with bent elbows, followed by the extended-arm push. This contact is held
on screen before freefall, with no punch pose, hit particles, impact shake or
thump. The ride uses two more paired keyframes showing fingers gripping her
wrist and sleeve, then pulling her closer. The grip stays visible during the
shared descent and opens at the throw. The paired sprites replace the individual
bodies during contact, so Nova and Vex are never drawn twice. Their measured
feet anchors keep both figures registered to the board through the transition.
Each has an entrance, authored action pose, contact, Nova's own
reaction and board exit. Negative icons include Vex's actual portrait, while
the ride/push icons combine the actual Nova and Vex sprites with his board.
Character poses, squash,
tilt and scale follow these timelines. Large scenes temporarily frame the runner
inside safe horizontal margins. Pause freezes the same simulation clock.
The Vex gift/feed icon draws the portrait from the actual silver-haired rival
sprite sheet via `rig.portrait`; no different masked character is substituted.
The jetpack is 40 game pixels wide for the 88-pixel runner. Both exhaust origins
use measured nozzle positions inside the same translated/rotated pack frame.

Reboot resets the route, Bonus Crown adds a holographic crown, and Vex Attack
removes one during the short hair tug. Vex arrives laterally on his own board,
skids, reaches toward the runner's hair, closes his hand, tugs and releases
before accelerating away. The raised-arm and clenched-hand art come from the
same Vex sprite sheet; a connected lock follows the actual scalp and hand
transforms. Vex's feet remain attached to the same board throughout.

The runner uses three dedicated generated reaction poses: startled face with
raised hands, both hands protecting the hair during the tug, and an annoyed
hair-smoothing recovery. Body lean, lift and rebound follow the same scene clock.
All six outfit colors also cover these poses, preserving the skin and hair.
The hair-tug scene has a sideways entry; the board ride and push are separate
downward gifts. The matching generated paired poses keep both characters'
identity and clothing. All six Nova clothing colors also cover the paired
sprites, while Vex's side of the image and warm skin pixels are preserved.
The stable internal action IDs retain quantity handling, replay
protection, FIFO behavior and the finish countdown; they no longer select the
old balloon/anvil/meteor/cloud/magnet/tornado visuals. `src/neon-gifts.js` draws
the upward scene effects; `src/vex-negatives.js` owns the four downward Vex scenes;
`src/gift-definitions.js` contains names and descriptions.

Artwork was generated with OpenAI's built-in ImageGen. PNG masters are in
`art/source/`, exact prompts in `art/prompts.json`, `art/new-gifts-prompts.json`
and `art/physical-gifts-prompts.json`, with the new reaction prompts in
`art/reactions-prompts.json` and the four Vex action poses in
`art/vex-actions-prompts.json` / `art/vex-actions-refinement.json` and the paired
push/catch/pull poses in `art/interactions-prompts.json`. Their final atlas is
`art/interactions.webp`, with foot anchors in `art/interactions-metadata.json`;
runtime WebP files and measured transparency/sprite bounds in
`art/generated-manifest.json`. All 16 runtime art files have a generated PNG
master; hashes and provenance are in `art/image-audit.json`. Original sound/font
notices remain in the HTML. Earlier discarded object variants remain in the
source folder, but are not loaded by the current game.

All 44 runtime sounds are original physical arcade foley and a rhythmic 132 BPM
arcade track (drums, syncopated bass, short stabs and a melodic hook), replacing
the previous ambient groove. Reproduce them with
`python scripts/render-neon-ascent-foley.py` (Python 3 + FFmpeg); metadata and
hashes are in `audio/sound-design.json`. Springs, skid, cable latch/reel, jet
ignition, spring release, board pickup/descent, throw, shove, falling air and
landing are synchronized with the matching scene phase. The old chain and
board-slam sounds are retired. `--board-scenes-only` regenerates the seven new
ride/push sounds without changing the music or other effects.
The inherited audio recordings are not loaded. Audio notices in
the old HTML comment describe the source prototype only.

Validation: `node scripts/verify-neon-ascent.mjs` uses isolated desktop/mobile
browser profiles, simulated actions and no real TikTok connection. It covers
all new image loads, six outfit colors, skin-tone preservation, Test Menu gift
quantity, up/down effects, rival scene, pause, finish countdown and quick demo
controls. It also checks each of the eight automatic zone transitions and all
eleven new gifts, including full distance/score results and duplicate rejection.
`node scripts/audit-neon-ascent-art.mjs` checks unique stage image hashes and
generated PNG provenance. Preview screenshots are in `.tools/neon-ascent-qa/`.
`node scripts/verify-neon-ascent-gift-motion.mjs` checks all four animation
stages, contact timing, exact gift quantities, one contact sound and pause.
`node scripts/verify-neon-ascent-audio.mjs` checks all 44 decoded sounds,
loop boundaries, real mixer signal, mute, pause, volume and resource disposal.
`node scripts/verify-neon-ascent-vex.mjs` covers the attack from both sides on
desktop/mobile, rider/board attachment, closed-hand grip and single tug cues, score timing, pause,
replay protection and migration of saved scenes to the new shorter timeline.
`node scripts/verify-nova-vex-negative-gifts.mjs` covers all four downward scenes
from both sides on desktop/mobile, actual Vex poses, windup/contact/exit audio,
unchanged gift quantities, pause and duplicate rejection. It also verifies both
riders on one board, separation at the throw, Vex staying above the freefall,
ride-to-fall audio changes, and one landing cue at the exact destination.
`node scripts/verify-nova-vex-values.mjs` checks migration of saved review
sessions to Push -150 / Ride -300, including pending settings, preserved
preferences, already accepted commands and replay protection.
The contact stages also verify paired poses, visible grip before descent,
sustained pushing before freefall, no duplicate character sprites, and pause
during the hands-on interaction.
