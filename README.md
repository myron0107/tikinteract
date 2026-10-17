# TikInteract

## Local TikTok LIVE connector

The LIVE connector uses the unofficial `tiktok-live-connector` Node.js package (AGPL-3.0-only). It connects by creator username only; it does not request TikTok passwords or session cookies. As it relies on TikTok's undocumented LIVE interface, it may stop working if TikTok changes that interface. Review the package license and TikTok's terms before distributing or using this prototype commercially.

1. Install Node.js 20 or newer from [nodejs.org](https://nodejs.org/).
2. Open a terminal in this project folder and run `npm install`.
3. Run `npm start`.
4. Open `http://127.0.0.1:3000` and enter the username of a creator who is currently LIVE.
5. Press **Pornește Conexiunea Live**. Comments and gifts appear in the live feed and trigger game effects.

The local server listens only on `127.0.0.1`. Open the app through that local URL while the server is running; opening `index.html` directly or using the hosted static site will not connect to the local bridge.
