# Frontend performance and deployment files

Homepage and Studio use `assets/utility.css`, generated from the existing
Tailwind configuration. They no longer download the browser compiler or scan
live DOM mutations to generate CSS. The design colors and utilities are unchanged.

When adding utility classes to HTML or JavaScript, run:

```sh
npm run build:css
```

Commit the generated CSS together with the source change. Vercel can continue
serving the existing static project; no new framework or deployment step is needed.

NOVA's HUD updates text and accessibility values only when they change. Font
fitting runs when the value, language or viewport changes. An empty gift feed
does not trigger layout measurements every frame. The game clock and mechanics
are unchanged.

## Deployment contents

`.vercelignore` excludes browser test profiles, reports, design references,
scripts, tests, SQL/Edge Function sources and original artwork source folders.
Processed artwork, original gift images, sound files, real games and server
modules remain included. Archived games remain in the repository.

Local audit on 2026-10-22, before cleanup/exclusions:

| Folder | Approximate size |
| --- | ---: |
| `assets` | 112.92 MiB |
| `GAME` | 67.51 MiB |
| `sounds` | 6.15 MiB |
| `GAME/*/art/source` (included in GAME above) | 57.37 MiB |
| `design-preview` | 11.54 MiB |
| `.tools` (local browser testing) | 5987.18 MiB |

These local numbers are not Vercel usage measurements. Deployment Storage
includes outputs retained from earlier deployments, as described at
https://vercel.com/docs/deployment-storage. Excluding files affects subsequent
deployments; it does not delete existing deployments or their historical usage.
Review older deployments and project retention settings separately. No remote
deployment or deletion is performed by these repository changes.
