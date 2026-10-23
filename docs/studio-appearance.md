# Studio appearance and compact controls

All visual and workspace changes are limited to `live-studio.html` and Studio assets. The public site changes only its language preference and asset versions, as explicitly requested. No production deployment, payment, AI call, database migration or LIVE connection was made.

## Appearance

`assets/studio-backgrounds.js` and `.css` add Default (graphite / pearl gray), Navy, Plum and Sage, a custom solid color, and the three approved illustrated landscapes. Background and interface palette are independent. “No palette” keeps neutral controls. Preferences persist locally and separately for LIVE and AI. Existing Light/Dark controls are reused. Images cover the entire viewport, centered without repeating, in both modes.

Selected artwork is stored in `assets/studio-backgrounds/`:

- `neon-city.webp`, `floating-islands.webp`, `ruby-arena.webp`: 265,692 / 298,266 / 239,422 bytes.
- Matching `-thumb.webp` files: 17,236 / 19,418 / 16,854 bytes.

The approved images were generated with built-in imagegen, then encoded to WebP and separate small previews. The original PNGs remain in the Codex generated-images directory. Unapproved people/abstract previews were not added to the project. Only the selected full image is used as the wallpaper; the chooser uses lazy thumbnails. Minimal backgrounds use CSS gradients without image downloads.

Prompt set for the approved images: a wide 16:9 gaming/streaming wallpaper, hand-drawn anime environment art, cel-shaded textures and clear linework; no people, faces, characters, animals, silhouettes, statues, text, logos or interface; quieter darker center, detailed far edges, controlled glow; no orange, copper or gold, no realistic room interiors.

1. A futuristic midnight rooftop/metropolis panorama, cobalt architecture, pink/cyan neon, violet stars and reflective dark foreground.
2. Floating rocky islands with emerald crystals, turquoise waterfalls, a deep purple valley, moonlit indigo sky and stylized trees.
3. An empty futuristic black/burgundy arena, ruby neon architecture, mountains, a dark red moon and crimson foliage.

## Windows and mobile

`assets/studio-widget-desktop.js` provides a single resize control for every page, the Stream picker and account dialogs. Native CSS resizing is disabled to avoid duplicates. Each grip is a fixed overlay outside the scrolling content, so it cannot extend the content width, create horizontal scrollbars or disappear while scrolling. Pointer capture supports mouse and touch; arrow keys resize the focused grip. Window movement, ResizeObserver and passive scroll listeners keep it at the outer bottom-right corner. The grip has a transparent background and a 14px symbol. Scrollbars are 4px wide, clipped to the rounded window, with a shortened track below the heading.

Both the STREAM canvas and independent windows can reach 4px from the viewport top. Panels, media elements and game iframes remain the same nodes.

Main page titles include their icon and short friendly copy. The Stream picker follows the same theme and title style. Close controls have no square background or shadow.

`assets/studio-mobile.css` hides navigation labels on small screens, preserves accessible names, adapts window bounds and supplies touch resize targets. The dock can collapse to its logo, with a down arrow underneath to expand it. It remains draggable and its collapsed state persists with existing dock preferences.

The top utilities bar has a separate collapse arrow on the left and a drag grip on the right after the profile picture. Collapsed mode shows the AI diamond/balance and profile, and retains the drag grip; expanding restores all commands. This preference uses the existing desktop settings storage.

`assets/studio-popovers.js` anchors profile, language, notifications and appearance to their own trigger. They follow the moved/resized bar, are bounded to the viewport, and use the space above the trigger only when there is insufficient room below. Opening one closes the others. The appearance popup is no longer confined by an ancestor backdrop filter.

## Refresh and language

`assets/studio-startup.js` and `.css` give Studio its own loading screen. It uses the existing crisp SVG logo with appropriate Light/Dark contrast, a progress track based on actual boot milestones, and a short fade. Readiness includes the dock, desktop layout and appearance, alongside existing authentication, language, navigation and saved-layout checks. The eight-second fallback prevents a failed module from hiding the page indefinitely. The public site's loading design is unchanged.

English is the default for new visitors on the site, maintenance page and Studio. `assets/language-preference.js` restores a signed-in account’s language from existing Supabase Auth metadata (`tikinteract_language`), with local account-specific storage and offline retry. Guest choices are separate; queued writes do not target another account after sign-out. Changing a language does not modify account permissions or commercial data.

## Validation

- `scripts/verify-studio-appearance.mjs`: backgrounds, Light/Dark, custom color, separate LIVE/AI persistence, palette independence, mobile bounds and STREAM drag to 4px.
- `scripts/verify-studio-mobile-dock.mjs`: logo-only dock and down arrow, persistence, mouse/touch movement and resizing, a single grip anchored after resize and scroll, friendly picker and flat X.
- `scripts/verify-studio-shell.mjs`: English default, successful boot/reload, utilities placement and collapse persistence, all three landscape images covering a wide screen in Light/Dark, resize controls on each main page, mobile bounds and no JavaScript errors.
- `scripts/verify-studio-popovers.mjs`: all four popups follow their own trigger before and after bar movement, compact mode remains draggable, desktop/mobile bounds and no JavaScript errors.
- Existing Studio desktop/atmosphere checks cover navigation, sounds and preservation/fit of the live game iframe.
- Unit tests cover account language isolation/offline retry and actual Studio startup milestones/fallback.

`npm.cmd test`: 188 tests passed. The browser checks listed above also passed against the isolated local preview, including the full desktop navigation/sound/game regression check.

## Floating panel corrections and workspace guide

STREAM panels now share the same sticky header layout and portal resize grip as page windows. The grip, colored icon, title and close button have separate space. Score/gifts/events use three responsive columns. Hidden sections no longer write zero-width geometry, and delayed saves cannot overwrite newer movements. Touch grips override ordinary button panning. Covered/closed panels do not leave resize controls over other windows.

Launching a game opens the Stream panel picker. Its old fixed editing action is replaced by the neutral **Save and profiles** button, opening a movable/resizable **Workspace layout** window with autosave status, immediate save and existing profile management. Admins retain the existing platform-default publication flow and server permission checks. Switching profiles applies the profile's panel visibility to the picker as well as the canvas.

`assets/studio-tour.js` replaces the old fixed-layout tour only in Studio. Ten contextual steps cover both floating docks, LIVE/AI navigation, catalog, panel selection, movement/resizing, layout saving, sounds and animations. A transparent backdrop and very light surrounding shade preserve visibility. Completing or dismissing the tour restores the previous page, selected panels, layout and dock state; the game iframe remains mounted. The tour does not connect LIVE, generate AI or purchase credits.

The sidebar logo is removed; a compact dotted grip remains visible in expanded and collapsed modes. The bottom-right signature reuses the homepage wordmark with **STUDIO** below, without a tagline, year or background. The loading screen uses this single wordmark; Light mode has a neutral gray background. `assets/studio-app-icon.svg` provides the separate tab icon: a single white T with a brand-red accent. Public website branding is unchanged. The session inspector now scopes its labels to its own buttons, preventing it from accidentally replacing the loading wordmark.

Landscape wallpapers have separate Light/Dark tone filters, applied only to the artwork and its thumbnails, without a fog overlay. Studio windows use smaller theme-aware shadows than the global docks.

AI workspace state survives token refreshes and metadata updates of the same account. Account changes still clear private state. Unchanged subscription notifications no longer rebuild the generator; cached wallet reads restore the balance. The initial fetch uses quiet placeholders, and actual errors retain retry controls. The recurring workspace loading message is removed.

Additional verification: `scripts/verify-studio-stream-panels.mjs` exercises all nine STREAM panels, local mouse/touch resizing, close/reopen, header repaint, persistent dimensions and themed wallpapers. `scripts/verify-studio-layout-tour.mjs` checks launch/picker behavior, the layout manager, every tour target, transparent backdrop, restoration and iframe identity. `tests/animations-state-session.test.js` checks account refresh/cache isolation; the workspace renderer test checks the quiet initial fetch and preserves unavailable-service errors.

Preview locally with `npm.cmd run preview:studio` and open `http://127.0.0.1:3033/live-studio.html`. Browser checks use isolated loopback fixture data; no real payment, AI generation or LIVE session is started.
