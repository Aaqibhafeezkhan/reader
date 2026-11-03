/**
 * What date a file is, and what date it is now, as `YYYY-MM-DD`. Comparing
 * these strings compares the dates, so finding a day's files or a folder's
 * latest needs nothing more.
 */

import { frontMatter } from '../static/markdown.js';

// A date in a name, not part of a longer number (`journal-2026-10-31.md`);
// or three folders, or two and a file's name (`2026/10/31/notes.md`).
const IN_PATH = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)|(?<![^/])(\d{4})\/(\d{2})\/(\d{2})(?![^/.])/g;
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

/** The date in a root-relative path, or null. Of several, the one nearest the file. */
export function dateInPath(rel) {
  const found = [...rel.matchAll(IN_PATH)].map((m) => (m[1] ? day(m[1], m[2], m[3]) : day(m[4], m[5], m[6])));
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
 * A file's date, or null: its `date:` front matter, or else one in its name
 * or path. A `date:` that isn't a date (`soon`) says nothing, so the name
 * still can. `text` is as much of the file as has its front matter.
 */
export function dateOf(rel, text = '') {
  return dateInMatter(text) ?? dateInPath(rel);
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
const dayInName = (name) => (DAY_NAME.test(name) ? dateInPath(name) : null);

/**
 * The folders of `files` (each with its `date`) that `day`'s file could be
 * started in, each as { dir, from, to }: what it's copied from, the latest
 * of the days before, and what it's called, that one's name with `day` in
 * it. A folder of dated files, at least half its documents dated by their
 * own names, so a single file with a date in its name among a folder of
 * notes offers nothing, where a journal just begun does. Not one with a
 * file dated `day` already, whatever its name, nor one where the name is
 * taken. A date to come isn't a day to copy from.
 */
export function startable(files, day) {
  const folders = Map.groupBy(files, (f) => f.path.slice(0, Math.max(0, f.path.lastIndexOf('/'))));
  const starts = [];
  for (const [dir, here] of folders) {
    if (here.some((f) => f.date === day)) continue;
    const docs = here.filter((f) => f.type === 'md');
    const days = docs.filter((f) => dayInName(baseName(f.path)));
    if (days.length * 2 < docs.length) continue;
    const latest = days
      .filter((f) => f.date < day)
      .reduce((a, b) => (!a || b.date > a.date || (b.date === a.date && b.path > a.path) ? b : a), null);
    if (!latest) continue;
    const name = baseName(latest.path);
    const at = name.lastIndexOf(dayInName(name));
    const to = (dir ? `${dir}/` : '') + name.slice(0, at) + day + name.slice(at + day.length);
    if (!here.some((f) => f.path === to)) starts.push({ dir, from: latest.path, to });
  }
  return starts;
}

const DATE_LINE = /^([ \t]*date[ \t]*:[ \t]*)(["']?)(.*?)\2([ \t]*)$/i;

/**
 * `text`, its `date:` in the front matter set to `day`, if it has one: a
 * time after the date stays. Every other line is left just as it's written,
 * line endings and all.
 */
export function withDate(text, day) {
  // A line and its ending by turns.
  const parts = text.split(/(\r\n?|\n)/);
  const lines = parts.filter((_, i) => i % 2 === 0);
  const matter = frontMatter(lines);
  if (typeof matter?.meta.date !== 'string') return text;
  // A `date:` indented under a key of its own isn't the page's (frontMatter).
  let under = false;
  for (let n = 1; n < matter.end - 1; n++) {
    if (!lines[n].trim()) continue;
    const indented = /^[ \t]/.test(lines[n]);
    if (!(under && indented)) {
      const m = DATE_LINE.exec(lines[n]);
      if (m) {
        const value = IN_MATTER.test(m[3]) ? day + m[3].slice(day.length) : day;
        parts[n * 2] = m[1] + m[2] + value + m[2] + m[4];
      }
      under = !indented && /:[ \t]*$/.test(lines[n]);
    }
  }
  return parts.join('');
}
