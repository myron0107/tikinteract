# TikInteract

The public website is `index.html`; the standalone workspace is
[`live-studio.html`](live-studio.html). The homepage includes one **LIVE Studio**
navigation entry, shown only to signed-in accounts, and retains the animated game showcase.
Direct Studio access requires sign-in; local LIVE commands are verified with Supabase Auth.
See [template, routes and verification](docs/site-template.md).

**TikTok Gifts** adds a live-synced gift catalog and a received-gift collection per
streamer, including recent/high-value gifts and profile collection buttons.
Public cloud collections require the additive
[`supabase/tiktok_gifts.sql`](supabase/tiktok_gifts.sql) migration; until activated,
new collection metadata remains on the receiving device. See [setup and verification](docs/tiktok-gifts.md).

## Local TikTok LIVE connector

The LIVE connector uses the unofficial `tiktok-live-connector` Node.js package (AGPL-3.0-only). It connects by creator username only; it does not request TikTok passwords or session cookies. As it relies on TikTok's undocumented LIVE interface, it may stop working if TikTok changes that interface. Review the package license and TikTok's terms before distributing or using this prototype commercially.

1. Install Node.js 20 or newer from [nodejs.org](https://nodejs.org/).
2. Run `start-tikinteract.bat`. It installs dependencies on first run and starts the local server.
3. To use the local app directly, open `http://127.0.0.1:3000`.
4. To use the deployed Vercel page, keep the local server running on the same computer, open `https://tikinteract.vercel.app/`, enter the username of a creator who is currently LIVE, and press **Pornește Conexiunea Live**. The page stays open and connects to the local server in the background.
5. Comments and gifts appear in the live feed and trigger game effects.
6. When TikTok includes avatar URLs in the LIVE room and events, the connected streamer and chat participants appear with their profile photos; otherwise the UI uses initials.
7. **Salvează și caută poza** can load the streamer profile photo even before connecting to a LIVE stream.

The local server listens only on `127.0.0.1` and accepts WebSocket requests from the local app and `https://tikinteract.vercel.app/`; the browser must be on the same computer as the server. Keep its terminal window open while streaming. Opening `index.html` directly or using the hosted site without first starting the local server will not connect.

## Home page

- The home page introduces TikInteract, highlights the free Neon Interact, Moto Interact and NOVA & VEX games, and displays the all-time top five from the public streamer leaderboard.
- NOVA & VEX has a generated cover and animated Canvas presentation on ACASĂ. The original road animation is preserved. Configure its gift-to-action bindings in Studio → TEST MENU → Cadouri LIVE. [Game details and checks](GAME/NOVA-VEX/README.md).
- The featured games link to their presentation pages. Use **Deschide LIVE Studio** to open the separate workspace page.
- The top five is loaded from Supabase using the same `get_streamer_leaderboard` RPC as the full leaderboard.
- The footer links to the privacy policy, terms of use, usage guide, and updates; **Cookie preferences** explains the browser storage currently needed by the app.

## Game catalog and LIVE Studio

- The **Jocuri** menu is a catalog: each game card opens a presentation page with screenshots and instructions, not the playable game.
- To play, sign in, open **LIVE Studio**, select Neon Race, Neon Interact, Moto Interact, Neon Riders, or Country Derby, and the selected game loads inside the TikInteract page. Leaving LIVE Studio unloads the embedded game.
- **Neon Interact — Night Run** uses the homepage animation's night city and track, with neon car lighting, two teams, nitro and the shared Studio test controls. See [game rules and verification](docs/neon-race2.md). Its files are in `GAME/NEON-INTERACT/` and `assets/neon-race2*`.
- **Moto Interact — Day Ride** is a separate daylight motorcycle version with newly generated scenery and red/blue rider sprites. Nitro raises the front wheel around the grounded rear tire; fading speed lowers it smoothly. See [gameplay and verification](docs/moto-interact.md). Files: `GAME/MOTO-INTERACT/` and `assets/moto-interact*`.
- The game files are kept separately in `GAME/NEON-RACE/`, `GAME/NEON-RIDERS/`, and `GAME/COUNTRY-DERBY/`.
- Game artwork is stored in `assets/game-media/` as content-addressed, lossless WebP images. Include this folder when copying or deploying the games. The local server caches these immutable images for reuse when switching games; the HTML and scripts remain uncached. Game readiness does not wait for all image downloads.
- **Pornește Conexiunea Live** is the single LIVE connection for the site and its embedded games. Comments, batched likes, and completed gifts are sent automatically to the selected game. TikFinity is not required inside LIVE Studio. The games keep their optional TikFinity controls when opened separately.
- Games added in the future can use the same connection by including the shared SDK and registering their handlers; see [the game integration guide](docs/game-live-api.md). Existing games retain their own team selection, scoring, speed limits, and ranking rules.
- Country Derby supports `RED`, `BLUE`, and `GREEN` team chat commands. Neon Race and Neon Riders support `RED` and `BLUE`.
- **Audio Center** is available as a tab inside LIVE Studio with 52 sound effects and 4 music buttons, search, category filters, and favorites. The LIVE Studio Favorite audio area also has a quick search to add sounds to favorites without opening Audio Center. Both areas have an **Oprește sunetele** button and a volume slider; the sliders stay synchronized. Up to 12 sounds can be favorited; adding another is blocked with an on-screen notification until one is removed. Favorites are saved in the browser and shown as playable cards under the LIVE connection button and in the soundboard's Favorites filter. The integrated files are in `sounds/` and are served by the local app.
- Audio Center playback is browser audio. Include desktop/browser audio in your streaming software or audio routing for viewers to hear it. Verify that audio files included in a public deployment are licensed for redistribution.

## Leaderboard setup

1. In the Supabase project, open **SQL Editor** and run `supabase/leaderboard.sql`.
2. For rolling period leaderboards, also run `supabase/leaderboard_periods.sql` in **SQL Editor**.
3. Re-run `supabase/leaderboard.sql` to publish existing saved profiles automatically and make future profiles public by default. TikTok usernames, profile photos, and leaderboard statistics will be publicly visible.
4. Sign in to TikInteract, enter the TikTok username, and press **Salvează și caută poza**. The profile is published automatically; no checkbox is required.
5. Start a LIVE connection from TikInteract. Session time and gift coin values received through the connector are saved to the public leaderboard.

The leaderboard offers all-time, last 24 hours, 7 days, and 30 days views, sorted by TikInteract gift-value points and then LIVE time within the selected period. Recent-period LIVE time is calculated from the overlap of recorded sessions with the selected time window; gift points use events received in that window. Gift points are calculated from TikTok gift diamond values; they are activity points, not cash or withdrawable currency. Statistics count only sessions and gift events observed while connected through TikInteract. This first version is intended for community rankings, not prizes or payments; client-reported event totals are not tamper-proof.

TikTok usernames are entered by users and are not verified through TikTok OAuth in this version.
