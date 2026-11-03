/**
 * `open-until:` in the front matter: the page is filled in until then, and
 * a record after, its boxes, blanks, dates and puzzles shown as they were
 * left and changed no more.
 *
 *   ---
 *   open-until: 2026-10-28 04:00
 *   ---
 *
 * A day and a time, as a clock on the wall says it, wherever the page is
 * read; a day alone (`2026-10-27`) is open to the end of that day. The line
 * is claimed (`matter`), so it isn't shown as written in the byline: a
 * notice there says until when the page can be edited, or that it can't
 * be. Each page of a workbook says so at its top, having no byline.
 *
 * When the page closes (`closes`) is read by src/page.js, which says on
 * `env.closed` whether it has; everything drawn to fill in asks that
 * through `workable(env)` (features/blank.js), not the date. The page is
 * drawn by the server's clock; in the preview frame, by the reader's, which
 * shuts it while it's showing if the time comes (preview.js).
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { escapeHtml, escapeAttr } from '../source.js';

const LINE = /^open-until\s*:\s*(["']?)(.*?)\1\s*$/i;
const WHEN = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * `2026-10-28 04:00`, or `2026-10-27` alone, as
 * { year, month, day, hour, minute }, `hour` null for a day alone; or null
 * if there's no such day or time.
 */
export function readUntil(s) {
  const m = WHEN.exec(String(s).trim());
  if (!m) return null;
  const [year, month, day] = m.slice(1, 4).map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCFullYear(year);
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  if (m[4] == null) return { year, month, day, hour: null, minute: null };
  const [hour, minute] = [Number(m[4]), Number(m[5])];
  return hour < 24 && minute < 60 ? { year, month, day, hour, minute } : null;
}

/**
 * When it closes, in ms, by this machine's clock: at the time given, or at
 * the start of the next day for a day alone.
 */
export function closingTime(u) {
  const d = new Date(0);
  d.setFullYear(u.year, u.month - 1, u.hour == null ? u.day + 1 : u.day);
  d.setHours(u.hour ?? 0, u.minute ?? 0, 0, 0);
  return d.getTime();
}

/** "4:00 on 28 October 2026", or, for a day alone, "the end of 27 October 2026". */
export function deadline(u) {
  const day = `${u.day} ${MONTHS[u.month - 1]} ${u.year}`;
  return u.hour == null ? `the end of ${day}` : `${u.hour}:${String(u.minute).padStart(2, '0')} on ${day}`;
}

const capital = (s) => s.replace(/^the end of/, 'the End of');

/**
 * The notice: until when the page can be edited, or that it can't be any
 * longer, which is said with when it closed, on hover and to the keyboard,
 * since the notice can be focused, and to a screen reader as its name.
 * `data-until` is the time as written, for the frame to judge by its own
 * clock, which says how far away it is (`.open-until-away`), and
 * `data-closed` what it says once it's passed.
 */
export function notice(until, closed, tag = 'span') {
  const u = readUntil(until);
  const at = `Closed at ${deadline(u)}`;
  const data = ` data-until="${escapeAttr(until)}" data-closed="${escapeAttr(at)}"`;
  if (closed) {
    return `<${tag} class="open-until open-until-closed" role="note" tabindex="0" aria-label="No Longer Editable. ${escapeAttr(at)}"${data}>No Longer Editable</${tag}>`;
  }
  return `<${tag} class="open-until"${data}>Editable Until ${escapeHtml(capital(deadline(u)))}<span class="open-until-away"></span></${tag}>`;
}

/** The claimed line's time as written, if the page has one. */
const untilOf = (env) => (env.entries ?? []).find((e) => e.feature === 'open-until')?.until;

function openUntil(md) {
  // Once the page's front matter is off, and its entries and whether it's
  // closed are known (src/page.js): the notice, in the byline, or at the
  // top of a workbook's page, which has none. Not on a slide being shown,
  // which can't be worked anyway.
  md.core.ruler.push('open_until', (state) => {
    if (state.inlineMode || state.env.nested) return;
    const until = untilOf(state.env);
    if (!until || state.env.deck) return;
    if (!state.env.matter) {
      state.env.byline = [...(state.env.byline ?? []), notice(until, state.env.closed)];
      return;
    }
    const t = new state.Token('open_until', 'p', 0);
    t.block = true;
    t.meta = { until, closed: state.env.closed };
    state.tokens.unshift(t);
  });
  md.renderer.rules.open_until = (tokens, i) => `${notice(tokens[i].meta.until, tokens[i].meta.closed, 'p')}\n`;
}

export default {
  name: 'open-until',
  plugin: openUntil,
  matter(line) {
    const m = LINE.exec(line);
    return m && readUntil(m[2]) ? { until: m[2].trim() } : null;
  },
  closes: (entry) => closingTime(readUntil(entry.until)),
  // Its day moved, by the calendar, and any time after it left as it's written.
  moved(line, days) {
    const m = LINE.exec(line);
    const u = m && readUntil(m[2]);
    if (!u) return null;
    const at = new Date(0);
    at.setUTCFullYear(u.year, u.month - 1, u.day + days);
    return line.replace(/\d{4}-\d{2}-\d{2}/, at.toISOString().slice(0, 10));
  },
  css: fs.readFileSync(new URL('./open-until.css', import.meta.url), 'utf8'),
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
