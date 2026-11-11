// Watches the day folders for a ticked `- [x] Send to <ai>` box. Each time one goes
// from unticked to ticked, prints one event: where the box is, and everything waiting
// for the AI in that box's day folder (asides-open.mjs). The AI answers them all,
// then unticks the box to say the round is done.
//   send-watch.mjs [poll ms] [--once] [--root <meetings dir>]
// With --once it stops at the first event, so a background command can wake the AI.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { files, open } from './asides-open.mjs';
import { config, literal } from './config.mjs';

export async function main(argv) {
  const { values: opt, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { once: { type: 'boolean', default: false }, root: { type: 'string' } },
  });
  const c = config();
  const ROOT = path.resolve(opt.root ?? c.meetings);
  const POLL = Number(positionals[0]) || 2000;
  const BOX = new RegExp(`^\\s*[-*+] \\[([ xX])\\] Send to ${literal(c.ai)}\\b`);
  const was = new Map();
  let first = true;
  if (!fs.existsSync(ROOT)) {
    console.error(`no day folders at ${ROOT}`);
    process.exit(2);
  }

  for (;;) {
    try {
      for (const f of files(ROOT)) {
        fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
          const m = BOX.exec(l);
          if (!m) return;
          const key = `${f}:${i}`;
          const ticked = m[1] !== ' ';
          // Already ticked when the watch starts counts too, if anything's waiting: it was
          // sent while no one watched.
          if (ticked && (first || was.get(key) === false)) {
            // Paths with /, as asides-open gives them, on every system.
            const rel = path.relative(ROOT, f).split(path.sep).join('/');
            const day = rel.split('/')[0];
            // The day's own review.md is about the whole day. An item's box, in gh-N/review.md, is
            // about everything in its folder. (Older days: review/gh-N.md, with the day's try/.)
            const dir = path.posix.dirname(rel);
            const whole = rel === `${day}/review.md`;
            const legacy = path.posix.basename(dir) === 'review';
            const about = (w) => whole
              || (legacy ? w.at.startsWith(`${rel}:`) || w.at.startsWith(`${day}/try/`) || w.at.startsWith(`${rel.replace(/\.md$/, '')}/`)
                : dir === day ? w.at.startsWith(`${rel}:`) : w.at.startsWith(`${dir}/`));
            const waiting = open(ROOT, path.join(ROOT, day)).filter(about);
            // One left ticked from a round already answered, as an old day's can be, has
            // nothing waiting: it isn't a send.
            if (first && !waiting.length) return was.set(key, ticked);
            console.log(`send ${rel}:${i + 1}: ${waiting.length} waiting${waiting.map((a) => `\n  ${a.at}: ${a.text.slice(0, 120)}`).join('')}`);
            if (opt.once) process.exit(0);
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
}
