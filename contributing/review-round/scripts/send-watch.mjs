// Watches a review folder for a ticked `- [x] Send to Claude` box. Each time
// one goes from unticked to ticked, prints one event: where the box is, and
// everything waiting for Claude in that box's day folder (asides-open.mjs).
// Claude answers them all, then unticks the box to say the round is done.
//   node send-watch.mjs <meetings dir> [poll ms] [--once]
// With --once it stops at the first event, so a background command can wake Claude.
import fs from 'node:fs';
import path from 'node:path';
import { files, open } from './asides-open.mjs';

const ROOT = process.argv[2];
const POLL = Number(process.argv[3]) || 2000;
const ONCE = process.argv.includes('--once');
const BOX = /^\s*[-*+] \[([ xX])\] Send to Claude\b/;
const was = new Map();
let first = true;

for (;;) {
  try {
    for (const f of files(ROOT)) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        const m = BOX.exec(l);
        if (!m) return;
        const key = `${f}:${i}`;
        const ticked = m[1] !== ' ';
        // Already ticked when the watch starts counts too: it was sent while no one watched.
        if (ticked && (first || was.get(key) === false)) {
          const day = path.relative(ROOT, f).split(path.sep)[0];
          // The day's own review.md is about the whole day. An item's box, in gh-N/review.md, is
          // about everything in its folder. (Older days: review/gh-N.md, with the day's try/.)
          const rel = path.relative(ROOT, f);
          const dir = path.dirname(rel);
          const whole = rel === path.join(day, 'review.md');
          const legacy = path.basename(dir) === 'review';
          const about = (w) => whole
            || (legacy ? w.at.startsWith(`${rel}:`) || w.at.startsWith(`${day}/try/`) || w.at.startsWith(`${rel.replace(/\.md$/, '')}/`)
              : dir === day ? w.at.startsWith(`${rel}:`) : w.at.startsWith(`${dir}/`));
          const waiting = open(ROOT, path.join(ROOT, day)).filter(about);
          console.log(`send ${path.relative(ROOT, f)}:${i + 1}: ${waiting.length} waiting${waiting.map((a) => `\n  ${a.at}: ${a.text.slice(0, 120)}`).join('')}`);
          if (ONCE) process.exit(0);
        }
        was.set(key, ticked);
      });
    }
    first = false;
  } catch (e) {
    console.log(`watcher error: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, POLL));
}
