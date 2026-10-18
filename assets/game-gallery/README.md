# Real game screenshots

These images are captured from the actual local games at a 540×960 CSS viewport
and 2× device scale. Native time/weather controls set each scene before capture.
The screenshots use the same viewport normalization as LIVE Studio, with its
external test controls hidden. No players, scores or interactions are fabricated.

Neon Race and Neon Riders: day, night, rain, winter, Christmas at night.
Country Derby: day, night, day rain, night rain; its current menu has no winter
or Christmas setting.

Full images are 1080×1920. Lightweight thumbnails are 360×640. `manifest.json`
records the selected time, weather and renderer classes for each full capture.

With the local server running on port 3000:

```powershell
node scripts/capture-game-gallery.mjs
node scripts/capture-game-gallery.mjs --verify
node scripts/build-game-presentations.mjs
```

The capture script uses installed Chrome with an isolated, headless profile under
the ignored `.tools` directory. `GALLERY_CHROME` can specify its executable path.
The verification checks all three galleries at desktop and phone widths,
including dialog navigation, keyboard wrapping, Escape and focus restoration.
The presentation builder preserves each page's game description and participation
details while applying `scripts/game-presentation.template.html`. Gallery thumbnails
select the large inline image; that image opens the full-size dialog. The main
catalog intentionally shows only the cover, summary and presentation link.
