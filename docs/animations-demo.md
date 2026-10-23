# Studio animation DEMO

Historical reference: the active entry point now uses the real integration on
`codex/animations-production`. See [activation and implementation](animations-production.md).
The DEMO controller and local example data described below are no longer loaded
by the Studio entry point on that branch.

Branch: `codex/studio-animations-demo`. No deployment or database migration.

The fourth Studio rail tab opens `#studio-animations-panel` through the existing
`setLiveStudioTab` function. The current game, connection and audio state remain
in their original panels. `studio-animations-entry.js` imports the module only
when selected. The module's CSS is scoped to the new panel and its dialogs and
uses the existing Carbon theme tokens (Burgundy/Blue, Light/Dark). The existing
language switch controls its Romanian/English text.

## Implemented demo flows

- Generator: local photo preview, character name, action description, universe,
  5/10/15 second configuration, 9:16/16:9 preview framing, cancellable simulated
  progress, clearly labelled prepared example and save to demo library.
- Universes: eight supplied illustrated worlds, visible selection and custom
  local universes using one of the supplied worlds as their base artwork.
- Library: prepared examples, search, source filters, local video preview,
  assignment/unassignment to a demo fan, preview player and delete confirmation.
- Events: editable/enabled/disabled rules for gifts, usernames, coin thresholds
  and manual triggers; isolated gift simulator, local FIFO playback queue,
  pause/resume/stop, and bounded demo activity log.

No photo or prompt is processed with AI. Configured 5/10/15 second duration is
metadata; all prepared example videos are approximately five seconds. Aspect
ratio changes their crop, not an AI rendering. Every preview labels this.

## Storage and privacy

`animations-demo-model.js` owns validation, default data and pure rule matching.
It accepts only events explicitly marked `demo: true`; it has no real LIVE
subscriptions. No AI, OBS, TikFinity, Stripe or Supabase transport was added.

Durable metadata is stored under
`tikinteract_animations_demo_v1:<signed-in-user-id>` in localStorage. Restoration
validates known universes, supported settings and valid clip references. Photos,
uploaded video files, blob URLs and rules for session-only files are not stored.
Uploaded media are held as object URLs until reload, removal, sign-out or page
exit, when the URLs are revoked. Uploaded videos stay available across the
module's internal tabs, but not after reload. The UI explains these limits.
Limits: photo 10 MB; video 100 MB/file; 80 clips; 16 custom worlds; 40 rules;
20 queued clips and 15 log entries. Nothing is uploaded to a server.

## Future integration points (not connected)

- `startGeneration`: replace the timer with an authenticated generation job and
  real progress/result data. Keep sample results distinct from generated output.
- `source`/library import and durable state: introduce owned media storage,
  authorization and deletion before replacing local object URLs.
- `simulate`/`matchDemoRules`/queue: add a separate authenticated event adapter;
  preserve the demo-only boundary. No existing TikTok game-event path was changed.
- `playNext`: local preview only. A future overlay transport must be explicitly
  implemented before anything appears in OBS or a live broadcast.

## Verification

`node --test` includes metadata validation, storage isolation, file limits,
gift/user/threshold/manual matching, required assets and the no-transport guard.
`node scripts/verify-animations-demo.mjs` uses an isolated local account and
simulated network fixtures to exercise upload, generation/cancel/save, all eight
video decoders, custom worlds, search/filter/fan association, rule editing,
simulation/queue, reload/sign-out, retained game iframe and four appearance
combinations in both languages on desktop and mobile.

The supplied standalone `tikinteract-animations-template` remains untouched and
is excluded from deployment. Only selected runtime artwork and example clips
live in `assets/animations-demo` (approximately 3 MB total).

## Files

Existing files changed:

- `live-studio.html`: static fourth rail button, empty panel and scoped assets.
- `assets/studio-refresh.js`: localized sidebar/topbar animation title.
- `.vercelignore`: excludes the standalone design reference.
- `tests/studio-structure.test.js`: verifies the new fourth native tab.
- `scripts/verify-account-layout.mjs`: expects the fourth tab in regression QA.

New files:

- `assets/studio-animations-entry.js`: lazy module entry point.
- `assets/studio-animations.js`: generator, universe/library/event UI and local
  controllers; no backend transport.
- `assets/studio-animations.css`: scoped responsive appearance.
- `assets/animations-demo-model.js`: demo data, validation and rule matching.
- `assets/animations-demo/`: eight full illustrations, eight thumbnails, eight
  locally recorded WebM clips and provenance README.
- `tests/animations-demo.test.js`: pure model, isolation and asset checks.
- `scripts/verify-animations-demo.mjs`: isolated end-to-end browser checks.
- `docs/animations-demo.md`: implementation and future integration boundaries.
