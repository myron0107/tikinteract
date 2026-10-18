# Home animation

Home uses an actual canvas illustration, not a video element or media player.
`assets/home-showcase.js` draws a scrolling night city, moving track, audience
hearts and the original Neon Race and Neon Riders characters. Wheels rotate
with clipped sprite patches.

The two scenes cycle every nine seconds. Choosing a game keeps that selection.
The pause button, reduced-motion setting, offscreen visibility and hidden Home
all stop the rendering loop. Rendering is limited to 30 fps and a 1600-pixel
canvas width. Only the current/next scene artwork is loaded.

Optimized sprites in `assets/home-showcase` retain their sources and original
dimensions in `manifest.json`. Only the four car and motorcycle assets are loaded;
the archived Country Derby artwork is unused by the homepage animation.

With the local server running on port 3000:

```powershell
node scripts/capture-game-gallery.mjs --verify-animation
```

This browser verification checks real pixel changes, manual pause, both
games, offscreen suspension, reduced motion and the absence of a video element
at desktop and phone widths. Existing recorded MP4 assets and their generator
scripts are retained but are not loaded by Home.
