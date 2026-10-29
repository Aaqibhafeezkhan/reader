/**
 * Saving: autosave, explicit saves, conflicts with edits made elsewhere.
 */

import { scheduleGutter } from './lines.js';
import { el, state, deck, dirty, AUTOSAVE_DELAY } from './state.js';
import { api } from './api.js';
import { renderNow } from './render.js';
import { loadDeck, showSlide, closeDeck } from './deck.js';
import { loadTree } from './files.js';
import { setSaveState, updateDirty, updateCounts, toast } from './status.js';

let saveTimer = 0;
export function scheduleSave(delay = AUTOSAVE_DELAY) {
  clearTimeout(saveTimer);
  if (state.conflict) return;
  saveTimer = setTimeout(() => save(), delay);
}

// A save the server couldn't take, because it was down or failed, is tried
// again, less often each time, until it goes through; what it refused (a
// conflict, a path it won't write) waits for the next edit.
const RETRY_LIMIT = 30000;
let retryDelay = 0;

/** Saves are queued so two never race each other to disk. */
export function save({ explicit = false, force = false } = {}) {
  clearTimeout(saveTimer);
  state.saving = state.saving.then(() => doSave({ explicit, force }));
  return state.saving;
}

/**
 * Saves the open file if it has edits, and says whether they're on disk: a
 * conflict or a failed save leaves them only in the editor, where they must
 * stay until they're kept or let go.
 */
export async function saveFirst() {
  if (dirty()) await save();
  return !dirty();
}

export async function doSave({ explicit, force }) {
  const cur = state.current;
  if (cur?.type !== 'md') return;
  if (state.conflict && !force) return;
  const text = el.editor.value;
  if (text === state.saved && !explicit) return;

  setSaveState('saving…');
  // What the page's inputs wrote goes up as theirs once (server.js): if
  // it's refused, it goes up with what's typed next, as the typing's.
  const worked = state.worked;
  state.worked = false;
  try {
    const out = await api('PUT', '/api/file', {
      path: cur.path, text, baseMtime: state.mtime, explicit, force, worked,
    });
    if (state.current?.path !== cur.path) return;
    saved(cur.path, text, out.mtime);
  } catch (err) {
    if (err.status === 409) {
      state.worked ||= worked;
      setConflict(true);
      setSaveState('not saved', 'err');
    } else if (err.status === 423) {
      setSaveState('not saved', 'err');
      toast(err.message, true);
    } else {
      state.worked ||= worked;
      setSaveState('not saved', 'err');
      const away = err.status === undefined || err.status >= 500;
      // Said once, not on every try while the server is away.
      if (!away || !retryDelay) toast(`save failed: ${err.message}`, true);
      retryDelay = away ? Math.min(RETRY_LIMIT, retryDelay * 2 || 2000) : 0;
      if (away) scheduleSave(retryDelay);
    }
  }
  updateDirty();
}

/** Takes `text` as what's on disk at `mtime`. */
function saved(path, text, mtime) {
  state.saved = text;
  state.mtime = mtime;
  retryDelay = 0;
  setConflict(false);
  setSaveState('saved', 'ok');
  const f = state.files.find((x) => x.path === path);
  if (f) f.mtime = mtime;
}

/**
 * Saves the open file as the page is left, as best it can: a keepalive
 * request outlives the page. If the page stays after all (Stay, at the
 * prompt), what it saved is taken as saved, so the next save isn't a
 * conflict with it.
 */
export function saveOnLeave() {
  const { path } = state.current;
  const text = el.editor.value;
  const sent = fetch('/api/file', {
    method: 'PUT',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, text, baseMtime: state.mtime, worked: state.worked }),
  }).then((res) => (res.ok ? res.json() : null)).catch(() => null);
  state.saving = state.saving.then(() => sent).then((out) => {
    if (!out || state.current?.path !== path) return;
    saved(path, text, out.mtime);
    updateDirty();
  });
}

export function setConflict(on) {
  state.conflict = on;
  el.conflict.hidden = !on;
}

export async function reloadFromDisk() {
  if (state.current?.type !== 'md') return;
  const file = await api('GET', `/api/file?path=${encodeURIComponent(state.current.path)}`);
  const { selectionStart, selectionEnd, scrollTop } = el.editor;
  state.saved = file.text;
  state.mtime = file.mtime;
  el.editor.value = file.text;
  el.editor.setSelectionRange(selectionStart, selectionEnd);
  el.editor.scrollTop = scrollTop;
  setConflict(false);
  updateDirty();
  updateCounts();
  scheduleGutter();
  renderNow();
  if (deck.open) loadDeck().then((ok) => (ok ? showSlide() : closeDeck()));
}

/** When the window regains focus, pick up edits made in another editor. */
export async function checkDisk() {
  loadTree().catch(() => {});
  if (state.current?.type !== 'md' || state.conflict) return;
  let file;
  try {
    file = await api('GET', `/api/file?path=${encodeURIComponent(state.current.path)}`);
  } catch {
    return;
  }
  if (file.mtime === state.mtime) return;
  if (dirty()) setConflict(true);
  else reloadFromDisk();
}
