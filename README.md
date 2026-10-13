# Bach Chorale Studio

A practice tool for the Bach four-part chorales. Students can mute, solo, or
change the volume of each voice (soprano, alto, tenor, bass), set the tempo,
loop a passage, and follow along in the score while it plays.

Copyright 2026 Alexander Zhu.

## Features

- All 370 four-part chorales from the Breitkopf & Härtel collection (371
  numbering; No. 150 is not in four parts), searchable by number, title, BWV
  number, or key.
- Three score layouts:
  - **Keyboard**: soprano and alto on the treble staff, tenor and bass on the bass staff.
  - **Four clefs**: open score in soprano, alto, tenor, and bass clefs.
  - **Open score, modern clefs**: treble, treble, treble-8, and bass.
- Mute, solo, and volume for each voice. Muted voices are greyed out in the
  score.
- Sounding notes light up in each voice's color as the chorale plays.
- Click a note to hear it; playback then starts from that note. Click a bar
  to start from that bar.
- Mark a passage (Shift-click a bar, or use **Mark passage**) and loop it.
- Tempo from 30 to 160 quarter-note beats per minute, adjustable during
  playback.
- Optional count-in, fermata holds, and repeats.
- Piano (sampled) or organ sound.
- Keyboard shortcuts: Space to play or pause, 1–4 to mute or unmute voices,
  ← and → to move by bar.
- Links to a chorale with `#c` plus its number, for example `index.html#c13`.

## Running it locally

The app is a static site, but it loads its data with `fetch`, so it has to be
served over HTTP rather than opened as a file:

```sh
cd bach-chorale-studio
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publishing with GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the
   `main` branch and the `/ (root)` folder, and save.

The site appears at `https://<your-username>.github.io/<repository-name>/`
after a minute or two. The `.nojekyll` file tells GitHub Pages to serve the
files as they are.

## How it works

The scores are engraved ahead of time, so the page needs no notation engine
and no build step to run. Each chorale is stored in three layouts at two
widths (`w` for desktop and tablet, `n` for phones), along with its playback
data: every note's voice, pitch, and timing, its fermatas, and its repeat
structure. Ten chorales share one file in `scores/`, gzipped and then
base64-encoded so any static host serves them as plain text. The page
downloads only the file it needs and decompresses it in the browser.

Audio is generated in the browser with the Web Audio API. Piano notes use
recorded samples pitched to the nearest note, and the organ is synthesized.

```
index.html               the app: markup, styles, and script in one file
chorales.json            index of chorales (number, title, BWV, key, meter)
glyphs.json              music-font glyphs shared by all the scores
scores/00-w.txt …       ten chorales per file, desktop layout
scores/00-n.txt …       ten chorales per file, phone layout
samples/*.mp3            piano samples, C2–C6
tools/build.mjs          rebuilds chorales.json, glyphs.json, and scores/
```

## Rebuilding the data

You only need this if you change the encodings or the engraving settings.
It requires Node.js 18 or later and takes about ten minutes.

```sh
git clone https://github.com/craigsapp/bach-371-chorales.git data/bach-371-chorales
cd tools
npm install
npm run build
```

`npm run build` reads `data/bach-371-chorales/kern` and writes
`chorales.json`, `glyphs.json`, and `scores/` into the project folder. To
write the output somewhere else, run the script directly:

```sh
node build.mjs <path-to-kern-folder> <output-folder>
```

The layout widths and notation sizes are set in `PROFILES` near the top of
`tools/build.mjs`.

## Browser support

Current versions of Chrome, Edge, Firefox, and Safari (16.4 or later). The
page needs `DecompressionStream` and the Web Audio API.

## Credits and licenses

- App code: Copyright 2026 Alexander Zhu. All rights reserved. See `LICENSE`.
- Chorale encodings: Craig Stuart Sapp,
  [bach-371-chorales](https://github.com/craigsapp/bach-371-chorales),
  CC BY-NC-SA 4.0. The derived data in this repository is shared under the
  same license and may not be used commercially without permission.
- Engraving: [Verovio](https://www.verovio.org), used at build time.
- Piano samples: Salamander Grand Piano V3, Alexander Holm, CC BY 3.0.

See `THIRD-PARTY-NOTICES.md` for full details.
