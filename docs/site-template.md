# Website and standalone LIVE Studio

The public site remains in `index.html`; the workspace is now physically separate
in `live-studio.html`. The public page no longer includes the game iframe, Studio
controls, game library, soundboard or tutorial. It also no longer opens the local
WebSocket or creates the sound players during startup.

`assets/site-template.css` defines the new red/black/white website design, using
Inter for headings and body text and preserving the logo's Oxanium lettering.
The original `assets/home-showcase.js` Canvas animation is unchanged.
Game screenshots are arranged as wide previews with descriptions below.
The homepage retains the real all-time top-five community ranking.

The header has five icon navigation items: Acasă, Jocuri, LIVE Studio, Clasament
and Play Pass. LIVE Studio and the hero's **Deschide LIVE Studio** entry appear
only after sign-in and open `live-studio.html`. The hero's separate
**Download App** link scrolls to `#download-app`, where the desktop download button
is visibly marked as coming soon and disabled until an installer is available.
The app download section remains visible to visitors; no installer or release date exists yet.

## Studio shell

`assets/studio-app.css` supplies the standalone application's layout:

- Fixed navigation rail for Studio, Game Center, Audio Center and the tutorial.
- Game favorites and the existing open test controls on the left.
- Game preview in the middle; connection, quick audio and session activity on the right.
- A height-aware desktop preview, with existing native game dimensions and a maximum 80% scale.
- Horizontal navigation and stacked controls on narrow screens.

The game engine, SDK, access checks, sound library, favorites storage keys, scoring
and LIVE connection behavior remain shared with the existing implementation.
`game.js` initializes the connector, favorites and audio only when Studio is present
and an account is signed in. Signing out unloads the game and stops local audio.
The tutorial feed target follows its new location beside connection/audio controls.

## Routes and authentication

`assets/site-app.js` is the extracted shared authentication and navigation runtime.
There is one copy of the Supabase setup and account behavior for both pages.
The public project URL and anon key are shared through `assets/supabase-config.json`;
this file contains no administrative/service-role credential.

- `live-studio.html?game=moto-interact` is still a supported Studio destination;
  it waits for an explicit game selection instead of starting the URL's game.
- Old `index.html?view=live&game=...` links require sign-in before redirecting.
- Public `?view=catalog`, `?view=leaderboard`, `?view=play-pass` and `?view=account`
  routes work without Studio DOM; account access still requires sign-in.
- Studio's account/site links return to the public page instead of hiding the app.
- Studio opens with an empty arena and no game iframe source, including reloads,
  sign-in returns and old game-specific links. A game starts only when the user
  selects it from favorites or Game Center. Existing favorites still persist.
- Google OAuth retains the Studio return destination through the existing root
  callback and return storage, without starting a game after sign-in.
- Paid games keep their existing unavailable state until billing is configured.
- Direct Studio URLs show an account gate while signed out, even after closing the
  sign-in dialog. No game or local WebSocket is started until sign-in.
- Every local WebSocket command carries the account access token. The local server
  validates it with Supabase Auth before handling commands or sharing LIVE events;
  missing, invalid, expired and anonymous credentials are rejected. Session refresh
  updates the token used by subsequent commands.

`server.js` allows the standalone HTML route. No hosting or desktop deployment was performed.

## Verification

```text
npm test
node scripts/verify-site-template.mjs
node scripts/verify-moto-interact.mjs
```

The template browser check uses isolated in-memory authentication and WebSocket
fixtures, and covers signed-out entry hiding, direct URL gates, sign-in/sign-out,
the public navigation, live homepage animation,
direct Studio Browser links, physically separate Studio, game selection, audio library,
tutorial, laptop preview fit and legacy deep links at desktop/mobile widths.
The Moto check also exercises real Studio-to-game SDK chat, likes and gifts with
synthetic local events. Neither opens a real TikTok LIVE connection.
