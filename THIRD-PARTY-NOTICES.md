# Third-party notices

Bach Chorale Trainer includes or is built from the following material.

## Chorale encodings

The chorale data in `chorales.json` and `scores/` is derived from:

> Craig Stuart Sapp, *A digital edition of 370 J.S. Bach Chorales* (2009),
> https://github.com/craigsapp/bach-371-chorales

Referenced against the fourth Breitkopf & Härtel edition, *371 vierstimmige
Choralgesänge von Johann Sebastian Bach*, ed. Alfred Dörffel (Leipzig, c. 1875).

License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0), https://creativecommons.org/licenses/by-nc-sa/4.0/

The derived files in this repository are shared under the same license. They
may not be used for commercial purposes without permission from the rights holder.

## Engraving

The scores were engraved at build time with Verovio
(https://www.verovio.org, LGPL-3.0-or-later), using its Humdrum importer and
the `satb2gs` filter for the keyboard layout. Verovio is a build dependency
only (see `tools/`); it is not included in the app.

## Piano samples

The files in `samples/` are from the Salamander Grand Piano V3 by Alexander
Holm, as packaged in the Tone.js audio repository
(https://github.com/Tonejs/audio).

License: Creative Commons Attribution 3.0 (CC BY 3.0),
https://creativecommons.org/licenses/by/3.0/

## Fonts

The page loads IM Fell English (SIL Open Font License) and IBM Plex Sans and
IBM Plex Mono (SIL Open Font License) from Google Fonts.
