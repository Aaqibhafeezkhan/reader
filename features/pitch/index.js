/**
 * `pitch:[C4]` is a note, its name a small button that plays it; words in
 * the brackets after a note show instead, as with a link's scheme.
 *
 *   Start around pitch:[C4], slide down to pitch:[G3] and back up.
 *   From pitch:C4[middle C] to pitch:Bb4[] and pitch:F#5[].
 *
 * A note is named in scientific pitch: a letter, then `#` or `b` (or `♯`,
 * `♭`), then its octave, 0 to 9. A4 is 440 Hz. One that isn't a note
 * (`pitch:[H9]`) stays as typed, as does one in code.
 *
 * Playing a note isn't working the page, so it plays wherever the page can
 * be read in the preview: on a slide, in a record, in Work (preview.js). An
 * exported page runs no script to play it with, and only names it.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schemeRule } from '../scheme.js';
import { escapeHtml, escapeAttr } from '../source.js';

const NOTE = /^([A-Ga-g])([#♯b♭]?)(\d)$/;
const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * `F#3` as { name: 'F♯3', spoken: 'F sharp 3', hz }, or null if it isn't a
 * note: its name as it's shown and as it's said, and how many times a
 * second it sounds.
 */
export function note(written) {
  const m = NOTE.exec(written.trim());
  if (!m) return null;
  const [, letter, accidental, octave] = m;
  const up = '#♯'.includes(accidental || '-') ? 1 : 'b♭'.includes(accidental || '-') ? -1 : 0;
  const midi = 12 * (Number(octave) + 1) + STEPS[letter.toUpperCase()] + up;
  const hz = 440 * 2 ** ((midi - 69) / 12);
  const sign = up > 0 ? '♯' : up < 0 ? '♭' : '';
  const said = up > 0 ? ' sharp ' : up < 0 ? ' flat ' : '';
  const L = letter.toUpperCase();
  return { name: `${L}${sign}${octave}`, spoken: `${L}${said}${octave}`, hz: Math.round(hz * 1000) / 1000 };
}

export function pitch(md) {
  schemeRule(md, {
    name: 'pitch',
    scheme: 'pitch',
    path: /(?:[A-Ga-g][#♯b♭]?\d)?/,
    make: (state, where, label) => {
      const found = note(where || label);
      if (!found) return false;
      if (!state) return true;
      const t = state.push('pitch', 'button', 0);
      t.meta = { ...found, label: where ? label.trim() : '' };
      // Its words, for whatever names a line by what it says (a task's box).
      t.content = t.meta.label || found.name;
      return true;
    },
  });

  md.renderer.rules.pitch = (tokens, i, opts, env) => {
    const { name, spoken, hz, label } = tokens[i].meta;
    const shown = escapeHtml(label || name);
    // An exported page has no script to play it with.
    if (env.exported) return `<span class="pitch">${shown}</span>`;
    // Its name says what it does, with the words it shows in it.
    const said = label ? `Play ${label} (${spoken})` : `Play ${spoken}`;
    return `<button type="button" class="pitch" data-hz="${hz}" aria-label="${escapeAttr(said)}">${shown}</button>`;
  };
}

export default {
  name: 'pitch',
  plugin: pitch,
  css: fs.readFileSync(new URL('./pitch.css', import.meta.url), 'utf8'),
  // Drawn into the preview frame, to play the note.
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};
