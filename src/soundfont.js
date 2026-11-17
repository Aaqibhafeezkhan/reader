/**
 * The notes a `music` fence plays (features/music), a piano's from abcjs's
 * sound fonts, served to the preview frames from here. Each note is fetched
 * from abcjs's website the first time it's asked for, kept in a cache
 * folder of reader's own, outside anyone's files, and from then on served
 * from there, with headers that let the browser keep it too. So a tune
 * plays offline once its notes have been played, and the page asks only
 * reader for them, as its policy says (src/server.js).
 *
 *   GET /soundfont/acoustic_grand_piano-mp3/C4.mp3
 *
 * as abcjs asks for a note, by its instrument and its name (`Db4`).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FROM = 'https://paulrosen.github.io/midi-js-soundfonts/abcjs/';
// An instrument's name, as General MIDI's in abcjs's sound fonts, and a note's.
export const NOTE = /^\/soundfont\/([a-z0-9_]{1,40})-mp3\/([A-G]b?[0-8])\.mp3$/;
// A note is about 80 KB; anything far past that isn't one.
const MOST = 1024 * 1024;
const WAIT = 15000;

/** Where reader keeps what it fetches, as each system keeps an app's cache. */
export function cacheDir(env = process.env, platform = process.platform, home = os.homedir()) {
  if (env.READER_CACHE) return env.READER_CACHE;
  // Each system's own paths, whichever system this runs on, as its tests ask for all three.
  if (platform === 'darwin') return path.posix.join(home, 'Library', 'Caches', 'reader');
  if (platform === 'win32') return path.win32.join(env.LOCALAPPDATA || path.win32.join(home, 'AppData', 'Local'), 'reader', 'Cache');
  return path.posix.join(env.XDG_CACHE_HOME || path.posix.join(home, '.cache'), 'reader');
}

export class NoteError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * The bytes of the note `route` names, from the cache in `dir`, or fetched
 * and kept there first. Throws a NoteError, 404 for what isn't a note, 502
 * for one that couldn't be fetched, as when offline.
 */
export async function note(route, { dir = cacheDir(), get = fetch } = {}) {
  const m = NOTE.exec(route);
  if (!m) throw new NoteError('not a note', 404);
  const [, instrument, name] = m;
  const kept = path.join(dir, 'soundfont', `${instrument}-mp3`, `${name}.mp3`);
  try {
    return fs.readFileSync(kept);
  } catch {
    // not kept yet
  }
  let bytes;
  try {
    const res = await get(`${FROM}${instrument}-mp3/${name}.mp3`, { signal: AbortSignal.timeout(WAIT) });
    if (!res.ok) throw new Error(`${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    throw new NoteError(`the note couldn't be fetched (${err.message}): it needs the network the first time it's played`, 502);
  }
  if (!bytes.length || bytes.length > MOST) throw new NoteError('what came back isn\'t a note', 502);
  // Written whole or not at all, so a note half fetched is never kept.
  fs.mkdirSync(path.dirname(kept), { recursive: true });
  const part = `${kept}.${process.pid}.part`;
  fs.writeFileSync(part, bytes);
  fs.renameSync(part, kept);
  return bytes;
}
