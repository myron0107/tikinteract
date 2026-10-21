# Approved compact public redesign

This update decorates the existing HTML/CSS/JavaScript application. It does not replace Supabase, account verification, access control, the TikTok connector, game engines, events, audio services or admin configuration.

## Public website

- Header: approved TI/LIVE symbol and `TikInteract` vector wordmark, Games / Streams / Leaderboard, language, mode and authenticated Open Studio entry.
- Homepage: three-game Canvas reel, three published games, three setup steps, shared metallic subscription tickets and two expandable questions. Previous promotional blocks are removed from this page; the games and services remain available.
- Streams: actual directory RPC, creator search and game filters; direct TikTok links without revenue counters on creator cards. Recent streams remain available.
- Leaderboard: actual period-based RPC, 2–1–3 podium, searchable table beginning at fourth place when no search is active. Gift collections remain connected to their original service.
- Footer: red Resources menu containing guides, updates, about, support, privacy and terms. Cookie/storage preferences remain separate. Duplicate footer links are removed.
- Anonymous visitors see the original login modal when opening Studio or choosing a paid ticket. The selected subscription is carried through email login and the existing OAuth return flow.

## Studio account

Profile, subscription, official site messages and security have separate tabs. The subscription screen uses the same ticket component as the homepage, real configuration prices and features, server-verified access periods, future scheduled access and the existing access-key redemption RPC. Redeeming a key preserves the result message while access is refreshed. Duplicate redemption does not add time twice. Key drafts are cleared on account changes.

The existing Studio workspace, games, gifts, audio, analytics, community, official inbox and staff-only admin entry remain native. Games do not automatically start. Switching 9:16 / 16:9 retains the running game document.

## Appearance and branding

The user selected Dark option A: background `#101014`, panel `#18181E`, raised element `#202027`. Light stays white with neutral surfaces. Public pages always use Burgundy. Only Studio exposes Burgundy / Racing Blue; the mode is independent of the accent choice, and preferences persist between pages/tabs.

The active identity is the user-approved TI / LIVE signal monogram and TikInteract wordmark, supplied as seven native SVG variants for light/dark, symbol-only, horizontal, stacked and app-icon use. The public website uses symbol + text; Studio displays only the new symbol in the sidebar. See `docs/branding.md` for active assets and validation. Earlier proposals are preserved as unused references.

## Validation

- 114 automated unit/database tests pass, including existing LIVE normalization, game mechanics, access keys, verification and user-role enforcement.
- `scripts/verify-approved-public.mjs`: real disposable PostgreSQL migrations, LIVE directory/ranking fixtures, search, periods, original logo/wordmark, Resources dialogs and support, RO/EN menu, 320/390/768/1440px, public Light/Dark and all four Studio appearances, guest ticket/login return, actual key redemption and duplicate protection, official inbox/admin entry, native Moto in both orientations and zero JavaScript exceptions.
- `scripts/verify-appearance-polish.mjs`: public pages, resources, login, all Studio sections, saved preferences, administration sections and individual game/information pages; desktop and mobile checks after the selected Dark palette was applied.
- Local review artifacts: `.tools/approved-redesign-qa/` and `.tools/appearance-polish/`. Color comparison: `design-preview/dark-palette/index.html`.

No production database writes, real LIVE sessions, account emails, deployment, commit or push were performed. Card payments are still explicitly marked as upcoming and require a separate payment-provider integration. No new database migration is required for this interface update.

Before-change UI backup: `.tools/approved-redesign-before/source-ui.zip` and `.tools/approved-redesign-before/working-tree.patch`. These contain no environment secrets. Earlier work in the working tree is retained.

## Menu/theme follow-up

`assets/overlay-theme.css` centralizes surface, text, field, selection, focus and backdrop colors for the existing Resources, Support and private conversations, TikTok gift catalog/collections, language picker, cookie preferences, login, guided tutorial and image gallery. It loads after existing page styles and uses scoped selectors so lazily loaded support styles cannot restore hard-coded dark surfaces. Burgundy/Blue remain independent of Light/Dark. Original gift artwork and backend behavior are preserved.

`scripts/verify-overlay-themes.mjs` checks native components against temporary PostgreSQL support conversations and gift collection data, with text contrast at least 4.45:1 in the audited states, mode switching without lost drafts, both Studio accent palettes, guest menus, RO/EN, desktop and 320/390px mobile layouts. Reports/screenshots: `.tools/overlay-themes/`. It also verifies the reduced homepage separators and compact footer, with copyright aligned left beneath the logo.

Homepage separators now remain only under the header, around How it works, and above the footer. The footer uses less padding while retaining readable labels. The final selected symbol is documented above.

## Studio message center

The account Messages tab now reuses the native `SupportInbox` component from the Support dialog: search, filters, private conversation list, thread, replies and mobile back navigation. The official site inbox is now available only in a compact dropdown anchored below the Studio bell. It retains unread counts, all/unread filters, expandable notices and mark-read actions. The account Messages tab contains only Support conversations. Support notification actions open the associated account conversation. The dropdown closes via its close button, outside click or Escape, and fits within mobile viewports. New message opens the existing support composer. Both entry points use the same backend conversations and replies, with no additional migration.

`assets/account-support.js` handles the Studio host, visibility, identity changes and RO/EN interface copy. User-written subjects/messages are never translated. Rebuilding account labels on language changes retains the same conversation DOM, unsent reply and focused field. Distinct reply-field IDs allow the Studio inbox and Support dialog to coexist. Sign-out/account changes destroy the old inbox, clear drafts and discard old requests.

`scripts/verify-account-support.mjs` passed with a disposable PostgreSQL backend: shared replies across Studio/dialog, duplicate protection, site notifications/bell, RO/EN without translating private content, draft/focus preservation, both accents and modes at 1440/768/390/320px, delayed requests during account changes and zero runtime exceptions. The full 114-test suite also passed after integration.

## Compact gifts and notification follow-up

The gift page retains its original full width. Only the gift grid is constrained to 640px, with four desktop/tablet columns and two phone columns. Gift cards are square, with 44px original artwork on desktop and 32px on phones. Per-card background/border transitions and image drop shadows were removed. Offscreen cards use CSS content visibility. Appearance changes remain pure CSS: a browser check with 120 catalog cards confirms no card reconstruction and no gift-card animations during all four appearances. Search and pagination remain native.

The 114-test suite, `verify-account-support.mjs`, `verify-header-notifications.mjs` and `verify-overlay-themes.mjs` passed after moving notifications. `scripts/verify-gift-appearance.mjs` covers compact dimensions, all four appearances, responsive layouts, search/pagination and DOM preservation. No backend migration or production writes are required.

## Navigation and spacing follow-up

The public header is aligned to the page content and footer, including responsive margins. Studio uses the full available width, with 18px desktop column gaps and 24px on large screens. The gift catalog page/tab was removed from Studio only; gift recording and triggers remain unchanged. My Account, Help and Community follow Back to site in the lower rail, while the existing profile avatar appears to the right of the notification bell. All navigation uses the native tab logic.


## Notification preview and homepage order

The homepage now places How it works immediately after the hero, followed by Choose your game. Both sections retain their existing content, links and RO/EN copy.

The Studio bell uses a preview list with an individual dismiss X at the upper right of each notice. All/unread filters, mark-all and history pagination are omitted. Opening a preview keeps it available until dismissal. Dismissing uses the existing authenticated mark-read RPC and the dropdown queries only pending notices, so removals persist across reloads/devices without a new migration. Previously read notices no longer appear. The latest 20 pending notices are shown; dismissing one refills the list from the server. Support conversations remain in My Account, and a later staff reply creates a fresh preview. Failed dismissals retain the item and show the error.

Verified against a disposable PostgreSQL database: previews, failure recovery, persistence after refresh/reload, refill, badge clearing, new support replies, support links, RO/EN, Light/Dark, desktop/mobile bounds and homepage order. Creator service database tests also pass.

The STREAM connection badge now uses a red/green pulsing dot driven by the native `is-connected` state, with readable light/dark status colors and reduced-motion support. Orientation controls show phone/desktop icons only; translated RO/EN accessible labels and hover titles retain 9:16 / 16:9. The native orientation handlers and live connection logic are unchanged.


## Simplified connection card and compact public gifts

The TikTok LIVE card shows its heading and profile-options ellipsis, with username and Connect on one row. The native save/reset/profile controls are grouped in the collapsed options area. Idle connection text is omitted because STREAM already shows the status badge; verification and error messages remain visible. Existing element IDs, connection handlers and stop behavior are retained, with localized labels.

After Choose your game, the homepage now shows six original gifts from the bundled catalog and View catalog. This reuses `home-gifts.js` with a compact, static preview mode and its existing searchable, paginated dialog. No slideshow runs in compact mode. The catalog is available without logging in; dialog colors follow the page theme, and theme changes retain the rendered card DOM. Six columns on desktop become three on phones; the full dialog uses four/three columns.

Verified in local browsers: real artwork loading, section order, search by gift ID, empty results, pagination, dialog closing/focus restoration, RO/EN, Light/Dark, desktop/phone layout and preservation of catalog DOM when themes change. Connection controls retain their native action handlers; no actual TikTok connection was opened.


## Restored gift showcase

The supplied reference supersedes the static six-card preview above. After Choose your game, the homepage again has left-hand copy and the original animated gift carousel on the right. The block is capped at 1080px, the featured image is 124px and the carousel is approximately 387px high on desktop, with smaller mobile artwork. Play/pause, previous/next, thumbnail selection and the progress strip remain; playback pauses offscreen, on hover/focus, while the catalog is open and for reduced-motion preferences. Copy and controls are localized in RO/EN.

The catalog is now up to 900px wide, with six desktop, four tablet and three phone columns. Its scrolling content is inside a clipped rounded dialog frame, retaining rounded corners around the wider scrollbar. Search focus uses a neutral border without the former red outline/shadow. Search, pagination, close/focus restoration, original gift images, theme-preserving DOM, autoplay and manual carousel controls were verified locally across Light/Dark and responsive widths.


## Phone presentation, latest release and shared focus

The main three-game reel is displayed in a portrait phone frame. Its canvas is 540 x 960, with a matching poster. The racing preview camera keeps both teams visible at their original proportions; the Nova presentation uses its portrait world. This changes only promotional rendering, with no playable iframe, LIVE connection or game-rule changes. Hero copy is grouped closer to the phone on desktop and centered above it on mobile.

A centered introduction with the supplied headline and two desktop side labels appears before the hero. The public header/footer wordmark is native Inter text, TikInteract without the trailing dot, with the supplied English tagline underneath. The Studio symbol remains unchanged.

The public Games view has a compact New in the catalog panel before Available games. It presents the newest published game, starting with the original Nova cover and Canvas trailer, and excludes drafts/disabled games. Optional publishedAt metadata is added by the existing Admin editor at first publication and preserved on edits/reactivation. Selection remains stable when dated games are reordered. Existing undated games fall back to catalog order. Future games without a trailer use their real cover and description. The panel retains its native presentation links; the smaller mobile version shows the name, description, cover and trailer.

`assets/focus.css` is shared by all 15 current interface pages, including game presentation pages, Admin, auth, Support and dynamic dialogs. Pointer focus has no colored outline/shadow; keyboard controls retain a thin neutral indicator, while fields/search wrappers use a neutral border. Game runtime documents and validation messages are untouched. The Sound Pad navigation icon is now a native vector controller with four pads and three knobs.

Verified: all three phone scenes and pause/play; newest-release selection and fallback, draft/disabled exclusion, metadata preservation, real Nova trailer; text wordmark/font loading; centered intro; all existing major views, auth, Support, game presentations, Admin and Studio focus styles; Light/Dark, both Studio accents and RO/EN; responsive widths 320 through 1440px. Unit/database checks for routing, admin configuration and publication metadata pass. No production writes, migration or deployment were performed.
