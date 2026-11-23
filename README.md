# Chess — The Club Table

A single-player chess game against a built-in engine. Vanilla HTML, CSS and
JavaScript, no runtime dependencies, no network calls once loaded.

**Current version: 2.1.0**

## What's in the repo

| Path | What it is |
| --- | --- |
| `index.html` / `chess.html` | the whole game in one self-contained file (icons inlined) |
| `chess-pwa/chess-pwa/` | the installable version — same game plus `manifest.webmanifest`, `sw.js` and icon files |
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

That regenerates `index.html`, `chess.html`, `chess-pwa/chess-pwa/` and
`dist/chess-pwa.zip`. The version number lives in one place: `VERSION` at the
top of `build.py`.

## Testing

```sh
node tests/openings.js            # every opening line is legal in the engine
npm i playwright-core && node tests/e2e.js    # full browser suite
```

## Installing it on a phone

The single file plays fine from anywhere, but Chrome can only install a
*standalone* app from a folder served over HTTPS with a real manifest and a
service worker — that's `chess-pwa/chess-pwa/`. Serve that folder, delete any
old home-screen shortcut, then use Chrome's **Install app**.

## Features

- Six difficulty levels, six board themes, playable as White, Black or random
- Opening guide: 15 openings with on-board highlights, book replies, and a
  history-and-theory panel for each
- One undo per game, hints, flip, resign, move list
- Captured-piece trays, material count, and a last-capture readout
- Persistent W/L/D record and game-in-progress, kept across app restarts
- Synthesised sounds: wood knock, sword clang on a capture, trumpet fanfare on mate
