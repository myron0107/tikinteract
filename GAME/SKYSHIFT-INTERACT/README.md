# SkyShift — TikInteract visual edition

Playable local preview: `http://127.0.0.1:3001/GAME/SKYSHIFT-INTERACT/index.html`.
On a server that has loaded the updated `server.js`, use its normal port instead.

Based on the supplied `SkyShift-3.html`. The source file is unchanged. This copy
contains the existing physics, gift actions, quantities, win/theft animation,
audio, countdown, recovery and controls. Move with A/D or the left/right sides
of the screen. Open the gear and choose **Cadouri de test** to preview effects.
The copy is a visual preview; it is not registered in LIVE Studio or connected
to the site's TikTok gift event routing.

New art was generated with OpenAI's built-in ImageGen: a 16-sprite atlas with
four robot poses and game props, an articulated six-part alien rig, its UFO,
and four portrait environments (city, clouds, orbit, cavern). The existing eight
height zones and transition logic use these four environments. The robot has
six selectable finishes: Burgundy, Pearl, Graphite, Ruby, Rose and Platinum.
Menus, HUD, platform surfaces and alien effects use the site's burgundy,
graphite, white and muted rose palette. Original anvil, meteor, explosion,
font and sounds retain their source notices in `index.html`.

Generated PNG masters and selected alpha-corrected variants are in `art/source/`.
Exact generation prompts are in `art/prompts.json`; background-removal prompts
are in `art/alpha-prompts.json`. Runtime WebP files, measured sprite bounds and
transparency information are recorded in `art/generated-manifest.json`.
Browser conversion preserves alpha and does not paint or retouch the artwork.

Validation: `node scripts/verify-skyshift.mjs` (desktop 1440px and phone 390px).
Set `SKYSHIFT_URL` if previewing on a different local port. Original and reskinned
simulation stats matched across 9,000 fixed steps with every gift action,
quantities, upward/downward effects and win changes. Browser QA covers art load,
all six finishes, test-menu quantity, rocket, meteor, alien scene, pause and
finish countdown. No real LIVE or gift events were sent.
