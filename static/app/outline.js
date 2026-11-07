/**
 * The open file's outline, in the file list: one level below the file, as
 * a file's versions are one level below its row. Its parts and headings
 * are worked out in sections.js; clicking one goes there, in the editor
 * and the page beside it. The one being read is marked as either scrolls.
 *
 * Parts (and a talk's sections) are folded but for the one being read;
 * headings are open. ▸ and ▾, or → and ←, fold and open one, and that's
 * kept while the file is open.
 *
 * Any entry can be taken out into a file of its own (extracting.js), or
 * several at once: ⌘-click chooses more than one, ⇧-click a run of them,
 * and ⌘A every part.
 */

import { el, state } from './state.js';
import { outline } from './sections.js';
import { goToLine } from './goto.js';
import { topLine } from './sync.js';
import { drawTree } from './files.js';
import { icon } from './icons.js';
import { extractEntries, namesFor } from './extracting.js';

let cache = { text: null, data: null };
let at = 0;                 // the line being read
let toggled = new Map();    // entry key -> open or not, as set by hand
let toggledFor = null;      // the file `toggled` and `picked` are for
let picked = new Set();     // entry keys chosen to extract together
let anchor = null;          // where a ⇧-click's run starts
let byKey = new Map();      // the entries drawn, by key

/** The open file's outline, worked out again only when its text has changed. */
export function current() {
  if (cache.text !== el.editor.value) cache = { text: el.editor.value, data: outline(el.editor.value) };
  return cache.data;
}

const shown = () => state.outline && !el.filter.value.trim() && state.current?.type === 'md';
// An entry's titles from the outermost in: kept for it as lines move with typing.
const keyOf = (e, parent) => `${parent ?? ''}/${e.title}`;
const isFolded = (e) => e.kind === 'part' || e.kind === 'section';

/** The entry that `line` is in, at each depth, outermost first. */
function trail(entries, line, out = []) {
  const e = entries.findLast((x) => x.line <= line && line < x.end);
  if (!e) return out;
  out.push(e);
  return trail(e.children, line, out);
}

function isOpen(e, key) {
  if (toggled.has(key)) return toggled.get(key);
  return !isFolded(e) || (e.line <= at && at < e.end);
}

/** Draws the outline as the file list's rows. */
export function drawOutline() {
  if (toggledFor !== state.current?.path) {
    toggled = new Map();
    picked = new Set();
    toggledFor = state.current?.path;
  }
  byKey = new Map();
  const { entries, parts } = current();
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'outline-empty';
    li.textContent = 'No headings or parts yet. A # heading, or --- between parts, makes one.';
    el.files.append(li);
    return;
  }
  const here = trail(entries, at).at(-1);
  const add = (list, depth, parent) => {
    for (const e of list) {
      let key = keyOf(e, parent);
      // Two entries by one title, side by side, are told apart by their order.
      for (let n = 2; byKey.has(key); n++) key = `${keyOf(e, parent)}#${n}`;
      byKey.set(key, e);
      const open = isOpen(e, key);
      el.files.append(entryItem(e, { depth, key, open, here: e === here, number: parts.findIndex((p) => p.line === e.line) + 1 }));
      if (open) add(e.children, depth + 1, key);
    }
  };
  add(entries, 0, null);
}

function entryItem(e, { depth, key, open, here, number }) {
  const li = document.createElement('li');
  li.className = 'entry-row';
  li.style.setProperty('--depth', depth);
  const fold = document.createElement('button');
  fold.className = 'fold';
  fold.tabIndex = -1;
  if (e.children.length) {
    fold.textContent = open ? '▾' : '▸';
    fold.setAttribute('aria-label', open ? 'Fold' : 'Open');
    fold.addEventListener('click', () => toggle(key, !open));
  } else fold.disabled = true;

  const b = document.createElement('button');
  b.className = `entry ${e.kind}`;
  b.dataset.entry = key;
  b.dataset.line = e.line;
  if (e.children.length) b.setAttribute('aria-expanded', String(open));
  if (here) b.classList.add('at');
  b.title = `Line ${e.head + 1}`;
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = e.title;
  b.append(name);
  if (number && e.kind !== 'heading') {
    const n = document.createElement('span');
    n.className = 'num';
    n.textContent = number;
    b.append(n);
  }
  b.addEventListener('click', (ev) => {
    if (ev.metaKey || ev.ctrlKey) pick(picked.has(key) ? [...picked].filter((k) => k !== key) : [...picked, key], key);
    else if (ev.shiftKey && anchor) pick(run(anchor, key), anchor);
    else {
      pick([], key);
      goToLine(e.head, { focus: false });
    }
  });
  if (picked.has(key)) li.classList.add('picked');

  const out = document.createElement('button');
  out.className = 'row-action extract';
  out.innerHTML = icon('extract');
  out.title = picked.size > 1 && picked.has(key) ? `Extract these ${picked.size} into files of their own` : 'Extract into a file of its own';
  out.setAttribute('aria-label', out.title);
  out.addEventListener('click', () => (picked.size > 1 && picked.has(key) ? extractPicked() : askName(li, e)));
  const actions = document.createElement('span');
  actions.className = 'actions';
  actions.append(out);
  li.append(fold, b, actions);
  return li;
}

/** Chooses the entries `keys`, and marks them. */
function pick(keys, from) {
  picked = new Set(keys);
  anchor = from;
  for (const b of el.files.querySelectorAll('.entry')) b.closest('li').classList.toggle('picked', picked.has(b.dataset.entry));
  for (const a of el.files.querySelectorAll('.row-action.extract')) {
    const many = picked.size > 1 && picked.has(a.closest('li').querySelector('.entry').dataset.entry);
    a.title = many ? `Extract these ${picked.size} into files of their own` : 'Extract into a file of its own';
    a.setAttribute('aria-label', a.title);
  }
}

/** The entries shown from one to the other, either way round. */
function run(from, to) {
  const keys = [...el.files.querySelectorAll('.entry')].map((b) => b.dataset.entry);
  const [a, b] = [keys.indexOf(from), keys.indexOf(to)].sort((x, y) => x - y);
  return a < 0 ? [to] : keys.slice(a, b + 1);
}

/** The chosen entries, each once: one inside another goes with it. */
function extractPicked() {
  const keys = [...picked].filter((k) => ![...picked].some((o) => o !== k && k.startsWith(`${o}/`)));
  const entries = keys.map((k) => byKey.get(k)).filter(Boolean);
  picked = new Set();
  extractEntries(entries, namesFor(entries));
}

/** Asks what to call the file, in the entry's row, as New does. */
function askName(li, e) {
  const [name] = namesFor([e]);
  const input = document.createElement('input');
  input.className = 'name-edit';
  input.value = name;
  input.spellcheck = false;
  input.setAttribute('aria-label', 'The new file\'s name');
  li.classList.add('renaming');
  li.querySelector('.entry').replaceWith(input);
  input.focus();
  input.setSelectionRange(0, name.length - 3);
  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    li.classList.remove('renaming');
    const typed = input.value.trim();
    if (keep && typed) extractEntries([e], [typed]).then(drawTree);
    else drawTree();
  };
  input.addEventListener('keydown', (ev) => {
    ev.stopPropagation();
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
  });
  // Clicking away leaves it as it was: nothing is made without Enter.
  input.addEventListener('blur', () => finish(false));
}

/** ⌘A chooses every part, and Esc none. */
export function pickKey(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
    pick(current().entries.map((x) => [...byKey].find(([, v]) => v === x)?.[0]).filter(Boolean), null);
    return true;
  }
  if (e.key === 'Escape' && picked.size) {
    pick([], null);
    return true;
  }
  return false;
}

function toggle(key, open) {
  toggled.set(key, open);
  redraw();
}

// drawTree keeps the focused row focused.
const redraw = () => drawTree();

/**
 * Keys on an entry: → opens it, or goes into it; ← folds it, or goes out
 * to the entry it's in. False for a key that isn't the outline's, as ← is
 * on an outermost entry, which goes back out to the files.
 */
export function entryKey(e, b) {
  const open = b.getAttribute('aria-expanded');
  const key = b.dataset.entry;
  if (e.key === 'ArrowRight') {
    if (open === 'false') toggle(key, true);
    else if (open === 'true') b.closest('li').nextElementSibling?.querySelector('.entry')?.focus();
    return true;
  }
  if (e.key === 'ArrowLeft') {
    if (open === 'true') {
      toggle(key, false);
      return true;
    }
    const parent = key.slice(0, key.lastIndexOf('/'));
    if (!parent) return false;
    el.files.querySelector(`.entry[data-entry="${CSS.escape(parent)}"]`)?.focus();
    return true;
  }
  return false;
}

let held = 0;

/**
 * The line being read is `line`: mark the entry it's in, and open its part
 * if it's folded. A place gone to (`goto`) holds against the scrolling it
 * sets off, which may not get there at the end of the file.
 */
export function setAt(line, { goto = false } = {}) {
  if (goto) held = performance.now() + 300;
  else if (performance.now() < held) return;
  if (line === at) return;
  const before = trail(current().entries, at);
  at = line;
  if (!shown()) return;
  const after = trail(current().entries, at);
  if (before[0] !== after[0] && after[0] && isFolded(after[0]) && !toggled.has(keyOf(after[0], null))) return redraw();
  const here = after.reduce((key, e) => keyOf(e, key), null);
  for (const b of el.files.querySelectorAll('.entry')) b.classList.toggle('at', b.dataset.entry === here);
  el.files.querySelector('.entry.at')?.scrollIntoView({ block: 'nearest' });
}

let typing = 0;
export function wireOutline() {
  el.editor.addEventListener('scroll', () => setAt(topLine()), { passive: true });
  window.addEventListener('message', (e) => {
    if (e.source === el.preview.contentWindow && e.data?.type === 'scrolled') setAt(Math.floor(e.data.line));
  });
  // Typing changes the outline; it's drawn again once there's a pause.
  el.editor.addEventListener('input', () => {
    if (!shown()) return;
    clearTimeout(typing);
    typing = setTimeout(redraw, 300);
  });
}
