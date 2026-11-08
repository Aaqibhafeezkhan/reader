/**
 * `timer:[2m]` is a timer on the page: how long it runs, and buttons to
 * start it, pause it and set it back.
 *
 *   timer:[2m]   timer:[90s]   timer:[1m30s]   timer:[1h]
 *
 * A duration is hours, minutes and seconds, each a number and its letter,
 * in that order, any of them left out (`1h 30m` may have a space). One
 * that isn't (`timer:[soon]`, `timer:[0s]`) stays as typed, as does one in
 * code. Several on a page each run on their own.
 *
 * Running a timer isn't working the page, and nothing of it is written to
 * the file, so it runs wherever the page can be read in the preview: on a
 * slide, in a record, in Work (preview.js). An exported page runs no
 * script to count down with, and only says how long.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemeRule } from '../scheme.js';
import { sections, escapeHtml, escapeAttr } from '../source.js';

const DURATION = /^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/;

/**
 * `1m30s` as { seconds: 90, shown: '1:30', spoken: '1 minute 30 seconds' },
 * or null if it isn't a duration: how long, as a clock shows it, and as
 * it's said.
 */
export function duration(written) {
  const m = DURATION.exec(written.trim());
  if (!m || !(m[1] || m[2] || m[3])) return null;
  const [h, min, s] = m.slice(1).map((n) => Number(n || 0));
  const seconds = h * 3600 + min * 60 + s;
  if (!seconds) return null;
  return { seconds, shown: clock(seconds), spoken: spoken(seconds) };
}

/** Seconds as a clock shows them: `2:00`, `0:05`, `1:00:00`. */
export function clock(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const two = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Seconds as they're said: `1 hour 30 minutes`, `90 seconds` as `1 minute 30 seconds`. */
export function spoken(seconds) {
  const parts = [[Math.floor(seconds / 3600), 'hour'], [Math.floor((seconds % 3600) / 60), 'minute'], [seconds % 60, 'second']];
  return parts.filter(([n]) => n).map(([n, unit]) => `${n} ${unit}${n === 1 ? '' : 's'}`).join(' ');
}

/** A short word for `s`, the same each time, to know it again by. */
const hash = (s) => {
  let h = 5381;
  for (const c of s) h = (h * 33 + c.codePointAt(0)) >>> 0;
  return h.toString(36);
};

export function timer(md) {
  schemeRule(md, {
    name: 'timer',
    scheme: 'timer',
    path: /(?:)/,
    make: (state, where, label) => {
      const found = duration(label);
      if (!found) return false;
      if (!state) return true;
      const t = state.push('timer', 'span', 0);
      t.meta = { ...found };
      // Its words, for whatever names a line by what it says (a task's box).
      t.content = found.spoken;
      return true;
    },
  });

  // Each timer is known again, as the page is drawn anew, by its file, the
  // page (or slide) it's on, the section it's in and which of that section's
  // timers of its length it is: lines typed above it, or on another part of
  // the page, leave it running, and yesterday's leaves today's copy be.
  md.core.ruler.push('timer_key', (state) => {
    if (state.inlineMode) return;
    const { of } = sections(state);
    const seen = new Map();
    // A deck draws each slide on its own, and they share an env.shared.
    const shared = state.env.shared ?? {};
    const slide = shared.timerParts = (shared.timerParts ?? -1) + 1;
    const file = hash(state.env.file ?? '');
    let page = 0;
    state.tokens.forEach((block, i) => {
      if (block.type === 'hr' && block.level === 0) page += 1;
      for (const t of block.children ?? []) {
        if (t.type !== 'timer') continue;
        const at = `${file}/${slide + page}/${t.meta.seconds}/${hash(of[i].title)}`;
        const k = seen.get(at) ?? 0;
        seen.set(at, k + 1);
        t.meta.key = `${at}/${k}`;
      }
    });
  });

  // Reset shows once there's something to set back.
  md.renderer.rules.timer = (tokens, i, opts, env) => {
    const { seconds, shown, spoken: said, key = '' } = tokens[i].meta;
    // An exported page has nothing to count down with.
    if (env.exported) return `<span class="timer">${escapeHtml(said)}</span>`;
    // Its time isn't live, or it would be read out each second; a timer
    // run out says so once (preview.js).
    return `<span class="timer" role="group" aria-label="${escapeAttr(`Timer, ${said}`)}" data-seconds="${seconds}" data-key="${escapeAttr(key)}">`
      + `<span class="timer-time" role="timer">${shown}</span>`
      + '<button type="button" class="timer-go">Start</button>'
      + '<button type="button" class="timer-reset" hidden>Reset</button>'
      + '</span>';
  };
}

export default {
  name: 'timer',
  plugin: timer,
  css: fs.readFileSync(new URL('./timer.css', import.meta.url), 'utf8'),
  // Drawn into the preview frame, to count down.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
