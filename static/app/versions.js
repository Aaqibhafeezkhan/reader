/**
 * Folders and versions in the file list, worked out from the flat list of
 * files the server sends.
 *
 * A file's versions share its name: `slides.md` is the main one, and
 * `slides.arc1.md` and `slides.sketch.md` are others. `a.b.md` is a version
 * of `a` when `a.md` is there too, or when another `a.*` file is; with more
 * than one dot, the longest such name wins. A version of a version
 * (`a.b.c.md` beside `a.b.md` and `a.md`) is one more version of `a`.
 */

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const byName = (a, b) => collator.compare(a, b);

export function splitPath(p) {
  const slash = p.lastIndexOf('/');
  const name = p.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  return {
    dir: slash < 0 ? '' : p.slice(0, slash),
    name,
    stem: dot > 0 ? name.slice(0, dot) : name,
    ext: dot > 0 ? name.slice(dot) : '',
  };
}

export const dirOf = (p) => splitPath(p).dir;
/** `name` in folder `dir`, `''` being the top. */
export const joinPath = (dir, name) => (dir ? `${dir}/${name}` : name);
const label = (f) => splitPath(f.path).name.replace(/\.(md|markdown)$/i, '');

/** The name `stem` is a version of, or null. */
function baseOf(stem, stems) {
  const prefixes = [];
  for (let i = stem.lastIndexOf('.'); i > 0; i = stem.lastIndexOf('.', i - 1)) prefixes.push(stem.slice(0, i));
  return prefixes.find((p) => stems.has(p))
    ?? prefixes.find((p) => [...stems].some((s) => s !== stem && s.startsWith(p + '.')))
    ?? null;
}

/**
 * One folder's files as rows: { kind: 'file', file } or
 * { kind: 'group', name, main, versions: [{ file, variant }], opens }.
 * `main` is null when there's no file by the group's own name; the group
 * then opens the version edited last.
 */
export function groupFiles(files) {
  const stems = new Set(files.map((f) => splitPath(f.path).stem));
  const parent = new Map([...stems].map((s) => [s, baseOf(s, stems)]));
  const rootOf = (s) => {
    let b = s;
    while (parent.get(b)) b = parent.get(b);
    return b;
  };

  const buckets = new Map();
  for (const f of files) {
    const key = rootOf(splitPath(f.path).stem);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(f);
  }

  const rows = [];
  for (const [name, members] of buckets) {
    if (members.length === 1) {
      rows.push({ kind: 'file', file: members[0], name: label(members[0]) });
      continue;
    }
    const versions = members.map((file) => ({ file, variant: splitPath(file.path).stem.slice(name.length + 1) }));
    // The main version first, a document before a PDF of the same name.
    const pdf = (v) => (v.file.type === 'pdf' ? 1 : 0);
    versions.sort((a, b) => Boolean(a.variant) - Boolean(b.variant) || byName(a.variant, b.variant) || pdf(a) - pdf(b));
    const main = versions[0].variant === '' ? versions[0].file : null;
    const latest = members.reduce((a, b) => (b.mtime > a.mtime ? b : a));
    rows.push({ kind: 'group', name, dir: dirOf(members[0].path), main, versions, opens: main || latest });
  }
  return rows.sort((a, b) => byName(a.name, b.name));
}

/** What's in `dir`: its rows, and the folders under it that have something to open. */
export function folderView(files, dir) {
  const prefix = dir ? dir + '/' : '';
  const here = [];
  const folders = new Set();
  for (const f of files) {
    if (!f.path.startsWith(prefix)) continue;
    const rest = f.path.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash < 0) here.push(f);
    else folders.add(rest.slice(0, slash));
  }
  return { rows: groupFiles(here), folders: [...folders].sort(byName) };
}

export function hasFolder(files, dir) {
  return !dir || files.some((f) => f.path.startsWith(dir + '/'));
}

/** Every folder's rows, flat, each with its folder, by folder and then name. */
function everyFolder(files) {
  const byDir = new Map();
  for (const f of files) {
    const d = dirOf(f.path);
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(f);
  }
  const rows = [];
  for (const [dir, list] of byDir) rows.push(...groupFiles(list).map((row) => ({ ...row, dir })));
  return rows.sort((a, b) => byName(a.dir, b.dir) || byName(a.name, b.name));
}

/** The rows any of whose files match `q`, from every folder. */
export function filtered(files, q) {
  return everyFolder(files).filter((row) => {
    const members = row.kind === 'group' ? row.versions.map((v) => v.file) : [row.file];
    return members.some((f) => f.path.toLowerCase().includes(q));
  });
}

/** The rows of the files dated `day`, from every folder. */
export function datedRows(files, day) {
  return day ? everyFolder(files.filter((f) => f.date === day)) : [];
}

/** The group named `name` in `dir`, if it's still there. */
export function findGroup(files, dir, name) {
  return folderView(files, dir).rows.find((r) => r.kind === 'group' && r.name === name) || null;
}

/** The group `p` is a version of, if any. */
export function groupOf(files, p) {
  const dir = dirOf(p);
  return folderView(files, dir).rows.find((r) => r.kind === 'group' && r.versions.some((v) => v.file.path === p)) || null;
}
