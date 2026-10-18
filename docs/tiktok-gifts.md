# TikTok Gifts

The standalone Studio opens TikTok Gifts on **Toate cadourile**, with additional
**Colecție**, **Recente** and **Cele mai valoroase** views. A **Cadouri** button beside
each streamer in the main and homepage leaderboards opens their collection dialog.
The collection belongs to the receiving streamer, not to the sender.

## Catalog and artwork

`lib/tiktok-gift-source.js` reads TikTok's public `/webcast/gift/list/` route using
the installed connector's normal HTTP parameters. No username, room or running
LIVE is required. The complete imported response supplies IDs, names, values
and original TikTok CDN URLs. Exact duplicate IDs are merged.

`npm run sync:tiktok-gifts` refreshes `assets/tiktok-gifts-catalog.json` and copies
the original image bytes to `assets/tiktok-gift-images/`, named by SHA-256.
The initial import contains 792 unique gifts from 796 TikTok records, all with
original images (774 distinct image files, approximately 6.7 MB total). No images
are generated, recolored or substituted. Original CDN alternatives remain available
if a local image cannot load. Collection cards also use the catalog when events
arrive without their image, and show the account's cumulative received quantity.

The bundled list works immediately, even with no LIVE or previously received
gifts. Manual updates and the six-hour server cache retain the last valid catalog
if TikTok is temporarily unavailable. Additional room-specific gifts are merged
without dropping the complete catalog. Availability can vary by region/event;
the imported response is not a claim that every seasonal gift is simultaneously
available to every TikTok account. The default region is RO, configurable via
`TIKTOK_GIFT_REGION`. Search, sorting and pagination run locally with 60 gifts per
page and lazy image loading; all imported gifts remain reachable.

Sources: [connector documentation](https://github.com/zerodytrash/TikTok-Live-Connector#retrieve-available-gifts),
[TikTok Gifts](https://support.tiktok.com/en/live-gifts-wallet/gifts/gifts).

## Counting and persistence

The normalizer includes real gift metadata and accepts only the final event of a
repeatable streak. Duplicate upstream message/streak IDs are discarded before
broadcast. The UI stores normalized events with the same event UUID:

- One gift costing 10 coins adds **1 received item and 10 coins**.
- A final streak of 10 gifts costing 10 coins each adds **10 items and 100 coins**.
- Received quantity, unit value and total coin value stay separate.
- Streamer ledgers and pending sync queues are separate by receiving TikTok username.
- Recent history shows the last 30 received events; aggregate totals preserve all
  locally recorded items, independent of that display limit.
- The collection works without a game loaded. TEST MENU game simulations do not
  add gifts to real streamer collections.

`assets/tiktok-gifts-data.js` contains shared normalization and aggregation;
`assets/tiktok-gifts.js` owns the collection UI, browser ledger and sync outbox.
Writes wait for the authenticated platform LIVE session. Session finish drains
pending writes before closing that session. Offline metadata stays queued.
The connected TikTok username is linked automatically to the signed-in account
before starting that platform session; no separate save-profile click is required.
An existing matching profile keeps its display name and avatar.

## Required Supabase activation

Run **`supabase/tiktok_gifts.sql`** in the existing project's Supabase SQL Editor,
after the existing leaderboard scripts. It is additive and rerunnable. The patch
was verified in isolated PostgreSQL. The user has applied it to the configured
hosted project, and its public getter was verified to return HTTP 200.

The migration provides:

- Private `streamer_gift_collection_events`, keyed by event UUID.
- Authenticated `record_my_live_gift_details(...)`, validating ownership of the
  receiving username and recording the existing leaderboard total in the same transaction.
- `get_streamer_gift_collection(username)`, exposing public-profile collections
  and allowing owners to read their own private collection.
- No direct anonymous/authenticated writes or reads of the raw event table.

Until activation, new items remain on the receiving device and the existing
leaderboard coin RPC still records known coin totals. Once activated, retrying
the metadata enriches the same UUID without adding coins twice, even when the
original recorded LIVE session has ended. Other viewers need the migration to
see public collections across devices. Existing historical coin totals cannot
reconstruct gift IDs, images, quantities or senders and are not backfilled.

## Verification

```text
npm test
node scripts/verify-tiktok-gifts.mjs
node scripts/verify-gift-schema.mjs
```

The optional schema check uses `@electric-sql/pglite` installed only in ignored
`.tools/gifts-db-check`; its installation command is at the top of the script.
It checks migration/rerun, quantities, coins, UUID deduplication, late enrichment,
streamer separation and public/private/owner permissions against isolated PostgreSQL.

The Chrome check uses clearly marked TEST fixtures and a local in-memory RPC stub
in an isolated profile. It verifies 1440/390px layouts, all views and filters,
missing-schema fallback, queued metadata replay, profile dialog, reload persistence
and that no game starts. It never opens a real TikTok connection or writes a real
Supabase profile/statistic. Screenshots go to ignored `.tools/tiktok-gifts/`.
