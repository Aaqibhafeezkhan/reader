/**
 * Keys for the buttons that make, find and set aside files, as ⌘N, ⌘T and
 * ⌘⇧N are the browser's: ⌘⌥ and a letter, Ctrl+Alt on Windows and Linux.
 * Each presses its button, and so does nothing where the button is gray.
 */

import { state, readOnly } from './state.js';
import { pressNew, pressStart, pressToday } from './files.js';
import { makeCopy } from './copying.js';
import { trash } from './manage.js';

// By the key's place, e.code, since ⌥ turns a letter into another on a Mac.
const KEYS = {
  KeyN: pressNew,
  '⇧KeyN': pressStart,
  KeyT: pressToday,
  KeyY: () => makeCopy(false),
  '⇧KeyY': () => makeCopy(true),
  // The open file's trash can, in its row; its message has an Undo.
  // Not reader's own file, which is read here, never written (gh-263).
  Backspace: () => state.current && !readOnly() && trash(state.current.path),
};

/** Presses the button for `e`, if it's one of these keys: true if it was. */
export function fileKey(e) {
  if (!(e.metaKey || e.ctrlKey) || !e.altKey) return false;
  const name = `${e.shiftKey ? '⇧' : ''}${e.code}`;
  if (!Object.hasOwn(KEYS, name)) return false;
  // Ctrl+Alt is AltGr on some layouts, which types a letter (ń): that's left to be typed.
  if (!e.metaKey && e.key?.length === 1 && e.key.toLowerCase() !== e.code.slice(3).toLowerCase()) return false;
  KEYS[name]();
  return true;
}
