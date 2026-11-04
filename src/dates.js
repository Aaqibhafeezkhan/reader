/**
 * What date a file is, and what date it is now, as `YYYY-MM-DD`. Comparing
 * these strings compares the dates, so finding a day's files or a folder's
 * latest needs nothing more.
 */

import { frontMatter } from '../static/markdown.js';

// A date in a name, not part of a longer number (`journal-2026-10-31.md`).
const IN_NAME = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
// `date:` may go on to say the time (`2026-10-31T09:00`).
const IN_MATTER = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/;
const MATTER_END = /[\r\n]-{3,}[ \t]*(?=[\r\n]|$)/;

/** The day these numbers name, or null if there's no such day: `2026-13-45`, `2026-02-30`. */
function day(year, month, date) {
  const at = new Date(0);
  at.setUTCFullYear(Number(year), Number(month) - 1, Number(date));
  return at.getUTCMonth() === Number(month) - 1 && at.getUTCDate() === Number(date)
    ? `${year}-${month}-${date}` : null;
}

/** The date in the name of the file at a root-relative path, or null. Of several, the last. */
export function dateInName(rel) {
  const found = [...rel.slice(rel.lastIndexOf('/') + 1).matchAll(IN_NAME)].map((m) => day(m[1], m[2], m[3]));
  return found.findLast(Boolean) ?? null;
}

/** The date in a `date:` in the front matter that `text` starts with, or null. */
function dateInMatter(text) {
  // Cut at its closing dashes first, or a listing would split up every file's prose to learn nothing.
  const close = text.startsWith('---') && MATTER_END.exec(text);
  if (!close) return null;
  const lines = text.slice(0, close.index + close[0].length).replace(/\r\n?/g, '\n').split('\n');
  const { date } = frontMatter(lines)?.meta ?? {};
  const m = typeof date === 'string' && IN_MATTER.exec(date);
  return m ? day(m[1], m[2], m[3]) : null;
}

/**
 * A file's date, or null: its `date:` front matter, or else one in its own
 * name. The folders it's in don't date it. A `date:` that isn't a date (`soon`) says nothing, so the name
 * still can. `text` is as much of the file as has its front matter.
 */
export function dateOf(rel, text = '') {
  return dateInMatter(text) ?? dateInName(rel);
}

/** How many days `to` is after `from`, by the calendar, each `YYYY-MM-DD`. */
export function daysBetween(from, to) {
  const at = (date) => {
    const [y, m, n] = date.split('-').map(Number);
    return new Date(0).setUTCFullYear(y, m - 1, n);
  };
  return Math.round((at(to) - at(from)) / (24 * 60 * 60 * 1000));
}

/** The minutes into a day that `04:00` says, or null if it doesn't say a time. */
export function dayStart(time) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * What day it is by the clock `now`, in the server's own time zone. A day
 * starts `starts` minutes after midnight (`dayStart`), so before then it's
 * still the day before. That goes by the calendar, not by taking off a span
 * of time, which a change of clocks overnight would throw out.
 */
export function today(now = Date.now, starts = 0) {
  const at = new Date(now());
  if (at.getHours() * 60 + at.getMinutes() < starts) at.setDate(at.getDate() - 1);
  const two = (n) => String(n).padStart(2, '0');
  return `${String(at.getFullYear()).padStart(4, '0')}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

// A date in a file's own name, and nothing but a name after it: another dot
// is a version of a file (`2026-10-30.draft.md`), not a day of its own.
const DAY_NAME = /^[^.]+\.(?:md|markdown)$/i;
const baseName = (rel) => rel.slice(rel.lastIndexOf('/') + 1);
const dayInName = (name) => (DAY_NAME.test(name) ? dateInName(name) : null);

/**
 * The folders of `files` (each with its `date`) with a document dated in its
 * own name, on or before `day`: a series of files. Each is { dir, open }, if
 * `day`'s file is there already, or else { dir, from, date, to }: what `day`'s
 * is copied from, the latest of them before `day`, then its date, and what the
 * new file's called, that one's name with `day` in it. How long ago that was
 * doesn't matter, so a folder never stops offering, and someone coming back to
 * it finds what they left. Its date is the one every file has (`dateOf`), and
 * it's that which says which is latest. A date in the name is also needed to
 * make the new name, and a date to come isn't a day to copy from.
 */
export function startable(files, day) {
  const folders = Map.groupBy(files, (f) => f.path.slice(0, Math.max(0, f.path.lastIndexOf('/'))));
  const starts = [];
  for (const [dir, here] of folders) {
    const named = here.filter((f) => f.type === 'md' && dayInName(baseName(f.path)) && f.date <= day);
    if (!named.length) continue;
    // A file of the series first, over something else that says it's today.
    const made = [...named, ...here].find((f) => f.date === day);
    if (made) {
      starts.push({ dir, open: made.path });
      continue;
    }
    const latest = named.reduce((a, b) => (b.date > a.date || (b.date === a.date && b.path > a.path) ? b : a));
    const name = baseName(latest.path);
    const at = name.lastIndexOf(dayInName(name));
    const to = (dir ? `${dir}/` : '') + name.slice(0, at) + day + name.slice(at + day.length);
    starts.push(here.some((f) => f.path === to) ? { dir, open: to } : { dir, from: latest.path, date: latest.date, to });
  }
  return starts;
}

const DATE_LINE = /^([ \t]*date[ \t]*:[ \t]*)(["']?)(.*?)\2([ \t]*)$/i;

/**
 * `text`, its `date:` in the front matter set to `day`, if it has one: a
 * time after the date stays. Any other line of the front matter is what
 * `moved(line)` makes of it, as it's written if nothing; so is the rest of
 * the file, line endings and all.
 */
export function withDate(text, day, moved = (line) => line) {
  // A line and its ending by turns.
  const parts = text.split(/(\r\n?|\n)/);
  const lines = parts.filter((_, i) => i % 2 === 0);
  const matter = frontMatter(lines);
  if (!matter) return text;
  const dated = typeof matter.meta.date === 'string';
  // A line indented under a key of its own isn't the page's (frontMatter).
  let under = false;
  for (let n = 1; n < matter.end - 1; n++) {
    if (!lines[n].trim()) continue;
    const indented = /^[ \t]/.test(lines[n]);
    if (!(under && indented)) {
      const m = DATE_LINE.exec(lines[n]);
      if (m && dated) {
        const value = IN_MATTER.test(m[3]) ? day + m[3].slice(day.length) : day;
        parts[n * 2] = m[1] + m[2] + value + m[2] + m[4];
      } else if (!m) parts[n * 2] = moved(lines[n]);
      under = !indented && /:[ \t]*$/.test(lines[n]);
    }
  }
  return parts.join('');
}
