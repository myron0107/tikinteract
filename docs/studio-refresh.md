# Studio refresh on the restored version

Historical notes for the restored version. The subsequently approved public redesign, subscription tabs, footer Resources and selected velvet-black palette are documented in [approved-public-redesign.md](approved-public-redesign.md).

The restored website remains the source of truth. No V5 template files or demo scripts are loaded.

- Public navigation: How it works, Games, Pricing, Streams. Existing view content, pricing, original logo and animations remain native. How it works scrolls to the existing section. Open Studio uses the existing login/access check.
- Appearance: dark remains the original default; white/neutral Light Mode is independent, saved locally and synchronized between pages/tabs. No public layout redesign.
- Studio: narrow navigation, wider game/audio favorites on the left, real running iframe in the middle, native game controls and compact connection/counters on the right. Existing covers, searches, favorites, volume, game configuration, permissions and admin layout support remain available. The old default/published layout signatures are adapted to this requested placement; other explicit admin layouts remain respected.
- Portrait and landscape keep the current game document and native proportions. Landscape remains capped by the native 80% viewport scale. Desktop uses the viewport; mobile stacks the panels without overlaps.
- The LIVE events feed is removed from the visible Studio and its tutorial step, while native event handling, counters and game transport remain unchanged. Only tutorial copy changed in `game.js`; game engine files were not modified.
- Account uses actual profile, inbox and access state, with a compact profile and a ticket styled according to the owned plan. Help uses the original guided tutorial. Community and analytics use existing services and access rules.

Backups: `.tools/restored-version-backup/`. Screenshots: `.tools/studio-refresh-qa/`.

Validation: 111 unit/database tests passed. Browser verification covers visitor login, all Studio panels, saved modes, RO/EN, real Moto gameplay, format changes without reload, 320/390/768/1024/1280/1440/1920px, and explicit mobile visibility/non-overlap checks. The existing creator-platform browser QA passed with actual temporary PostgreSQL data, PRO community, analytics and all three real games in both orientations, with no JavaScript exceptions. No real LIVE, production database writes, deployment or Git push was performed.

The subsequent public-header cleanup removes account identity/menu, standalone login and the App dropdown from the public header. Open Studio retains the native visitor login flow. The notification bell appears exclusively in Studio and opens the existing official inbox. Its unread badge and mark-all-read action remain connected to the actual inbox service.

Appearance controls now follow palette → language → icon-only sun/moon → notifications in Studio. Public pages have language → sun/moon → Open Studio, with Burgundy fixed and no palette picker. Burgundy and Racing Blue are available only in Studio, independently of Light/Dark; public navigation preserves the saved Studio palette. Light Mode uses white and neutral surfaces with readable text across catalogs, resources, account, authentication, administration and game presentation pages. Navigation hover glow is removed in both modes.

The NOVA & VEX section has a short natural description in RO/EN. Its phone preview contains only the original animated canvas, fallback artwork and an accessible pause/play icon; overlay titles, height, gift receipts and demo labels are removed. Original Nova animation rendering and the original homepage racing animation are preserved.

Additional browser QA: public views, resource menu, login, Studio panels in all four appearances, saved preferences, administration tabs, informational/game pages and mobile widths 320/390/768px. Screenshots and contrast diagnostics are in `.tools/appearance-polish/`; the repeatable local QA script is `scripts/verify-appearance-polish.mjs`.
