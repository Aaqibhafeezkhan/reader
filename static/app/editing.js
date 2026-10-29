/**
 * Editing: the editor's shortcuts, and edits the rendered page asks for.
 */

import { applyEdits } from '../edits.js';
import { el, state, deck } from './state.js';
import { renderNow, scheduleRender } from './render.js';
import { scheduleSave } from './saving.js';
import { loadDeck, showSlide, scheduleDeckReload } from './deck.js';
import { updateDirty, updateCounts } from './status.js';
import { COPIED } from './sync.js';

/** Insert via execCommand so the browser's undo stack still works. */
export function replaceSelection(text, selectFrom, selectTo) {
  const t = el.editor;
  t.focus();
  const start = t.selectionStart;
  if (!document.execCommand('insertText', false, text)) {
    t.setRangeText(text, t.selectionStart, t.selectionEnd, 'end');
    t.dispatchEvent(new Event('input'));
  }
  if (selectFrom != null) t.setSelectionRange(start + selectFrom, start + selectTo);
}

export function wrap(before, after) {
  const t = el.editor;
  const sel = t.value.slice(t.selectionStart, t.selectionEnd);
  replaceSelection(before + sel + after, before.length, before.length + sel.length);
}

export function insertLink() {
  const t = el.editor;
  const sel = t.value.slice(t.selectionStart, t.selectionEnd) || 'text';
  const text = `[${sel}](https://)`;
  replaceSelection(text, sel.length + 3, text.length - 1);
}

let row = null;

/**
 * Home and End: the caret to the start or end of the line as it wraps on
 * screen, as ⌘← and ⌘→ take it, with `extend` (⇧) selecting to there. A text
 * area on macOS would go to the start or end of all its text, which ⌘↑ and ⌘↓
 * still do.
 *
 * The line the caret is on is laid out again, wrapped as the editor wraps it,
 * to find where each character sits. The end of a row that wraps is before
 * its last character, which is usually the space it wrapped at: just after
 * it, the caret would show at the start of the next row.
 */
export function toLineEdge(end, extend) {
  const t = el.editor;
  const backward = t.selectionDirection === 'backward';
  const anchor = backward ? t.selectionEnd : t.selectionStart;
  const head = extend ? (backward ? t.selectionStart : t.selectionEnd) : (end ? t.selectionEnd : t.selectionStart);
  const from = t.value.lastIndexOf('\n', head - 1) + 1;
  let to = t.value.indexOf('\n', head);
  if (to < 0) to = t.value.length;

  if (!row) {
    row = document.createElement('div');
    row.className = 'editor-mirror';
    row.setAttribute('aria-hidden', 'true');
    document.body.append(row);
  }
  const style = getComputedStyle(t);
  for (const p of COPIED) row.style[p] = style[p];
  row.style.width = `${t.clientWidth}px`;
  row.textContent = t.value.slice(from, to);
  const text = row.firstChild;
  const len = to - from;
  const range = document.createRange();
  const top = (i) => {
    range.setStart(text, i);
    range.setEnd(text, i + 1);
    return range.getBoundingClientRect().top;
  };

  let at = head - from;
  if (len) {
    const k = Math.min(at, len - 1);
    const y = top(k);
    if (end) {
      let lo = k;
      let hi = len - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (top(mid) > y) hi = mid - 1;
        else lo = mid;
      }
      at = lo === len - 1 ? len : lo;
    } else {
      let lo = 0;
      let hi = k;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (top(mid) < y) lo = mid + 1;
        else hi = mid;
      }
      at = lo;
    }
  }
  row.textContent = '';

  const caret = from + at;
  if (!extend) t.setSelectionRange(caret, caret);
  else if (caret < anchor) t.setSelectionRange(caret, anchor, 'backward');
  else t.setSelectionRange(anchor, caret, 'forward');
}

/**
 * The rendered page (or a slide) asked for an edit: a checkbox ticked, a
 * field filled in, a puzzle played. It names the lines it was drawn from and
 * what they said (see edits.js); if they've changed since, the page was
 * behind, so it's drawn again instead. It works in work mode too: ticking a
 * box or filling in a form isn't editing the file.
 *
 * `undo` puts the edit on the editor's undo stack, which means passing it
 * through the editor's focus, and back; not in work mode or while presenting,
 * though, and not for a field or puzzle, which would lose the keyboard. `drawn` says the page shows the
 * edit already and needn't be rendered again for it.
 */
export function applyEdit({ edits, undo = false, drawn = false }, { fromStage = false } = {}) {
  if (state.current?.type !== 'md') return;
  const t = el.editor;
  const change = applyEdits(t.value, edits);
  if (!change || (change.start === change.end && !change.text)) {
    renderNow();
    if (deck.open) loadDeck().then((ok) => ok && showSlide());
    return;
  }
  // For the server to refuse, should the page be long past its time.
  state.worked = true;
  const lines = t.value.split('\n').length;
  const { selectionStart, selectionEnd, scrollTop } = t;
  if (undo && !state.working && !deck.open) {
    const had = document.activeElement;
    t.focus({ preventScroll: true });
    t.setSelectionRange(change.start, change.end);
    if (!document.execCommand('insertText', false, change.text)) {
      t.setRangeText(change.text, change.start, change.end);
      t.dispatchEvent(new Event('input'));
    }
    t.setSelectionRange(selectionStart, selectionEnd);
    // The keyboard goes back to the page, on the box it ticked.
    if (had && had !== t && had !== document.body) had.focus({ preventScroll: true });
    if (had === el.preview) el.preview.contentWindow.postMessage({ type: 'refocus' }, '*');
  } else {
    t.setRangeText(change.text, change.start, change.end);
    if (drawn) {
      updateDirty();
      updateCounts();
      scheduleSave();
      // Lines below moved, so what the page knows of them is out of date.
      if (t.value.split('\n').length !== lines) scheduleRender();
    } else {
      onEditorInput();
    }
  }
  t.scrollTop = scrollTop;
  if (fromStage) {
    // The slide shows the edit already; bring the deck and the (hidden)
    // preview up to date for when they're next drawn.
    scheduleRender();
    scheduleDeckReload();
  }
}

export function onEditorInput() {
  updateDirty();
  updateCounts();
  scheduleRender();
  scheduleSave();
}
