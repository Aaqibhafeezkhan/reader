/**
 * Starting today's file from a dated folder's latest. The server picks that
 * file and today's name, and writes the new file in one step. What's cleared
 * is worked out before that, in a hidden frame that draws the whole file and
 * starts it over, so each feature clears its own answers and nothing here
 * says what an answer is. Should any of it fail, nothing has been written, so
 * no file with yesterday's answers ever appears.
 */

import { api } from './api.js';
import { saveFirst } from './saving.js';
import { toast } from './status.js';
import { askHidden } from './render.js';
import { loadTree, open, reveal } from './files.js';

const CLEAR_TIMEOUT = 15000;

let starting = false;

/**
 * The edits that clear the answers of the file `plan` drew (`{ from, css,
 * body }`), as Start over does, worked out in a hidden frame; or an error,
 * if it fails or takes too long. Making a copy clears them so too.
 */
export async function startedOver(plan) {
  const { edits, failed } = await askHidden(plan, plan.from, {
    ask: { type: 'start-over' },
    answer: 'started-over',
    wait: CLEAR_TIMEOUT,
    late: 'clearing its answers took too long',
  });
  if (failed) throw new Error(`clearing its answers failed: ${failed}`);
  return edits;
}

/** Makes today's file in the folder `dir` and opens it; `button` is what was pressed. */
export async function startToday(dir, button) {
  if (starting) return;
  starting = true;
  button.disabled = true;
  try {
    // The latest may be the open file, with what's typed not yet on disk.
    if (!(await saveFirst())) throw new Error('the open file isn\'t saved');
    const plan = await api('GET', `/api/start-day?dir=${encodeURIComponent(dir)}`);
    const edits = await startedOver(plan);
    const made = await api('POST', '/api/start-day', { dir, from: plan.from, mtime: plan.mtime, edits });
    await loadTree();
    reveal(made.path);
    await open(made.path);
    toast(`Started from ${made.from.slice(made.from.lastIndexOf('/') + 1)}`);
  } catch (err) {
    toast(`Today's file wasn't started: ${err.message}`, true);
    // It may be that it's there already, and the offer should go.
    await loadTree().catch(() => {});
  } finally {
    button.disabled = false;
    starting = false;
  }
}
