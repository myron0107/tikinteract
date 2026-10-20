# Creator workspace update

Run `creator-update.sql` once in Supabase → SQL Editor → Run. It combines Community PRO, private Analytics, and the official site inbox. It is safe to run again.

The update also adds `streamer_live_sessions.current_game` when upgrading an older installation. Historical sessions without a recorded game remain unselected; their balances, timestamps and gift records are preserved. If an earlier run failed on this missing column, rerun the complete updated `creator-update.sql`.

The existing `admin.sql`, `support.sql`, `access-keys.sql`, `leaderboard.sql`, `leaderboard_periods.sql`, `tiktok_gifts.sql`, and `users.sql` must already be installed. Keep the existing verified TikTok profile migration too. No new client keys or secrets are needed.

Community requires a confirmed, allowed account with an active PRO grant. Messages and analytics are available only through authenticated RPCs. Direct conversations are restricted to their participants. Staff site messages are sent from Administration → Team and roles → select a user → Send site message.

Analytics records real LIVE events and a heartbeat for new sessions. Missing audience data from old sessions stays unknown. The Streams directory stops marking an unresponsive session LIVE after two minutes. Existing gift balances and totals are preserved.

Games load only after selection. The arena supports portrait 9:16 and landscape 16:9 without reloading the iframe. New game integrations can import `assets/game-format.js` and read `gameSize()` or listen for `tikinteract:game-format`.

Validation: `npm test`; browser integration with disposable PGlite data: `MEDIA_ROOT=http://127.0.0.1:3000 node scripts/verify-creator-platform.mjs` (PowerShell: set `$env:MEDIA_ROOT` first). No production users, messages or live connections are used by this check.
