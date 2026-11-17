/**
 * Working on reader (`npm run dev`, scripts/dev.js), which starts the server
 * again each time reader's code changes: the page notices, and shows the change.
 *
 * It asks the server which start of it this is (`/api/dev`, src/dev.js) once
 * a second. While the server is down, the asking fails, and is let be. Once
 * it answers as a new start: if the app's own files changed, the whole page
 * is loaded again; if not, only the preview frame, as the change was to the
 * server or to what the preview draws. Either way, the open file's edits are
 * saved first, and the page goes back to where it was read to. With edits
 * that can't be saved, a conflict say, it waits, and says why.
 */

import { el, state, deck } from './state.js';
import { api } from './api.js';
import { renderNow, rendered, whenReady } from './render.js';
import { saveFirst } from './saving.js';
import { topLine } from './sync.js';
import { toast } from './status.js';

export const EVERY = 1000;
const KEY = 'reader:dev-place';

let known = null;   // the start of the server the page is drawn from
let pending = null; // a newer one, not yet shown, as edits wait to be saved
let line = 0;       // the line of the file at the top of the page, as read to

// The line at the top of what's read: the page's, in Work, where the editor is
// hidden; else the editor's, which the page follows.
const reading = () => (state.working ? line : topLine());

/** Where the page has been read to, for after it's loaded again. */
function place() {
  return { path: state.current?.path, line: reading(), editor: el.editor.scrollTop, start: el.editor.selectionStart, end: el.editor.selectionEnd };
}

function keep(at) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(at));
  } catch {
    // It opens at the file's top, then.
  }
}

/** The page back where it was read to, once `path` is open, after a whole page's load. */
export async function restorePlace() {
  let at;
  try {
    at = JSON.parse(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
  if (!at || at.path !== state.current?.path) return;
  if (Number.isInteger(at.start)) el.editor.setSelectionRange(at.start, at.end ?? at.start);
  el.editor.scrollTop = at.editor || 0;
  await toLine(at.line);
}

async function toLine(n) {
  if (!n) return;
  await rendered();
  Frames.post(el.preview, { type: 'scroll', line: n });
}

/** Shows what changed in the server started as `now`, the page or only its preview. */
async function show(now) {
  if (!(await saveFirst())) {
    if (pending?.boot !== now.boot) toast('reader was started again: its changes show once your edits are saved');
    pending = now;
    return;
  }
  pending = null;
  // Presenting, the stage has a frame of its own too: the page, then.
  if (now.app !== known.app || deck.open) {
    keep(place());
    location.reload();
    return;
  }
  known = now;
  const at = reading();
  // Ready once its new page is, not the old one, which answers until it's gone.
  const loaded = new Promise((r) => el.preview.addEventListener('load', r, { once: true }));
  state.previewReady = loaded.then(() => whenReady(el.preview));
  Frames.load(el.preview);
  await renderNow();
  await toLine(at);
}

async function ask() {
  let now;
  try {
    now = await api('GET', '/api/dev');
  } catch {
    return; // down, while it starts again
  }
  if (!known) known = now;
  else if (now.boot !== known.boot || pending) await show(now);
}

/** Starts asking, once `/api/info` has said this is `npm run dev`. */
export function wireDev(info) {
  if (!info?.dev) return;
  window.addEventListener('message', (e) => {
    if (e.source === el.preview.contentWindow && e.data?.type === 'scrolled') line = Number(e.data.line) || 0;
  });
  const tick = async () => {
    await ask();
    setTimeout(tick, EVERY);
  };
  tick();
}
