# Chess — The Club Table

A single-player chess game against a built-in engine. Vanilla HTML, CSS and
JavaScript, no runtime dependencies, no network calls once loaded.

**Current version: 2.1.1**

## What's in the repo

| Path | What it is |
| --- | --- |
| `index.html` | the game, served at the site root — this is the installable app |
| `manifest.webmanifest`, `sw.js`, `icons/` | what makes the root install as a standalone app and run offline |
| `chess.html` | the whole game in one self-contained file, icons inlined — for sideloading or emailing |
| `chess-pwa/chess-pwa/` | redirect stub only; the app used to live here |
| `src/shell.html` | **source**: markup, CSS and UI logic |
| `src/core.js` | **source**: chess engine, move generation, SAN, AI search |
| `assets/` | app icons (192, 512, apple-touch, favicon) |
| `build.py` | builds every output above from `src/` |
| `tests/` | opening-line validation and the browser test suite |

## Building

Edit `src/`, never the generated HTML, then:

```sh
python3 build.py
```

That regenerates every file in the table above plus `dist/chess-pwa.zip`. The
version number lives in one place: `VERSION` at the top of `build.py`.

## Testing

```sh
node tests/openings.js            # every opening line is legal in the engine
npm i playwright-core && node tests/e2e.js    # full browser suite
```

## Installing it on a phone

Open the site root in Chrome and use the menu's **Install app**, or the
**Install app** button at the bottom of the page. It then runs full screen as
its own app, with the queen icon, and works offline.

Chrome will only install a *standalone* app from a page served over HTTPS that
has a real manifest and a service worker, which is why those three files sit at
the root next to `index.html`. `chess.html` on its own cannot be installed that
way — a single file cannot register a service worker — so it opens in a normal
browser tab.

The app moved to the root in 2.1.1. It used to live at
`chess-pwa/chess-pwa/`, which now just redirects. If you installed it from the
old address, delete that home-screen icon and install again from the root; your
W/L record and saved game carry over, since both addresses are the same origin.

## Features

- Six difficulty levels, six board themes, playable as White, Black or random
- Opening guide: 15 openings with on-board highlights, book replies, and a
  history-and-theory panel for each
- One undo per game, hints, flip, resign, move list
- Captured-piece trays, material count, and a last-capture readout
- Persistent W/L/D record and game-in-progress, kept across app restarts
- Synthesised sounds: wood knock, sword clang on a capture, trumpet fanfare on mate
