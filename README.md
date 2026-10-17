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

## Leaderboard setup

1. In the Supabase project, open **SQL Editor** and run `supabase/leaderboard.sql`.
2. Sign in to TikInteract, enter the TikTok username, choose whether the profile should be public, and press **Salvează și caută poza**.
3. Start a LIVE connection from TikInteract. Session time and gift coin values received through the connector are saved to the public leaderboard.

The leaderboard is sorted by TikInteract gift-value points, then recorded LIVE time. Gift points are calculated from TikTok gift diamond values; they are activity points, not cash or withdrawable currency. The username and stats are public only when the account owner enables the public profile checkbox. Statistics count only sessions and gift events observed while connected through TikInteract. This first version is intended for community rankings, not prizes or payments; client-reported event totals are not tamper-proof.

TikTok usernames are entered by users and are not verified through TikTok OAuth in this version.
