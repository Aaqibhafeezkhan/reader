/**
 * The address: the file open, the lines gone to, and how it's set to be
 * seen, which a feature in the preview frame keeps there so a view can be
 * shared or reloaded: `#notes/review.md:13-18?by=%23&about=c`. The path is
 * written encoded, so its own `?` can't be taken for the query's.
 */

/** What the address names: `{ wanted, line, last, params }`; one that doesn't decode names nothing. */
export function readAddress() {
  const raw = location.hash.slice(1);
  const q = raw.indexOf('?');
  let path;
  try {
    path = decodeURIComponent(q < 0 ? raw : raw.slice(0, q));
  } catch {
    return { params: {} };
  }
  const [, wanted, line, last] = path.match(/^(.*?)(?::(\d+)(?:-(\d+))?)?$/);
  const params = q < 0 ? {} : Object.fromEntries(new URLSearchParams(raw.slice(q + 1)));
  return { wanted, line: line && Number(line), last: Number(last || line), params };
}

/** How the address says `path` is to be seen, if it names that file, or nothing. */
export function paramsFor(path) {
  const a = readAddress();
  return a.wanted === path ? a.params : {};
}

/** The address set to `path`, seen as `params` says, an empty one left out. */
export function writeAddress(path, params = {}) {
  const kept = Object.entries(params).filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && v);
  const query = new URLSearchParams(kept).toString();
  history.replaceState(null, '', `#${encodeURIComponent(path)}${query ? `?${query}` : ''}`);
}
