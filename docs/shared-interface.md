# Shared interface

The public masthead is served as static HTML. Edit
`partials/public-header.html`, then run `node scripts/sync-public-header.mjs`.
This updates the homepage, game presentations and public information pages.
`assets/public-header.css` owns its layout; `assets/public-header.js` owns the
scroll state and delegates standalone-page navigation to the existing homepage
routes. No header is rebuilt in the browser. Studio and administration retain
their own navigation.

`assets/brand.css` owns the native-text wordmark. The public header uses the same
name, slogan, typography and colors on every page. Studio's TIK/STUDIO mark is
separate. Avoid adding individual logo copies or page-specific slogan colors.

`assets/ui-controls.css` owns shared search, catalog-select, filter and favorite
styles. Search controls are 40px high, with 10px corners and 12px text. Filters
are 36px high and favorite actions are 24px square. Widths adapt to the available
space. Existing search, filter, favorite and audio handlers remain unchanged.

The current Studio columns, navigation, orientation controls and connection
form live directly in `live-studio.html`. `assets/studio-structure.js` applies
custom administration layouts without rebuilding panels; both historical
default configurations normalize to the current static layout and require no
panel moves. Update the HTML when changing the default shell.

`assets/page-startup.js` reads saved preferences before paint and waits for the
initial language and shell. Studio additionally waits for the existing account
decision. It does not wait for game artwork or audio. Its bounded fallback
restores visibility if initialization fails, without changing access guards.

The initial pending state now displays a native branded loading screen, with
the existing Studio SVG mark or public TikInteract wordmark. It follows saved
language, mode and Studio palette before paint, respects reduced motion and
disappears as soon as boot readiness is signaled. It adds no minimum delay and
does not run on Studio tab changes. Edit `partials/page-startup.html`, then run
`node scripts/sync-page-startup.mjs` to sync the 14 pages that use the existing
startup lifecycle. `node scripts/verify-loading-screen.mjs` checks real reloads
and both loading/ready states with isolated local readiness fixtures.

Checks: `node --test`, `node scripts/verify-initial-render.mjs`,
`node scripts/verify-shared-interface.mjs`. Browser checks use isolated accounts
and local servers. No live accounts, payments or LIVE streams are created.

Studio sidebar visibility is edited in Administration → LIVE Studio. Six
independent switches control Stream, Games, Sound Pad, Animations, Studio guide
and Back to website. They use the existing draft/preview/publish flow and store
booleans in `studio.visibility` of the existing site configuration JSON. No SQL
migration or new table is required. Configurations without the field retain all
existing sections. Resetting the workspace layout preserves visibility choices.

`assets/studio-visibility.js` applies published visibility, hides related workspace
links and routes an unavailable active section to the first visible one without
reloading its game. If all main sections are hidden, an empty state preserves the
profile/account/admin access. This is interface visibility, not a replacement for
existing account/game permission checks. The initial Studio reveal additionally
waits for the first published-configuration attempt to avoid flashing hidden menu
items. Existing visibility refreshes on page activation and the normal 60s poll.

`node scripts/verify-studio-visibility.mjs` checks the full Admin draft/publish
workflow using isolated local fixtures, reactivation, all-hidden fallback,
account-window and iframe preservation, layout reset and localized mobile UI.
