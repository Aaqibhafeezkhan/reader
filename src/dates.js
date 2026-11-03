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

/** What day it is by the clock `now`, in the server's own time zone. */
export function today(now = Date.now) {
  const at = new Date(now());
  const two = (n) => String(n).padStart(2, '0');
  return `${String(at.getFullYear()).padStart(4, '0')}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}
