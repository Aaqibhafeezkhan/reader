/**
 * Making a copy of the open file, a file of its own to carry on in, with no
 * thought of folding it back in (that's a branch, manage.js). On a file
 * dated another day, it's a copy for today, as Start today's makes one: the
 * server names it, dates it, and writes it, never over a file that's there.
 * A copy for today, or one made from Work, starts with its answers cleared,
 * worked out as Start today's works them out (starting.js); one from Edit
 * keeps its text.
 */

import { el, state } from './state.js';
import { api } from './api.js';
import { saveFirst } from './saving.js';
import { toast } from './status.js';
import { startedOver } from './starting.js';
import { loadTree, open, reveal } from './files.js';

let copying = false;

/** Whether the open file is dated another day than today, so its copy is today's. */
function forToday() {
  const date = state.files.find((f) => f.path === state.current?.path)?.date;
  return Boolean(date && state.today && date !== state.today);
}

/** The button beside the file's path: there for an open document, and saying which copy it makes. */
export function drawCopy() {
  const b = el.copyFile;
  b.hidden = state.current?.type !== 'md';
  if (b.hidden) return;
  const today = forToday();
  b.textContent = today ? 'Copy for today' : 'Make a copy';
  b.title = today
    ? `A copy of it for today, ${state.today}, with today's name and date and its answers cleared.`
    : 'A copy of it, a file of its own; from Work, with its answers cleared.';
}

/** Makes the copy, and opens it. */
export async function makeCopy() {
  const p = state.current?.type === 'md' && state.current.path;
  if (!p || copying) return;
  copying = true;
  const b = el.copyFile;
  b.disabled = true;
  try {
    if (!(await saveFirst())) throw new Error('the open file isn\'t saved');
    const today = forToday();
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
