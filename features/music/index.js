/**
 * A ```music fence is a tune in ABC notation, drawn on a staff, with a
 * button that plays it (gh-99):
 *
 *   ```music
 *   X:1
 *   T:Twinkle, Twinkle
 *   M:4/4
 *   L:1/4
 *   K:C
 *   C C G G | A A G2 | F F E E | D D C2 |]
 *   ```
 *
 * ABC reads as plain text anywhere else. As a mermaid fence is, it's only
 * wrapped here, its text still inside as a code block, so the page reads
 * as the source where nothing draws it:
 *
 *   <div class="music" data-line="n" data-name="…">…the code block…</div>
 *
 * The preview frame draws and plays it (preview.js), with abcjs kept in
 * vendor/, loaded the first time a page has a tune; its notes come through
 * reader's server (src/soundfont.js). What the tune is called, its title,
 * key, time and bars (`tuneName()`), is read here, and is the drawing's
 * name for a screen reader.
 *
 * A page with nothing to draw it (an export) is given what the frame drew,
 * `env.drawn.music`, the SVG for each fence's text, and shows the staff as
 * drawn, with no button.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { addClass, escapeAttr } from '../source.js';

const { Token } = MarkdownIt;

const MODES = { m: 'minor', min: 'minor', maj: 'major', ion: 'Ionian', dor: 'Dorian', phr: 'Phrygian', lyd: 'Lydian', mix: 'Mixolydian', aeo: 'Aeolian', loc: 'Locrian' };
const ACCIDENTALS = { '#': ' sharp', b: ' flat' };

/** A header field of the tune, `T:` or `K:`: its first, as abcjs reads it. */
const field = (source, name) => new RegExp(`^${name}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(source)?.[1] ?? '';

/** The key, `K:Am`, as it's said: "A minor". */
function keyOf(k) {
  const m = /^([A-G])([#b]?)\s*([A-Za-z]*)/.exec(k);
  if (!m) return k === 'none' ? 'no key' : '';
  const mode = MODES[m[3].slice(0, 3).toLowerCase()] ?? (m[3].toLowerCase().startsWith('m') ? 'minor' : 'major');
  return `${m[1]}${ACCIDENTALS[m[2]] ?? ''} ${mode}`;
}

/** The time, `M:6/8`, as it's said; `C` and `C|` are common time and cut time. */
function timeOf(m) {
  return { C: 'common time', 'C|': 'cut time', none: '' }[m] ?? m;
}

/**
 * How many bars the tune's music has: its bar lines, on the lines that
 * aren't a header field or a comment, but one that opens a line.
 */
export function barsOf(source) {
  let bars = 0;
  for (const line of source.split('\n')) {
    if (/^[A-Za-z+]:/.test(line) || /^\s*%/.test(line)) continue;
    const music = line.replace(/%.*$/, '').replace(/"[^"]*"|![^!]*!/g, '').trim();
    if (!music) continue;
    const lines = music.match(/:*\[?\|+[\]:]*|::/g) ?? [];
    bars += lines.length - (/^(:*\[?\|+[\]:]*|::)/.test(music) ? 1 : 0);
    // Notes after the last bar line are a bar still open.
    if (!/(\|+[\]:]*|::)\s*$/.test(music)) bars += 1;
  }
  return bars;
}

/** What a tune is called, for a screen reader: "Twinkle: C major, 4/4, 4 bars". */
export function tuneName(source) {
  const title = field(source, 'T') || 'Tune';
  const bars = barsOf(source);
  const said = [keyOf(field(source, 'K')), timeOf(field(source, 'M')), bars ? `${bars} bar${bars === 1 ? '' : 's'}` : ''].filter(Boolean);
  return said.length ? `${title}: ${said.join(', ')}` : title;
}

export function music(md) {
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, i, opts, env, self) => {
    const token = tokens[i];
    if (token.info.trim().split(/\s+/)[0] !== 'music') return fence(tokens, i, opts, env, self);
    const attrs = token.attrs;
    token.attrs = null;
    const html = fence(tokens, i, opts, env, self);
    token.attrs = attrs;
    const wrapper = Object.assign(new Token('div', 'div', 1), { attrs: attrs?.map((a) => [...a]) ?? null });
    addClass(wrapper, 'music');
    const source = token.content.replace(/\n$/, '');
    const name = tuneName(source);
    wrapper.attrSet('data-name', name);
    const all = env.drawn?.music;
    const svg = all && Object.hasOwn(all, source) && typeof all[source] === 'string' ? all[source] : null;
    if (svg) addClass(wrapper, 'drawn');
    const staff = svg ? `<div class="music-staff" role="img" aria-label="${escapeAttr(name)}">${svg}</div>` : '';
    return `<div${self.renderAttrs(wrapper)}>${html.replace(/\n$/, '')}${staff}</div>\n`;
  };
}

export default {
  name: 'music',
  plugin: music,
  css: fs.readFileSync(new URL('./music.css', import.meta.url), 'utf8'),
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
  // abcjs is big, and most pages have no tune.
  lazy: fileURLToPath(new URL('./vendor/abcjs-basic-min.js', import.meta.url)),
};
