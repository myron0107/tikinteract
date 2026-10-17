# TikInteract

## Local TikTok LIVE connector

The LIVE connector uses the unofficial `tiktok-live-connector` Node.js package (AGPL-3.0-only). It connects by creator username only; it does not request TikTok passwords or session cookies. As it relies on TikTok's undocumented LIVE interface, it may stop working if TikTok changes that interface. Review the package license and TikTok's terms before distributing or using this prototype commercially.

1. Install Node.js 20 or newer from [nodejs.org](https://nodejs.org/).
2. Run `start-tikinteract.bat`. It installs dependencies on first run and starts the local server.
3. To use the local app directly, open `http://127.0.0.1:3000`.
4. To use the deployed Vercel page, keep the local server running on the same computer, open `https://tikinteract.vercel.app/`, enter the username of a creator who is currently LIVE, and press **Pornește Conexiunea Live**. The page stays open and connects to the local server in the background.
5. Comments and gifts appear in the live feed and trigger game effects.

The local server listens only on `127.0.0.1` and accepts WebSocket requests from the local app and `https://tikinteract.vercel.app/`; the browser must be on the same computer as the server. Keep its terminal window open while streaming. Opening `index.html` directly or using the hosted site without first starting the local server will not connect.
