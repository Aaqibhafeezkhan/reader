/**
 * Changing files from the file list: branching a version, renaming in
 * place, setting aside in the trash (with an undo), and making a version
 * the main one. Every one saves the open file first, and follows it if it
 * moves.
 */

import { el, state } from './state.js';
import { api } from './api.js';
import { saveFirst } from './saving.js';
import { toast } from './status.js';
import { loadTree, open, closeFile, go, reveal, visiblePaths } from './files.js';
import { groupOf, splitPath, dirOf, joinPath } from './versions.js';

const LISTED = new Set(['.md', '.markdown', '.pdf']);

async function saveIfOpen(paths) {
  if (paths.includes(state.current?.path) && !(await saveFirst())) throw new Error('not saved, so left as it was');
}

/** After files move: the list again, and the open file under its new name. */
async function moved(list) {
  await loadTree();
  const now = list.find((m) => m.from === state.current?.path);
  if (now) await open(now.to);
}

/** Copy `p` as `<name>.draft.md` beside it, open the copy, and ask what to call it. */
export async function branch(p) {
  try {
    await saveIfOpen([p]);
    const { dir, stem, ext } = splitPath(p);
    const base = groupOf(state.files, p)?.name || stem;
    const taken = new Set(state.files.map((f) => f.path));
    let to = joinPath(dir, `${base}.draft${ext}`);
    for (let n = 2; taken.has(to); n++) to = joinPath(dir, `${base}.draft-${n}${ext}`);
    await api('POST', '/api/branch', { from: p, to });
    await loadTree();
    go(dir, base, { focus: false });
    await open(to);
    rename(to);
  } catch (err) {
    toast(err.message, true);
  }
}

/**
 * Edit a row's name where it is. A file's row takes its name; a group's row
 * takes the name its versions share, and renames them all; a version's row,
 * in a group's list, takes the version's own name.
 */
export function rename(p, { group = null } = {}) {
  const li = el.files.querySelector(group
    ? `.group[data-group="${CSS.escape(group)}"]`
    : `.file[data-path="${CSS.escape(p)}"]`)?.closest('li');
  if (!li) return;
  const plan = planRename(p, group);
  if (!plan) return;

  const input = document.createElement('input');
  input.className = 'name-edit';
  input.value = plan.value;
  input.spellcheck = false;
  input.setAttribute('aria-label', 'New name');
  li.classList.add('renaming');
  li.querySelector('.file').replaceWith(input);
  input.focus();
  input.setSelectionRange(...(plan.select || [0, plan.value.length]));

  // Done by the keyboard, the row has it back, under whatever it's called now.
  const row = (path, name) => el.files.querySelector(group ? `.group[data-group="${CSS.escape(name)}"]` : `.file[data-path="${CSS.escape(path)}"]`);
  let done = false;
  const finish = async (keep, { refocus = true } = {}) => {
    if (done) return;
    done = true;
    li.classList.remove('renaming');
    const name = input.value.trim();
    if (keep && name && name !== plan.value) {
      try {
        const moves = plan.moves(name);
        await saveIfOpen(moves.map((m) => m.from));
        const out = await api('POST', '/api/rename', { moves });
        await moved(out.moved);
        // A new name can take it out of Today.
        if (refocus) (row(out.moved[0].to, name) || el.filter).focus();
        return;
      } catch (err) {
        toast(err.message, true);
      }
    }
    await loadTree();
    if (refocus) row(p, group)?.focus();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  // Clicked away from, it's left where it was clicked.
  input.addEventListener('blur', () => finish(true, { refocus: false }));
}

/** What a row's name starts as, and the renames a new one means. */
function planRename(p, groupName) {
  if (groupName) {
    const g = groupOf(state.files, p);
    if (!g) return null;
    return {
      value: g.name,
      moves: (name) => g.versions.map(({ file }) => {
        const { dir, stem, ext } = splitPath(file.path);
        return { from: file.path, to: joinPath(dir, name + stem.slice(g.name.length) + ext) };
      }),
    };
  }
  const g = state.group && !el.filter.value.trim() && groupOf(state.files, p);
  const { dir, stem, ext } = splitPath(p);
  if (g) {
    // In a group's list: the version's own name. The main one has none to change.
    const variant = stem.slice(g.name.length + 1);
    if (!variant) return null;
    return { value: variant, moves: (name) => [{ from: p, to: joinPath(dir, `${g.name}.${name}${ext}`) }] };
  }
  // A document's row leaves off `.md`; a PDF's shows `.pdf`. Typing an
  // extension the list shows keeps it, and anything else gets the old one.
  const isDoc = /\.(md|markdown)$/i.test(ext);
  const value = isDoc ? stem : stem + ext;
  return {
    value,
    select: [0, stem.length],
    moves: (name) => {
      const typed = splitPath(name).ext.toLowerCase();
      return [{ from: p, to: joinPath(dir, LISTED.has(typed) ? name : name + ext) }];
    },
  };
}

/** Set `p` aside in the trash, open what was next to it, and offer it back. */
export async function trash(p) {
  try {
    const wasOpen = state.current?.path === p;
    await saveIfOpen([p]);
    const inList = el.files.contains(document.activeElement);
    const paths = visiblePaths();
    const i = paths.indexOf(p);
    const out = await api('POST', '/api/trash', { path: p });
    if (wasOpen) {
      state.current = null;
      state.saved = el.editor.value;
    }
    await loadTree();
    const next = paths.slice(i + 1).concat(paths.slice(0, i).reverse()).find((q) => state.files.some((f) => f.path === q));
    if (wasOpen) {
      if (next) await open(next);
      else closeFile('Nothing open.');
    }
    // Its row is gone; the keyboard goes on to the one after it.
    if (inList) ((next && el.files.querySelector(`.file[data-path="${CSS.escape(next)}"]`)) || el.filter).focus();
    toast(`${splitPath(p).name} is in the trash`, false, { label: 'Undo', run: () => restore(out.trash) });
  } catch (err) {
    toast(err.message, true);
  }
}

async function restore(id) {
  try {
    const { path: p } = await api('POST', '/api/restore', { trash: id });
    await loadTree();
    reveal(p);
    await open(p);
    toast(`${splitPath(p).name} is back`);
  } catch (err) {
    toast(err.message, true);
  }
}

/** Make `p` the main version of `base`; the old main one is named for its day. */
export async function promote(p, base) {
  try {
    await saveIfOpen(groupOf(state.files, p)?.versions.map((v) => v.file.path) || [p]);
    const out = await api('POST', '/api/promote', { path: p, base });
    await moved(out.moved);
    go(dirOf(p), base);
    const aside = out.moved.length > 1 ? `; the old one is now ${splitPath(out.moved[0].to).stem.slice(base.length + 1)}` : '';
    toast(`${splitPath(p).stem.slice(base.length + 1)} is the main version${aside}`);
  } catch (err) {
    toast(err.message, true);
  }
}
