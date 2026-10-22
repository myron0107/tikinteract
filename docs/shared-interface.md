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

Checks: `node --test`, `node scripts/verify-initial-render.mjs`,
`node scripts/verify-shared-interface.mjs`. Browser checks use isolated accounts
and local servers. No live accounts, payments or LIVE streams are created.
