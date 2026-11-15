/**
 * The address: the file open, the lines gone to, and how it's set to be
 * seen, which a feature in the preview frame keeps there so a view can be
 * shared or reloaded: `/read/notes/review.md:13-18?by=%23&about=c`. The file
 * is in the path, under `/read/`, each folder's name encoded, so its own `?`,
 * `#` or `:` can't be taken for the address's; the hash is left for a
 * heading (gh-292).
 *
 * An address in the old form, the file in the hash, `#notes%2Freview.md:13`,
 * is still read, so a bookmark or a line's address copied before still opens.
 */

/** Where a file's address starts: the app answers anything under it. */
export const READ = '/read/';

/** The path and query of `path`'s address, at `line` (to `last`), seen as `params` says. */
export function addressOf(path, { line, last, params = {} } = {}) {
  const kept = Object.entries(params).filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && v);
  const query = new URLSearchParams(kept).toString();
  const at = line ? `:${line}${last > line ? `-${last}` : ''}` : '';
  return `${READ}${path.split('/').map(encodeURIComponent).join('/')}${at}${query ? `?${query}` : ''}`;
}

/** What the address names: `{ wanted, line, last, params, old }`; one that doesn't decode names nothing. */
export function readAddress() {
  const old = !location.pathname.startsWith(READ);
  // The old form had the whole of it in the hash, query and all.
  const raw = old ? location.hash.slice(1) : location.pathname.slice(READ.length) + location.search;
  const q = raw.indexOf('?');
  // Lines are read before decoding, as a `:` in a file's name is encoded.
  const [, named, line, last] = (q < 0 ? raw : raw.slice(0, q)).match(/^(.*?)(?::(\d+)(?:-(\d+))?)?$/);
  let wanted;
  try {
    wanted = decodeURIComponent(named);
  } catch {
    return { params: {} };
  }
  const params = q < 0 ? {} : Object.fromEntries(new URLSearchParams(raw.slice(q + 1)));
  return { wanted, line: line && Number(line), last: Number(last || line), params, ...(old && raw ? { old } : {}) };
}

/** How the address says `path` is to be seen, if it names that file, or nothing. */
export function paramsFor(path) {
  const a = readAddress();
  return a.wanted === path ? a.params : {};
}

/**
 * The address set to `path`, seen as `params` says, an empty one left out.
 * A heading in the hash stays while it's the same file.
 */
export function writeAddress(path, params = {}) {
  const same = !readAddress().old && readAddress().wanted === path;
  history.replaceState(null, '', `${addressOf(path, { params })}${same ? location.hash : ''}`);
}

/** The address naming no file. */
export function clearAddress() {
  history.replaceState(null, '', '/');
}
