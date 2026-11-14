// Neon Breach — a three.js tactical FPS, handed in by main.ts.
//
// This program runs on Node 22 with the standard library only. It takes the
// game in this repository (game/ — static files, three.js 0.187.0 vendored)
// and the screenshots/ captures, copies them to the output directory the
// platform provides, and writes /output/dossier.json with the kit's vendored
// make.fun library, which is what the judge reads.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p /tmp/fps02-out && MAKEFUN_OUTPUT_DIR=/tmp/fps02-out node main.ts
//
// Serve the game locally with `node serve.ts` from the dev folder, then open
// http://localhost:8080 — no build step, the browser loads game/index.html
// as ES modules straight from disk.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The whole output tree is written fresh: game/ first, then screenshots/,
// then the dossier the library builds from exactly those files.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own: at most 4 screenshots of 256 KiB, at
// most 993 files and 48 MiB in game/, and the dossier text capped at 160 KiB.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
