# TikInteract

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

- The home page introduces TikInteract, highlights the three available games, and displays the all-time top 10 from the public streamer leaderboard.
- The featured games link to their presentation pages. Use **Începe un LIVE** to open the in-page LIVE setup.
- The top 10 is loaded from Supabase using the same `get_streamer_leaderboard` RPC as the full leaderboard.

## Game catalog and LIVE games

- The **Jocuri** menu is a catalog: each game card opens a presentation page with screenshots and instructions, not the playable game.
- To play, sign in, open **LIVE**, select Neon Race, Neon Riders, or Country Derby, and the selected game loads inside the TikInteract page. Leaving LIVE unloads the embedded game.
- The game files are kept separately in `GAME/NEON-RACE/`, `GAME/NEON-RIDERS/`, and `GAME/COUNTRY-DERBY/`.
- The embedded games retain their original TikFinity Desktop connection. Start TikFinity on the same computer and use the game's **CONNECT** controls; the game WebSocket uses `ws://localhost:21213/`.
- Country Derby supports `RED`, `BLUE`, and `GREEN` team chat commands. Neon Race and Neon Riders support `RED` and `BLUE`.

## Leaderboard setup

1. In the Supabase project, open **SQL Editor** and run `supabase/leaderboard.sql`.
2. For rolling period leaderboards, also run `supabase/leaderboard_periods.sql` in **SQL Editor**.
3. Re-run `supabase/leaderboard.sql` to publish existing saved profiles automatically and make future profiles public by default. TikTok usernames, profile photos, and leaderboard statistics will be publicly visible.
4. Sign in to TikInteract, enter the TikTok username, and press **Salvează și caută poza**. The profile is published automatically; no checkbox is required.
5. Start a LIVE connection from TikInteract. Session time and gift coin values received through the connector are saved to the public leaderboard.

The leaderboard offers all-time, last 24 hours, 7 days, and 30 days views, sorted by TikInteract gift-value points and then LIVE time within the selected period. Recent-period LIVE time is calculated from the overlap of recorded sessions with the selected time window; gift points use events received in that window. Gift points are calculated from TikTok gift diamond values; they are activity points, not cash or withdrawable currency. Statistics count only sessions and gift events observed while connected through TikInteract. This first version is intended for community rankings, not prizes or payments; client-reported event totals are not tamper-proof.

TikTok usernames are entered by users and are not verified through TikTok OAuth in this version.
