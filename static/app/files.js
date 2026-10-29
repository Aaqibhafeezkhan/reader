/**
 * The file list, a folder at a time, and opening and creating files.
 * versions.js works out which files are versions of which, and manage.js
 * branches, renames and deletes them. One level below the open file is its
 * outline (outline.js).
 */

import { el, state, remembered, remember } from './state.js';
import { api, exportUrl, contentUrl } from './api.js';
import { saveFirst, setConflict } from './saving.js';
import { exportDocument } from './exporting.js';
import { showPdf } from './pdf.js';
import { renderNow, showPreview, showEmpty } from './render.js';
import { scheduleGutter } from './lines.js';
import { setSaveState, updateCounts, toast } from './status.js';
import { updatePresentable } from './deck.js';
import { openIn } from './modes.js';
import { folderView, filtered, findGroup, groupOf, hasFolder, dirOf, splitPath } from './versions.js';
import { branch, rename, trash, promote } from './manage.js';
import { drawOutline, entryKey, pickKey } from './outline.js';

// Drawn with the text's own colour; the trash's is set red in the stylesheet.
const ICONS = {
  branch: '<circle cx="4.5" cy="3.5" r="1.5"/><circle cx="4.5" cy="12.5" r="1.5"/><circle cx="11.5" cy="4.5" r="1.5"/><path d="M4.5 5v6M11.5 6c0 3.5-7 2.5-7 5"/>',
  export: '<path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/>',
  trash: '<path d="M2.5 4.5h11M6 4.5V2.8h4v1.7M4 4.5l.8 9h6.4l.8-9M6.8 7v4.5M9.2 7v4.5"/>',
  extract: '<path d="M9.5 2.5h4v4M13.5 2.5 8 8M11.5 9.5v3.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V5.3a.8.8 0 0 1 .8-.8h3.2"/>',
  promote: '<path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4l-3.6 1.9.7-4L2.2 6.5l4-.6z"/>',
};
export const icon = (name) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

export async function loadTree() {
  const { files } = await api('GET', '/api/tree');
  state.files = files;
  drawTree();
}

/**
 * One folder at a time, its files by name and then the folders under it;
 * or one file's versions; or the open file's outline; or, while filtering,
 * every match in one flat list.
 */
export function drawTree() {
  // A name being edited stays put; the list is drawn again when it's done.
  if (el.files.querySelector('.renaming')) return;
  // Redrawn under the keyboard (the list reloads when the window gets focus),
  // the row that had focus keeps it; one of a row's actions, found again by
  // its row and its kind (trash, export, ...), keeps it too.
  const at = el.files.contains(document.activeElement) ? document.activeElement : null;
  const kind = at?.matches('.row-action') ? [...at.classList].find((c) => c !== 'row-action') : null;
  const had = kind ? at.closest('li').querySelector(':scope > .entry, :scope > .file, :scope > .folder') : at;
  const same = had && (had.dataset.entry ? `.entry[data-entry="${CSS.escape(had.dataset.entry)}"]`
    : had.dataset.group ? `.group[data-group="${CSS.escape(had.dataset.group)}"]`
    : had.dataset.path ? `.file[data-path="${CSS.escape(had.dataset.path)}"]`
    : had.dataset.dir ? `.folder[data-dir="${CSS.escape(had.dataset.dir)}"]` : null);
  drawRows();
  const row = same && el.files.querySelector(same);
  // An action that's gone from its row leaves focus on the row.
  ((kind && row?.closest('li').querySelector(`.row-action.${CSS.escape(kind)}`)) || row)?.focus();
}

function drawRows() {
  const q = el.filter.value.trim().toLowerCase();
  while (!hasFolder(state.files, state.dir)) state.dir = dirOf(state.dir);
  if (state.group && !findGroup(state.files, state.dir, state.group)) state.group = null;
  el.files.replaceChildren();
  drawCrumbs(!q);

  if (q) {
    for (const row of filtered(state.files, q)) el.files.append(rowItem(row, { dir: row.dir }));
    return;
  }
  if (state.outline && state.current?.type === 'md') return drawOutline();
  if (state.group) {
    const group = findGroup(state.files, state.dir, state.group);
    for (const v of group.versions) el.files.append(versionItem(group, v));
    return;
  }
  const { rows, folders } = folderView(state.files, state.dir);
  for (const row of rows) el.files.append(rowItem(row));
  for (const name of folders) el.files.append(folderItem(name));
}

function drawCrumbs(shown) {
  const parts = state.dir ? state.dir.split('/') : [];
  el.crumbs.hidden = !shown || (!parts.length && !state.group && !state.outline);
  el.crumbs.replaceChildren();
  if (el.crumbs.hidden) return;
  const steps = [{ label: state.rootName, dir: '', group: null }];
  parts.forEach((part, i) => steps.push({ label: part, dir: parts.slice(0, i + 1).join('/'), group: null }));
  if (state.group) steps.push({ label: state.group, dir: state.dir, group: state.group });
  if (state.outline && state.current) steps.push({ label: splitPath(state.current.path).name.replace(/\.(md|markdown)$/i, '') });
  steps.forEach((s, i) => {
    if (i) el.crumbs.append(Object.assign(document.createElement('span'), { className: 'sep', textContent: '›' }));
    const b = document.createElement('button');
    b.textContent = s.label;
    if (i === steps.length - 1) b.setAttribute('aria-current', 'location');
    else b.addEventListener('click', () => go(s.dir, s.group));
    el.crumbs.append(b);
  });
}

function button(cls, name, sub) {
  const b = document.createElement('button');
  b.className = cls;
  // What the arrows, F2 and ⌘⌫ do here, read after the row's name.
  b.setAttribute('aria-describedby', 'filesKeys');
  const n = document.createElement('span');
  n.className = 'name';
  n.textContent = name;
  b.append(n);
  if (sub) {
    const s = document.createElement('span');
    s.className = 'sub';
    s.textContent = sub;
    b.append(s);
  }
  return b;
}

/** A file, or a file and its versions, which opens the main one. */
function rowItem(row, { dir = '' } = {}) {
  const li = document.createElement('li');
  if (row.kind === 'file') {
    const f = row.file;
    const b = button('file', row.name, [dir, f.type === 'pdf' ? 'pdf' : ''].filter(Boolean).join(' · '));
    fileButton(b, f.path);
    li.append(b, actions([
      f.type === 'md' && action('branch', 'Branch: copy as another version', () => branch(f.path)),
      f.type === 'md' && exportLink(f.path),
      action('trash', 'Move to the trash', () => trash(f.path)),
    ]), outlineInto(f));
    return li;
  }
  const b = button('file group', row.name, [dir, `${row.versions.length} versions`].filter(Boolean).join(' · '));
  fileButton(b, row.opens.path);
  b.dataset.group = row.name;
  b.dataset.dir = row.dir;
  if (row.versions.some((v) => v.file.path === state.current?.path)) markNow(b);
  const into = action('into', `Versions of ${row.name}`, () => go(row.dir, row.name));
  into.textContent = '›';
  li.append(b, actions([
    row.opens.type === 'md' && action('branch', 'Branch: copy as another version', () => branch(row.opens.path)),
  ]), into);
  return li;
}

function versionItem(group, v) {
  const li = document.createElement('li');
  const when = new Date(v.file.mtime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const b = button('file', v.variant || 'main', [when, v.file.type === 'pdf' ? 'pdf' : ''].filter(Boolean).join(' · '));
  fileButton(b, v.file.path);
  const md = v.file.type === 'md';
  li.append(b, actions([
    md && v.variant && action('promote', `Make ${v.variant} the main version`, () => promote(v.file.path, group.name)),
    md && action('branch', 'Branch: copy as another version', () => branch(v.file.path)),
    md && exportLink(v.file.path),
    action('trash', 'Move to the trash', () => trash(v.file.path)),
  ]), outlineInto(v.file));
  return li;
}

/** Into the open file's outline, from its row. */
function outlineInto(f) {
  if (f.type !== 'md' || state.current?.path !== f.path) return '';
  const into = action('into', 'Outline', showOutline);
  into.textContent = '›';
  return into;
}

/** What can be done to a row, shown when it's hovered, focused or open. */
function actions(list) {
  const span = document.createElement('span');
  span.className = 'actions';
  span.append(...list.filter(Boolean));
  return span;
}

function folderItem(name) {
  const li = document.createElement('li');
  const dir = state.dir ? `${state.dir}/${name}` : name;
  const b = button('folder', name);
  b.dataset.dir = dir;
  b.addEventListener('click', () => go(dir, null));
  li.append(b);
  return li;
}

function fileButton(b, p) {
  b.dataset.path = p;
  b.title = `${p} (double-click to rename)`;
  if (state.current?.path === p) markNow(b);
  b.addEventListener('click', () => {
    if (state.current?.path !== p) open(p);
  });
}

/** The open file's row, or the row of versions it's one of; the list is drawn again whenever that changes. */
function markNow(b) {
  b.classList.add('now');
  b.setAttribute('aria-current', 'true');
}

/** Double-clicking a row's name edits it. */
export function onListDoubleClick(e) {
  const b = e.target.closest('.file');
  if (!b) return;
  e.preventDefault();
  rename(b.dataset.path, { group: b.dataset.group || null });
}

function action(cls, title, onClick) {
  const b = document.createElement('button');
  b.className = `row-action ${cls}`;
  if (ICONS[cls]) b.innerHTML = icon(cls);
  b.title = title;
  b.setAttribute('aria-label', title);
  b.addEventListener('click', onClick);
  return b;
}

/** Show a folder, or one file's versions in it, or the open file's outline below them; and remember the folder. */
export function go(dir, group = null, { focus = true, outline = false } = {}) {
  const from = { dir: state.dir, group: state.group, outline: state.outline };
  state.dir = dir;
  state.group = group;
  state.outline = outline;
  remember(`reader:dir:${state.root}`, dir);
  drawTree();
  if (!focus) return;
  if (outline) return (el.files.querySelector('.entry.at') || rows()[0])?.focus();
  // Going up lands on the folder or the file just left.
  const back = from.group && !group ? `.group[data-group="${CSS.escape(from.group)}"]`
    : childOn(dir, from.dir) ? `.folder[data-dir="${CSS.escape(childOn(dir, from.dir))}"]`
    : null;
  ((back && el.files.querySelector(back)) || el.files.querySelector('.now') || rows()[0])?.focus();
}

/** The folder in `dir` that leads to `below`, if `below` is under it. */
function childOn(dir, below) {
  const prefix = dir ? `${dir}/` : '';
  if (below === dir || !below.startsWith(prefix)) return null;
  return prefix + below.slice(prefix.length).split('/')[0];
}

/** The open file's outline, below the folder or versions it's listed in. */
export function showOutline() {
  if (state.current?.type !== 'md') return;
  const group = groupOf(state.files, state.current.path);
  go(dirOf(state.current.path), group && group.opens.path !== state.current.path ? group.name : null, { outline: true });
}

export function up() {
  if (state.outline) go(state.dir, state.group);
  else if (state.group) go(state.dir, null);
  else if (state.dir) go(dirOf(state.dir), null);
}

export function rememberedDir() {
  return remembered(`reader:dir:${state.root}`) || '';
}

/** Show the folder `p` is in, and its versions if it isn't the one its row opens. */
export function reveal(p) {
  const group = groupOf(state.files, p);
  go(dirOf(p), group && group.opens.path !== p ? group.name : null, { focus: false });
}

/** A link the preview was asked to follow, to a markdown file: opened here if it's one of ours. */
export function follow(href) {
  const url = new URL(href);
  const root = new URL(contentUrl(''), location.href);
  const p = url.origin === root.origin && url.pathname.startsWith(root.pathname)
    ? url.pathname.slice(root.pathname.length).split('/').map(decodeURIComponent).join('/')
    : null;
  if (!p || !state.files.some((f) => f.path === p && f.type === 'md')) return toast(`no file ${p ?? url.pathname} here`, true);
  if (p === state.current?.path) return;
  reveal(p);
  open(p);
}

const rows = () => [...el.files.querySelectorAll('.file, .folder, .entry')];

/** Arrows move down the list; → goes into a folder, a file's versions or the open file's outline, ← back out. */
export function onListKey(e) {
  if (e.target.matches('input')) return;
  if (state.outline && pickKey(e)) return e.preventDefault();
  const at = document.activeElement;
  if (at?.matches('.entry') && entryKey(e, at)) return e.preventDefault();
  const list = rows();
  // From one of a row's actions, the arrows go on from its row.
  const i = list.indexOf(list.includes(at) ? at : at?.closest('li')?.querySelector('.file, .folder, .entry'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    list[Math.min(list.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  } else if (e.key === 'ArrowRight' && at?.matches('.folder, .group')) {
    e.preventDefault();
    go(at.dataset.dir, at.dataset.group || null);
  } else if (e.key === 'ArrowRight' && at?.matches('.file')) {
    e.preventDefault();
    (state.current?.path === at.dataset.path ? Promise.resolve() : open(at.dataset.path)).then(showOutline);
  } else if (e.key === 'F2' && at?.matches('.file')) {
    e.preventDefault();
    rename(at.dataset.path, { group: at.dataset.group || null });
  } else if (e.key === 'Backspace' && e.metaKey && at?.matches('.file:not(.group)')) {
    e.preventDefault();
    trash(at.dataset.path);
  } else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && !e.metaKey && !el.filter.value.trim() && list.includes(at)) {
    e.preventDefault();
    up();
  }
}

/**
 * Saves the document as an HTML file, as it is on disk: what's unsaved is
 * saved first. The link itself leads to the file with nothing drawn in it.
 */
function exportLink(p) {
  const a = document.createElement('a');
  a.className = 'row-action export';
  a.href = exportUrl(p);
  a.download = '';
  a.title = 'Export as HTML';
  a.setAttribute('aria-label', `Export ${p} as HTML`);
  a.innerHTML = icon('export');
  a.addEventListener('click', async (e) => {
    e.preventDefault();
    if (state.current?.path === p && !(await saveFirst())) return toast('not saved, so not exported', true);
    try {
      await exportDocument(p);
    } catch (err) {
      toast(`export: ${err.message}`, true);
    }
  });
  return a;
}

export function visiblePaths() {
  return [...el.files.querySelectorAll('.file')].map((b) => b.dataset.path);
}

/** The files in the folder or versions shown, or that the outline is shown below. */
function listedPaths() {
  if (!state.outline || el.filter.value.trim()) return visiblePaths();
  if (state.group) return findGroup(state.files, state.dir, state.group)?.versions.map((v) => v.file.path) ?? [];
  return folderView(state.files, state.dir).rows.map((r) => (r.kind === 'file' ? r.file.path : r.opens.path));
}

export function step(delta) {
  const paths = listedPaths();
  if (!paths.length) return;
  const i = paths.indexOf(state.current?.path);
  const next = paths[Math.min(paths.length - 1, Math.max(0, i + delta))];
  if (next && next !== state.current?.path) open(next);
}

export async function open(p) {
  const seq = ++state.openSeq;
  const kept = await saveFirst();
  if (seq !== state.openSeq) return;
  // Opening another file would put its text over edits that are nowhere else.
  if (!kept) return toast('not saved, so still open: reload it or overwrite it first', true);

  const entry = state.files.find((f) => f.path === p);
  const type = entry?.type || (/\.pdf$/i.test(p) ? 'pdf' : 'md');
  setConflict(false);

  if (type === 'pdf') {
    state.current = { path: p, type };
    state.saved = '';
    el.editor.value = '';
    showPdf(p);
  } else {
    let file;
    try {
      file = await api('GET', `/api/file?path=${encodeURIComponent(p)}`);
    } catch (err) {
      return toast(err.message, true);
    }
    if (seq !== state.openSeq) return;
    state.current = { path: p, type };
    state.saved = file.text;
    state.mtime = file.mtime;
    state.worked = false;
    el.editor.value = file.text;
    el.editor.disabled = false;
    el.editor.scrollTop = 0;
    el.editor.setSelectionRange(0, 0);
    // A workbook opens in Work, slides in Edit, a document as last chosen.
    openIn(file.text);
    showPreview();
    renderNow({ resetScroll: true });
  }

  // The outline shown is the open file's, wherever it's listed.
  if (state.outline && type === 'md') {
    const group = groupOf(state.files, p);
    state.dir = dirOf(p);
    state.group = group && group.opens.path !== p ? group.name : null;
  } else state.outline = false;
  history.replaceState(null, '', `#${encodeURIComponent(p)}`);
  document.title = `${p} — ${state.rootName}`;
  el.crumb.textContent = p;
  el.copyPath.hidden = false;
  setSaveState('');
  updateCounts();
  scheduleGutter();
  updatePresentable();
  drawTree();
  el.files.querySelector('.file.now')?.scrollIntoView({ block: 'nearest' });
}

/** Leave nothing open, `msg` where the page was: the header, title, address and counts name no file. */
export function closeFile(msg) {
  state.current = null;
  state.saved = '';
  setConflict(false);
  el.editor.value = '';
  history.replaceState(null, '', location.pathname + location.search);
  document.title = 'reader';
  el.crumb.textContent = '';
  el.copyPath.hidden = true;
  setSaveState('');
  updateCounts();
  scheduleGutter();
  updatePresentable();
  drawTree();
  showEmpty(msg);
}

export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.md`;
}

/** The New form, filled in for a new file in the folder being shown. */
export function showNewForm() {
  const prefix = state.dir ? `${state.dir}/` : '';
  el.newForm.hidden = false;
  el.newName.value = `${prefix}${today()}`;
  el.newName.focus();
  el.newName.setSelectionRange(prefix.length, el.newName.value.length - 3);
}

export async function createFile(name) {
  try {
    const out = await api('POST', '/api/new', { name });
    el.newForm.hidden = true;
    await loadTree();
    reveal(out.path);
    await open(out.path);
    if (!out.created) toast(`${out.path} already exists — opened it`);
    el.editor.focus();
  } catch (err) {
    toast(err.message, true);
  }
}
