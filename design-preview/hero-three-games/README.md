# Homepage animation proposal — awaiting approval

Standalone native Canvas preview; not imported by the production homepage.

- 0–6s: NEON INTERACT, night race, likes and gifts trigger actual native nitro effects.
- 6–12s: MOTO INTERACT, approved moving daytime boulevard, native nitro/wheelie and settling as speed decreases.
- 12–20s: NOVA & VEX, jump and jetpack followed by the original hoverboard arrival, hair pull, Nova reaction and departure choreography.
- 550ms crossfades between scenes; silent loop, pause/play, manual scene selection and reduced-motion support.
- Uses the existing racing engines/renderers and Nova artwork/choreography. No LIVE connection, account, database writes or game-engine changes.
- RO/EN preview copy and neutral Light/Dark shell. No text overlays on the gameplay.

Serve the project locally and open `/design-preview/hero-three-games/`. Video/GIF exports are review artifacts only; the proposed homepage implementation uses Canvas, not a video player.

Review files: `watch.html` opens the self-contained video export directly from disk; `preview-v1.mp4` is 1280×720 at 30fps for 20 seconds, and `preview-v1.gif` is a smaller animated preview. `poster-v1.png` is the still poster. No export is referenced by the production website.
