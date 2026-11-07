/**
 * Making a copy of the open file, a file of its own to carry on in, with no
 * thought of folding it back in (that's a branch, manage.js). Two buttons
 * beside the path's, as New and Start today's sit side by side in the list:
 * Make a copy, and, on a file dated another day, Copy for today, a copy as
 * Start today's makes one: the server names it, dates it, and writes it,
 * never over a file that's there. A copy for today, or one made from Work,
 * starts with its answers cleared, worked out as Start today's works them out
 * (starting.js); one from Edit keeps its text.
 *
 * Where a button doesn't apply it's gray, not gone, so the bar doesn't shift
 * and it can say why: aria-disabled, as Start today's is (files.js).
 */

import { el, state } from './state.js';
import { api } from './api.js';
import { saveFirst } from './saving.js';
import { toast } from './status.js';
import { startedOver } from './starting.js';
import { loadTree, open, reveal, onLongPress } from './files.js';
import { icon } from './icons.js';

let copying = false;

/** The open file's date, by its name or its `date:`, if it has one. */
function dateOf() {
  return state.files.find((f) => f.path === state.current?.path)?.date || null;
}

/** Why Make a copy can't, or nothing if it can. */
function whyNot() {
  if (!state.current) return 'once a file is open';
  if (state.current.type !== 'md') return 'of a markdown file, not a PDF';
  return null;
}

/** Why Copy for today can't, or nothing if it can. */
function whyNotToday() {
  const no = whyNot();
  if (no) return no;
  const date = dateOf();
  if (!date || !state.today) return 'once the file has a date';
  if (date === state.today) return "of another day's: this one is today's";
  return null;
}

function draw(b, label, no, yes) {
  b.setAttribute('aria-disabled', String(Boolean(no)));
  b.title = no ? `${label}, ${no}.` : yes;
}

/** The two buttons beside the file's path, and what each would make. */
export function drawCopy() {
  draw(el.copyFile, 'Make a copy', whyNot(),
    'Make a copy, a file of its own; from Work, with its answers cleared.');
  draw(el.copyToday, 'Copy for today', whyNotToday(),
    `Copy for today, ${state.today}, with today's name and date and its answers cleared.`);
}

/** The buttons have only an icon to go by, so a finger held on one says what a tooltip would. */
export function setUpCopy() {
  el.copyFile.innerHTML = icon('copy-file');
  el.copyToday.innerHTML = icon('copy-today');
  for (const b of [el.copyFile, el.copyToday]) onLongPress(b, () => toast(b.title));
  drawCopy();
}

/** Makes the copy, today's or a plain one, and opens it. */
export async function makeCopy(today) {
  const b = today ? el.copyToday : el.copyFile;
  if ((today ? whyNotToday() : whyNot()) || copying) return;
  const p = state.current.path;
  copying = true;
  b.disabled = true;
  try {
    if (!(await saveFirst())) throw new Error('the open file isn\'t saved');
    const clear = today || state.working;
    const ask = new URLSearchParams({ path: p });
    if (today) ask.set('today', '1');
    if (clear) ask.set('clear', '1');
    const plan = await api('GET', `/api/copy?${ask}`);
    const edits = clear ? await startedOver(plan) : [];
    const made = await api('POST', '/api/copy', { path: p, mtime: plan.mtime, edits, today });
    await loadTree();
    reveal(made.path);
    await open(made.path);
    toast(`Copied ${p.slice(p.lastIndexOf('/') + 1)} to ${made.path.slice(made.path.lastIndexOf('/') + 1)}`);
  } catch (err) {
    toast(`The copy wasn't made: ${err.message}`, true);
  } finally {
    b.disabled = false;
    copying = false;
  }
}
