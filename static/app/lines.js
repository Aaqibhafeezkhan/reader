/**
 * Lines: their numbers down the editor's side, and copying where something
 * is (the file and line) to paste into a Claude session, an editor, or a
 * message.
 *
 * A number is a line of the file, however many rows it wraps to; sync.js
 * measures where each one starts. Locally the reference is a path, which
 * an editor or Claude can open. Seen from another device (`--host`), a path
 * on the server is no use to the reader, so it's the file's address here,
 * which opens at that line.
 */

import { el, state, remembered, remember } from './state.js';
import { measure } from './sync.js';
import { toast } from './status.js';
import { addressOf } from './address.js';

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
let drawing = 0;

export function scheduleGutter() {
  if (!drawing) drawing = requestAnimationFrame(drawGutter);
}

/** The numbers of the lines in view, the caret's marked. */
function drawGutter() {
  drawing = 0;
  const t = el.editor;
  if (el.gutter.hidden || state.current?.type !== 'md' || !t.clientWidth) return;
  const tops = measure();
  const count = tops.length - 1;
  el.gutter.style.width = `calc(${Math.max(2, String(count).length)}ch + 18px)`;
  const height = getComputedStyle(t).lineHeight;
  const [now] = linesOf(t.selectionDirection === 'backward' ? t.selectionStart : t.selectionEnd);
  const from = t.scrollTop;
  const to = from + t.clientHeight;

  let i = 0;
  let hi = count - 1;
  while (i < hi) {
    const mid = (i + hi) >> 1;
    if (tops[mid + 1] <= from) i = mid + 1;
    else hi = mid;
  }
  const shown = [];
  for (; i < count && tops[i] < to; i++) {
    const n = document.createElement('div');
    n.textContent = i + 1;
    n.dataset.line = i + 1;
    n.style.top = `${tops[i] - from}px`;
    n.style.height = height;
    n.style.lineHeight = height;
    if (i + 1 === now) n.className = 'now';
    shown.push(n);
  }
  el.gutter.replaceChildren(...shown);
}

/** The lines, from 1, that the characters from `start` to `end` are on. */
function linesOf(start, end = start) {
  const t = el.editor.value;
  const first = t.slice(0, start).split('\n').length;
  // A selection of whole lines ends at the start of the next; that line isn't in it.
  const last = end > start && t[end - 1] === '\n' ? t.slice(0, end - 1).split('\n').length : t.slice(0, end).split('\n').length;
  return [first, Math.max(first, last)];
}

/** Where the open file is, and lines in it if given: a path here, an address from elsewhere. */
function reference(first, last = first) {
  const p = state.current.path;
  if (LOCAL.has(location.hostname)) return `${state.root}/${p}${first ? `:${first}${last > first ? `-${last}` : ''}` : ''}`;
  return `${location.origin}${addressOf(p, { line: first, last })}`;
}

/** The file and the caret's line, or the lines selected. */
export function copyLines() {
  if (state.current?.type !== 'md') return;
  const t = el.editor;
  copy(reference(...linesOf(t.selectionStart, t.selectionEnd)));
}

export function copyPath() {
  if (state.current) copy(reference());
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Away from localhost the page isn't a secure context, and there's no clipboard API.
    const focused = document.activeElement;
    const { selectionStart, selectionEnd } = el.editor;
    const scratch = Object.assign(document.createElement('textarea'), { value: text });
    scratch.style.cssText = 'position: fixed; left: -9999px;';
    document.body.append(scratch);
    scratch.select();
    const ok = document.execCommand('copy');
    scratch.remove();
    focused?.focus({ preventScroll: true });
    if (focused === el.editor) el.editor.setSelectionRange(selectionStart, selectionEnd);
    if (!ok) return toast('could not copy', true);
  }
  toast(`Copied ${text}`);
}

/** Selects lines `first` to `last` and brings them into view, a third of the way down. */
export function goToLines(first, last = first) {
  const t = el.editor;
  const lines = t.value.split('\n');
  const a = Math.max(1, Math.min(first, lines.length));
  const b = Math.max(a, Math.min(last, lines.length));
  const start = lines.slice(0, a - 1).reduce((n, l) => n + l.length + 1, 0);
  const end = lines.slice(0, b).reduce((n, l) => n + l.length + 1, 0) - 1;
  t.focus({ preventScroll: true });
  t.setSelectionRange(start, first === last ? start : end);
  t.scrollTop = Math.max(0, measure()[a - 1] - t.clientHeight / 3);
  scheduleGutter();
}

export function showGutter(on) {
  el.gutter.hidden = !on;
  el.gutterToggle.setAttribute('aria-pressed', String(on));
  remember('reader:lines', on ? 'shown' : 'hidden');
  scheduleGutter();
}

export function wireLines() {
  showGutter(remembered('reader:lines') !== 'hidden');
  el.gutterToggle.addEventListener('click', () => showGutter(el.gutter.hidden));
  el.copyPath.addEventListener('click', copyPath);
  el.gutter.addEventListener('click', (e) => {
    const n = Number(e.target.closest('[data-line]')?.dataset.line);
    if (n) copy(reference(n));
  });
  for (const type of ['scroll', 'input']) el.editor.addEventListener(type, scheduleGutter, { passive: true });
  document.addEventListener('selectionchange', scheduleGutter);
  new ResizeObserver(scheduleGutter).observe(el.editor);
  document.fonts?.ready.then(scheduleGutter);
}
