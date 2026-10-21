# TikInteract — logo 01, vector delivery

Final active assets: assets/tikinteract-wordmark-01-light.svg and assets/tikinteract-wordmark-01-dark.svg. Each is approximately 14KB and contains vector paths only, with no embedded raster image or runtime font dependency. They use the project's licensed local Inter glyph outlines (800 for tik, 650 for interact), a burgundy first i dot and a red period/LIVE arc. The SVG reconstruction replaces the damaged generated PNG for clean rendering at any scale.

The full wordmark appears on the public website, footer, game presentation/info pages, administration and Support. The Studio top-bar logo has been removed entirely at the user's request. Studio keeps only its enlarged red sidebar symbol (60px desktop, 46px mobile). The top-bar section label returns to its prior left alignment; existing workspace grid, panel widths and page structure are unchanged.

Verified at 1440/768/390/320px in Light/Dark: no horizontal overflow and no JavaScript exceptions. At 1440px the Studio grid remains 259.188px / 728.812px / 288px; the top section label starts at x=114px. Original/generated assets remain available as source references, but the raster wordmark is no longer referenced by the interface.

The following prompt records the earlier image_gen reference extraction, not the final SVG production process. The vector asset is generated from native font paths by .tools/build-wordmark-vector.py; the local font license is assets/fonts/inter-OFL.txt.

## Final asset prompt

Use case: identity-preserve / background-extraction. Edit target: the approved logo comparison board marked 01. Produce ONE standalone transparent-background typographic logo, exact spelling 'tikinteract.' (t i k i n t e r a c t .). Extract and faithfully reproduce the BOTTOM black-lettered wordmark only, preserve exactly the custom letter shapes, weight contrast (heavy tik and semibold interact), original tight kerning, proportions and alignment. First i dot burgundy #A30F3D; the second i dot matches the neutral lettering; final period is red #E92E5B with the single short red curved LIVE signal arc above-right. All neutral letters solid near-black #101014. Genuinely transparent background, no background rectangle, no number 01, no other symbols, no separate circular logo, no labels. Single horizontal wordmark centered, fully visible, small even margins. No redesign, no missing letters, no shadows, no glow, no texture. Crisp smooth vector-like edges. The letterforms must be identical to reference, not an approximation with a different font.
