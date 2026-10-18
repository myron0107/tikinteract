# Add a game to TikInteract LIVE Studio

LIVE Studio owns the TikTok connection. Games receive version 1 events through
the shared same-origin SDK. They do not need TikFinity, a TikTok login, or their
own WebSocket. The server and browser host have no per-game event routing code.

Include the SDK after the game's scripts (adjust the relative path if needed):

```html
<script src="../../assets/game-live-sdk.js?v=1"></script>
<script>
TikInteractGame.register({
    viewport: {width: 540, height: 960}, // Native game resolution; Studio fits it to the screen.
    onChat(event) {
        // event.username, event.message — choose teams using your own rules.
    },
    onLike(event) {
        // event.username, event.likeCount — this is a batch, not a cumulative total.
    },
    onGift(event) {
        // event.username, event.diamondCount, event.repeatCount, event.coins.
        // Called once per completed streak; never multiply coins by repeatCount.
    },
    onStatus(state) {
        // state.connected, state.connecting, state.username, state.sessionId.
    }
});
</script>
```

`onEvent(event)` can replace the three typed callbacks. If both are provided,
the typed handler is used for its event type, avoiding double processing.
`viewport` is optional and defaults to 540×960. Landscape games can declare, for
example, 1280×720. Studio displays the complete viewport at 80% of its native
size, reducing it further only when the available width is smaller. The embedded game should fit its own viewport without
fixed minimum sizes that exceed it. Existing racing games use `game-viewport.js`
to normalize their legacy layouts; standalone pages keep their original layout.
Each event also has `type`, an opaque UUID `eventId`, `sessionId`, `timestamp`,
and `displayName`. Gifts include `giftId`, `giftName`, `giftType`, and
`repeatEnd: true`. Unknown gift values use zero coins; do not treat points as money.

Keep game mechanics inside the game. For example, a racing game should ignore
points from viewers who have not selected a team. Switching games does not copy
team membership. The three bundled games use `legacy-game-adapter.js` to map
these events into their existing scoring and ranking code.

Add the game to `LIVE_GAME_PATHS` and the game catalog/selector in `index.html`.
Add its HTML path to `STATIC_FILES` in `server.js`. The shared bridge automatically
uses the SDK handshake for the newly selected iframe. Games must be served on
the same origin as the site. Unsupported games do not receive events until they
include the SDK and register handlers; this is not an automatic adapter for arbitrary HTML.

The protocol checks parent/frame identity, origin, version, and a fresh navigation
token. Both ends deduplicate event IDs. Events from another session or from a
disconnected stream are ignored. Up to 250 events received while a game loads
are queued for at most five seconds and are discarded on navigation or a session
change. Events received with no active game are not replayed later.

The host adds a `tikinteractHost` query parameter to the iframe URL. The SDK uses
it to announce readiness as soon as callbacks are registered, without waiting
for the window's image-loading event. Keep that query parameter intact if your
game changes its URL before registration. Media assets should use stable URLs
so browser caching remains effective across game switches.

Run `npm test` (or `npm.cmd test` in Windows PowerShell) for normalization,
handshake, delivery, deduplication, session isolation, and all three game adapters.
Restart the local Node server after server-side changes, then reload the browser.
