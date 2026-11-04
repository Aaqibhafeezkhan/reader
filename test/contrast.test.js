import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const palette = read('static/palette.css');
const style = read('static/style.css');
const speaker = read('static/speaker.css');
const columns = read('src/columns.css');
const asides = read('features/asides/asides.css');

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** `hex` at `share` over `under`, as color-mix() in srgb makes it. */
const mix = (hex, share, under) => {
  const [a, b] = [rgb(hex), rgb(under)];
  return toHex(a.map((c, i) => c * share + b[i] * (1 - share)));
};
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const readable = (ink, ground, what, least = 4.5) =>
  assert.ok(contrast(ink, ground) >= least, `${what}: ${ink} on ${ground} is ${contrast(ink, ground).toFixed(2)}:1`);
/** With more contrast asked for (prefers-contrast: more): 7:1. */
const clear = (ink, ground, what) => readable(ink, ground, what, 7);

/** The custom properties set in a block of CSS, as written. */
const declared = (css) => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
/** `css` from `mark` on. */
const after = (css, mark) => {
  assert.ok(css.includes(mark), mark);
  return css.slice(css.indexOf(mark));
};
/** The block of CSS after `head`, to its closing brace. */
const block = (css, head) => {
  const at = css.indexOf(head);
  assert.ok(at >= 0, head);
  return css.slice(at, css.indexOf('}', at) + 1);
};

/** Each of `props` as a #hex: a #hex as it is, a var() looked up, a color-mix() in srgb mixed. */
function resolve(props) {
  const out = {};
  const value = (v) => {
    v = v.trim();
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('').toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    let m = /^var\(--([\w-]+)\)$/.exec(v);
    if (m) return get(m[1]);
    // with a fallback, for when it isn't set: the accent, without the document's own
    m = /^var\(--([\w-]+), (.+)\)$/.exec(v);
    if (m) return get(m[1]) ?? value(m[2]);
    m = /^color-mix\(in srgb, (.+) (\d+)%, (.+)\)$/.exec(v);
    if (m) {
      const [a, b] = [value(m[1]), value(m[3])];
      return a && b && mix(a, m[2] / 100, b);
    }
    return null; // rgba(), a rule's: never text
  };
  const get = (name) => (name in out ? out[name] : (out[name] = props[name] === undefined ? undefined : value(props[name])));
  for (const name of Object.keys(props)) get(name);
  return out;
}

// the app's colours (palette.css), and the speaker view's, as the cascade
// makes them: the palette's, then speaker.css's over it, in each theme
// (static/theme.js sets data-theme dark there unless light is chosen)
const appLight = declared(block(palette, ':root {'));
// the app's dark is the paper's too, which on the speaker view is the app's
// look, not its own (data-paper)
const appDark = { ...declared(block(palette, ':root[data-theme="dark"] {')), ...declared(block(palette, ':root[data-paper="dark"] {')) };
const light = resolve(appLight);
const dark = resolve({ ...appLight, ...appDark });
const speakerLight = declared(block(speaker, ':root {'));
const speakerDark = declared(block(speaker, ':root[data-theme="dark"] {'));
const speakers = {
  dark: resolve({ ...appLight, ...speakerLight, ...appDark, ...speakerDark }),
  light: resolve({ ...appLight, ...speakerLight }),
};

// and with more contrast asked for: the light block's over the light, and
// the dark's over the dark, which the light's doesn't reach (`:root` is
// outweighed by `:root[data-theme]`)
const MORE = '@media (prefers-contrast: more)';
const appMoreLight = declared(block(after(palette, MORE), ':root {'));
const appMoreDark = declared(block(after(palette, MORE), ':root[data-theme="dark"] {'));
const appMore = {
  light: resolve({ ...appLight, ...appMoreLight }),
  dark: resolve({ ...appLight, ...appMoreLight, ...appDark, ...appMoreDark }),
};
const speakerMoreLight = declared(block(after(speaker, MORE), ':root {'));
const speakerMoreDark = declared(block(after(speaker, MORE), ':root[data-theme="dark"] {'));
const speakerMore = {
  light: resolve({ ...appLight, ...speakerLight, ...appMoreLight, ...speakerMoreLight }),
  dark: resolve({
    ...appLight, ...speakerLight, ...appMoreLight, ...speakerMoreLight,
    ...appDark, ...speakerDark, ...appMoreDark, ...speakerMoreDark,
  }),
};

// The speaker view names only the colours the app doesn't have, and
// overrides only the one it tunes for its grounds: the rest come through.
test("the speaker view's own colours are only those the app lacks, and the soft ink it tunes", () => {
  const app = new Set(Object.keys({ ...appLight, ...appDark, ...appMoreLight, ...appMoreDark }));
  const own = { ...speakerLight, ...speakerDark, ...speakerMoreLight, ...speakerMoreDark };
  const overridden = Object.keys(own).filter((name) => app.has(name));
  assert.deepEqual(overridden, ['ink-soft']);
  assert.deepEqual(Object.keys(speakerMoreDark), ['ink-soft']);
  assert.ok(contrast(speakerMore.dark['ink-soft'], speakerMore.dark.panel) < contrast(appMore.dark['ink-soft'], appMore.dark.panel));
});

// the document's: the light set, the dark over it, and what each is for,
// an asides key's colours among them
const meaning = { ...declared(block(columns, ':root {\n  --gm-accent')), ...declared(block(asides, ':root {\n  --gm-key-1')) };
const lightSet = declared(block(columns, '/* colours, light */'));
const doc = {
  light: resolve({ ...lightSet, ...meaning }),
  dark: resolve({ ...lightSet, ...declared(block(columns, '/* colours, dark */')), ...meaning }),
};
const moreLight = declared(block(after(columns, '/* colours, more contrast */'), ':root {'));
const docMore = {
  light: resolve({ ...lightSet, ...moreLight, ...meaning }),
  dark: resolve({ ...lightSet, ...moreLight, ...declared(block(columns, '/* colours, dark */')), ...declared(block(after(columns, '/* colours, more contrast */'), ':root.gm-dark {')), ...meaning }),
};
// static/ink.js letters an author's background in whichever of the page's
// inks reads better on it; JavaScript can't take them from the cascade, so
// it copies them, and here they're kept the same
test("ink.js's inks are the page's, light and dark", () => {
  const ink = read('static/ink.js');
  const copied = (name) => {
    const m = new RegExp(`const ${name} = \\[(.+?)\\];`).exec(ink);
    assert.ok(m, name);
    return toHex(m[1].split(',').map(Number));
  };
  assert.equal(copied('DARK_INK'), doc.light['gm-ink']);
  assert.equal(copied('LIGHT_INK'), doc.dark['gm-ink']);
});

const FAMILY = ['red', 'amber', 'moss', 'green', 'blue', 'violet', 'rose', 'slate'];

test('no text is drawn in the faint ink', () => {
  for (const [name, css] of [['style.css', style], ['speaker.css', speaker]]) {
    assert.doesNotMatch(css, /(^|[;{\s])color:\s*var\(--ink-faint\)/m, name);
  }
});

test('the soft ink reads on every panel and row, in both themes', () => {
  for (const [theme, t] of [['light', light], ['dark', dark]]) {
    // a row: hovered, open, picked
    for (const ground of ['bg', 'panel', 'line', 'line-soft']) readable(t['ink-soft'], t[ground], `${theme} --${ground}`);
    readable(t['ink-soft'], mix(t.accent, 0.18, t.panel), `${theme} picked row`);
  }
  for (const [theme, s] of Object.entries(speakers)) for (const ground of ['bg', 'panel']) readable(s['ink-soft'], s[ground], `speaker view, ${theme}`);
});

test("the app's ok and warn read where they're drawn, and the toast's ink on warn", () => {
  for (const [theme, t] of [['light', light], ['dark', dark]]) {
    for (const ground of ['bg', 'panel', 'line-soft']) {
      readable(t.ok, t[ground], `${theme} ok on --${ground}`);
      readable(t.warn, t[ground], `${theme} warn on --${ground}`);
    }
    readable(t.warn, mix(t.warn, 0.14, t.bg), `${theme} trash, hovered`);
    readable(t['on-warn'], t.warn, `${theme} toast`);
  }
});

test("the speaker view's pace reads on its ground", () => {
  for (const [theme, s] of Object.entries(speakers)) {
    for (const ink of ['ahead', 'on-pace', 'behind', 'warn']) for (const ground of ['bg', 'panel']) readable(s[ink], s[ground], `${theme} ${ink} on --${ground}`);
  }
});

test("the version, at the foot of the list, is in the soft ink or the ink", () => {
  const rules = [...style.matchAll(/^\.version[^{]*\{([^}]*)\}/gm)].map((m) => m[1]);
  const inks = rules.flatMap((r) => [...r.matchAll(/(?:^|[;\s])color:\s*([^;]+)/g)].map((m) => m[1].trim()));
  assert.ok(inks.length);
  for (const ink of inks) assert.match(ink, /^var\(--ink(-soft)?\)$/);
});

test("the deck's foot reads on its paper, light or dark", () => {
  const [, ink, ground] = style.match(/\.deck-foot \{[^}]*?[\s;]color: var\(--([\w-]+)\); background: var\(--([\w-]+)\)/);
  for (const t of [light, dark]) readable(t[ink], t[ground], 'deck foot');
});

test("a page's dot, and a block of ten, stand out from the pages bar at 3:1", () => {
  // a page not done yet is only its ring: a control, so not --ink-faint
  for (const head of ['.page-dot::before {', '.page-block {']) {
    const [, ring] = block(style, head).match(/border: [^;]*var\(--([\w-]+)\)/);
    for (const [theme, t] of [['light', light], ['dark', dark], ['light, more contrast', appMore.light], ['dark, more contrast', appMore.dark]]) {
      readable(t[ring], t.panel, `${theme} ${head} --${ring} on --panel`, 3);
    }
  }
});

test("the document's inks read on its paper and every ground on it, light and dark", () => {
  for (const [theme, t] of Object.entries(doc)) {
    for (const ground of ['paper', 'wash', 'well', 'th', 'stripe', 'lit']) {
      for (const ink of ['ink', 'ink-soft', 'ink-done', 'aside-ink', 'accent']) readable(t[`gm-${ink}`], t[`gm-${ground}`], `${theme} --gm-${ink} on --gm-${ground}`);
    }
  }
});

test("the family's hues read on the paper and a fence, and the paper on them", () => {
  for (const [theme, t] of Object.entries(doc)) {
    for (const hue of FAMILY) {
      for (const ground of ['paper', 'well']) readable(t[`gm-${hue}`], t[`gm-${ground}`], `${theme} --gm-${hue} on --gm-${ground}`);
      readable(t['gm-paper'], t[`gm-${hue}`], `${theme} the paper on --gm-${hue}`);
    }
  }
});

test("a retro card's label reads on the paper, and the paper on it once it's done", () => {
  for (const [theme, t] of Object.entries(doc)) {
    for (const card of ['good', 'bad', 'try']) {
      for (const ground of ['paper', 'well']) readable(t[`gm-${card}`], t[`gm-${ground}`], `${theme} ${card} on --gm-${ground}`);
      readable(t['gm-paper'], t[`gm-${card}`], `${theme} ${card}, done`);
    }
  }
});

test("an asides legend's counts read as their names do, not faded", () => {
  // a reviewer's count on their chip, a topic's on the paper, each in its name's colour
  assert.doesNotMatch(block(asides, '.gm-legend b {'), /opacity/);
  for (const [theme, t] of Object.entries(doc)) {
    for (let i = 1; i <= 8; i++) {
      readable(t['gm-paper'], t[`gm-key-${i}`], `${theme} a reviewer's count on --gm-key-${i}`);
      readable(t[`gm-key-${i}`], t['gm-paper'], `${theme} a topic's count in --gm-key-${i}`);
    }
  }
});

test("code's colours read on every ground code is drawn on", () => {
  for (const [theme, t] of Object.entries(doc)) {
    const inks = Object.keys(t).filter((k) => k.startsWith('gm-code-'));
    assert.ok(inks.length >= 9);
    // the fence, a line picked out, output, a line of output picked out
    for (const ink of inks) for (const ground of ['well', 'lit', 'output', 'output-lit']) readable(t[ink], t[`gm-${ground}`], `${theme} --${ink} on --gm-${ground}`);
  }
});

test("a headline's clipping reads, in each paper's colours", () => {
  for (const [theme, t] of Object.entries(doc)) {
    for (const ground of ['clip-paper', 'clip-white']) for (const ink of ['clip-ink', 'clip-ink-soft']) readable(t[`gm-${ink}`], t[`gm-${ground}`], `${theme} ${ink} on ${ground}`);
    for (const brand of ['atlantic', 'guardian']) readable(t[`gm-brand-${brand}`], t['gm-clip-white'], `${theme} ${brand}`);
    readable(t['gm-on-brand'], t['gm-brand-slashdot'], `${theme} slashdot`);
    readable(t['gm-clip-white'], t['gm-clip-ink'], `${theme} wired`);
  }
});

test("what's tinted reads on its tint: an unused ingredient, a puzzle's cursor and conflicts", () => {
  for (const [theme, t] of Object.entries(doc)) {
    readable(t['gm-amber'], mix(t['gm-amber'], 0.12, t['gm-paper']), `${theme} in no step`);
    readable(t['gm-pick'], mix(t['gm-pick'], 0.18, t['gm-paper']), `${theme} sudoku cursor`);
    readable(t['gm-error'], mix(t['gm-error'], 0.18, t['gm-paper']), `${theme} sudoku conflict`);
    readable(mix(t['gm-pick'], 0.7, t['gm-ink']), t['gm-paper'], `${theme} a coord puzzle's cue`);
  }
});

// Machado, Oliveira and Fernandes (2009), at full severity, in linear RGB.
const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
/** `hex` as OKLab, seen through `matrix`. */
const oklab = (hex, matrix) => {
  let c = rgb(hex).map(lin);
  if (matrix) c = matrix.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])));
  const [r, g, b] = c;
  const [l, m, s] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const apart = (a, b, matrix) => Math.hypot(...oklab(a, matrix).map((v, i) => v - oklab(b, matrix)[i]));

test('Good, Bad and Try, and ok and warn, stay apart under deuteranopia and protanopia', () => {
  const pairs = [];
  for (const [theme, t] of Object.entries(doc)) pairs.push([theme, t['gm-good'], t['gm-bad'], t['gm-try']]);
  for (const [theme, t] of Object.entries(docMore)) pairs.push([`${theme}, more contrast`, t['gm-good'], t['gm-bad'], t['gm-try']]);
  for (const [theme, t] of [['app light', light], ['app dark', dark], ['app light, more contrast', appMore.light], ['app dark, more contrast', appMore.dark]]) pairs.push([theme, t.ok, t.warn]);
  for (const [theme, ...set] of pairs) {
    for (const [name, matrix] of Object.entries(CVD)) {
      for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
        const d = apart(set[i], set[j], matrix);
        // the old Good and Bad were 0.02 apart, their letters all that told them apart
        assert.ok(d >= 0.07, `${theme}, ${name}: ${set[i]} and ${set[j]} are ${d.toFixed(3)} apart`);
      }
    }
  }
});

/** OKLab -> #hex, each channel clipped to sRGB, as a browser draws a colour out of its gamut. */
const fromOklab = ([L, a, b]) => {
  const [l, m, s] = [L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.291485548 * b].map((v) => v ** 3);
  const c = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return toHex(c.map((v) => 255 * gamma(Math.min(1, Math.max(0, v)))));
};
/** `hex` in OKLCH, its lightness clamped to `lo`..`hi` and its chroma to `cmax`, as oklch(from ...) makes it. */
const capped = (hex, { lo, hi, cmax }) => {
  const [L, a, b] = oklab(hex);
  const c = Math.hypot(a, b);
  const k = c ? Math.min(c, cmax) / c : 0;
  return fromOklab([Math.min(hi, Math.max(lo, L)), a * k, b * k]);
};

test('a colour an author names reads as text, in light and dark, and at 7:1 with more contrast asked for', () => {
  // the bounds, the one rule that keeps a colour to them, and what reads it
  const set = (css) => {
    const d = declared(css);
    return { lo: d['gm-own-l-min'], hi: d['gm-own-l-max'], cmax: d['gm-own-c-max'] };
  };
  const base = set(block(columns, '/* colours, light */'));
  const darker = set(block(columns, '/* colours, dark */'));
  const more = set(block(after(columns, MORE), ':root {'));
  const moreDark = set(block(after(columns, MORE), ':root.gm-dark {'));
  const merge = (...sets) => Object.fromEntries(['lo', 'hi', 'cmax'].map((k) => [k, Number(sets.findLast((x) => x[k] !== undefined)[k])]));
  const themes = [
    ['light', merge(base), doc.light, 4.5],
    ['dark', merge(base, darker), doc.dark, 4.5],
    ['light, more contrast', merge(base, more), docMore.light, 7],
    ['dark, more contrast', merge(base, more, darker, moreDark), docMore.dark, 7],
  ];
  const cap = 'oklch(from var(--own) clamp(var(--gm-own-l-min), l, var(--gm-own-l-max)) min(c, var(--gm-own-c-max)) h)';
  assert.ok(columns.includes(`  :root, .gm-own { --gm-own: ${cap}; }`), 'the clamp');
  assert.ok(columns.includes('\n:root, .gm-own { --gm-own: var(--own); }'), 'as written, without relative colours');
  // the page is one, in the accent its front matter gives (src/accent.js),
  // and the accent is that, or the family's slate without it
  assert.ok(columns.includes('\n:root { --own: var(--own-accent); }'), "the document's accent");
  assert.match(block(columns, ':root {\n  --gm-accent'), /\n {2}--gm-accent: var\(--gm-own, var\(--gm-slate\)\);/);
  // the browser's own boxes and radios take it, and are the browser's without it
  assert.ok(columns.includes('\n:root { accent-color: var(--gm-own, auto); }'), "the boxes' accent");
  const marksCss = read('features/asides/marks.css');
  assert.ok(asides.includes('.gm-who.gm-own { --own: var(--by); background: var(--gm-own); }'), 'a chip');
  assert.ok(asides.includes('.gm-topic.gm-own { --own: var(--topic); color: var(--gm-own); }'), 'a pill');
  assert.ok(marksCss.includes('.mk-about.gm-own { --own: var(--mk); color: color-mix(in srgb, var(--gm-own) 55%, var(--gm-ink)); }'), 'the words an aside chose');
  // only there: the family, and the colours dealt from it, are drawn exactly as they're defined
  for (const css of [columns, asides, marksCss]) {
    assert.equal(css.match(/oklch\(from var\(/g)?.length ?? 0, css === columns ? 1 : 0, 'the clamp is written once');
    for (const [rule] of css.matchAll(/^.*var\(--gm-own\).*$/gm)) assert.match(rule, /^ *\.(?:gm-who|gm-topic|mk-about)\.gm-own \{/, rule);
  }
  assert.match(asides, /\n\.gm-who \{ color: var\(--gm-paper\); background: var\(--by, var\(--gm-accent\)\); \}/);
  assert.match(asides, /\n\.gm-topic \{ color: var\(--topic, var\(--gm-accent\)\);/);
  assert.match(marksCss, /\n {2}color: color-mix\(in srgb, var\(--mk, var\(--gm-ink-soft\)\) 55%, var\(--gm-ink\)\);/);
  // every hue, vivid, deep and pale, and what the issue found: gold on white, navy on the dark
  const hsl = (h, l) => {
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return 255 * (l - Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return toHex([f(0), f(8), f(4)]);
  };
  const colours = ['#ffd700', '#000080', '#ffffff', '#000000', '#808080'];
  for (let h = 0; h < 360; h += 10) for (const l of [0.2, 0.5, 0.8]) colours.push(hsl(h, l));
  for (const [theme, bounds, t, least] of themes) {
    for (const c of colours) {
      const ink = capped(c, bounds);
      readable(ink, t['gm-paper'], `${theme}: ${c} as ${ink}, a pill on the paper`, least);
      readable(t['gm-paper'], ink, `${theme}: the paper on ${c} as ${ink}, a chip`, least);
      readable(mix(ink, 0.55, t['gm-ink']), t['gm-paper'], `${theme}: ${c} as the words an aside chose`, least);
    }
    // and as the accent, a document's own: drawn as text, and lettered in
    // the paper (a reviewer's chip in the byline)
    for (const c of ['#4a7c59', ...colours]) {
      const accent = capped(c, bounds);
      readable(accent, t['gm-paper'], `${theme}: the accent ${c} as ${accent}, on the paper`, least);
      readable(t['gm-paper'], accent, `${theme}: the paper on the accent ${c} as ${accent}`, least);
    }
  }
});

test('no colour is written outside the blocks that name them', () => {
  const blocks = [
    [palette, /^ *:root[^{]*\{[^}]*\}/gm],
    [speaker, /^ *:root[^{]*\{[^}]*\}/gm],
    [columns, /^\/\* colours, [^*]+\*\/\n(?::root[^{]*\{[^}]*\}|@media[^{]*\{(?:\s*:root[^{]*\{[^}]*\})+\s*\})/gm],
  ];
  const named = new Map(blocks.map(([css, re]) => [css, css.replace(re, '')]));
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const path = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!['vendor', 'node_modules', 'icons'].includes(e.name)) walk(path); }
      else if (/\.(css|js|html)$/.test(e.name) && !e.name.endsWith('.test.js')) files.push(path);
    }
  };
  for (const dir of ['src', 'static', 'features']) walk(dir);
  assert.ok(files.length > 50);
  for (const path of files) {
    const css = read(path);
    const left = named.get(css) ?? css;
    assert.doesNotMatch(left, /#[0-9a-f]{3,8}\b(?![\w-])/i, path);
  }
});

test("with more contrast asked for, the app's text reads at 7:1 on every panel and row, and its rules at 3:1", () => {
  for (const [theme, t] of Object.entries(appMore)) {
    for (const ground of ['bg', 'panel', 'row', 'line-soft']) {
      for (const ink of ['ink', 'ink-soft']) clear(t[ink], t[ground], `${theme} --${ink} on --${ground}`);
    }
    clear(t['ink-soft'], mix(t.accent, 0.18, t.panel), `${theme} picked row`);
    for (const ground of ['bg', 'panel', 'line-soft']) {
      clear(t.ok, t[ground], `${theme} ok on --${ground}`);
      clear(t.warn, t[ground], `${theme} warn on --${ground}`);
    }
    clear(t.warn, mix(t.warn, 0.14, t.bg), `${theme} trash, hovered`);
    clear(t['on-warn'], t.warn, `${theme} toast`);
    clear(t['accent-ink'], t.accent, `${theme} a primary button`);
    clear(t['paper-ink-soft'], t.paper, `${theme} the deck's foot`);
    for (const ground of ['bg', 'panel']) {
      for (const rule of ['line', 'ink-faint']) readable(t[rule], t[ground], `${theme} --${rule} on --${ground}`, 3);
    }
  }
  for (const [theme, s] of Object.entries(speakerMore)) {
    for (const ink of ['ink-soft', 'ahead', 'on-pace', 'behind', 'warn', 'accent']) for (const ground of ['bg', 'panel']) clear(s[ink], s[ground], `speaker view, ${theme}, ${ink} on --${ground}`);
  }
});

test("with more contrast asked for, the document's inks, its family, cards and code read at 7:1", () => {
  for (const [theme, t] of Object.entries(docMore)) {
    for (const ground of ['paper', 'wash', 'well', 'th', 'stripe', 'lit']) {
      for (const ink of ['ink', 'ink-soft', 'ink-done', 'aside-ink', 'accent']) clear(t[`gm-${ink}`], t[`gm-${ground}`], `${theme} --gm-${ink} on --gm-${ground}`);
    }
    for (const hue of [...FAMILY, 'good', 'bad', 'try']) {
      for (const ground of ['paper', 'well']) clear(t[`gm-${hue}`], t[`gm-${ground}`], `${theme} --gm-${hue} on --gm-${ground}`);
      clear(t['gm-paper'], t[`gm-${hue}`], `${theme} the paper on --gm-${hue}`);
    }
    const inks = Object.keys(t).filter((k) => k.startsWith('gm-code-'));
    for (const ink of inks) for (const ground of ['well', 'lit', 'output', 'output-lit']) clear(t[ink], t[`gm-${ground}`], `${theme} --${ink} on --gm-${ground}`);
    clear(t['gm-amber'], mix(t['gm-amber'], 0.12, t['gm-paper']), `${theme} in no step`);
    for (const ground of ['clip-paper', 'clip-white']) for (const ink of ['clip-ink', 'clip-ink-soft']) clear(t[`gm-${ink}`], t[`gm-${ground}`], `${theme} ${ink} on ${ground}`);
    clear(t['gm-brand-atlantic'], t['gm-clip-white'], `${theme} atlantic`);
    clear(t['gm-on-brand'], t['gm-brand-slashdot'], `${theme} slashdot`);
  }
  // the light set's rules, against the paper and a fence (the dark's are the paper's white, half through)
  for (const rule of ['rule', 'rule-strong', 'aside-rule', 'ink-faint']) {
    for (const ground of ['paper', 'well']) readable(docMore.light[`gm-${rule}`], docMore.light[`gm-${ground}`], `--gm-${rule} on --gm-${ground}`, 3);
  }
});

test("in the system's own colours, every colour of the document's is one of them", () => {
  const forced = declared(block(after(columns, '@media (forced-colors: active)'), ':root, :root.gm-dark {'));
  const SYSTEM = /^(Canvas|CanvasText|GrayText|Highlight)$/;
  // a profile link's mark is its site's, as an image's colours are
  const MARKS = /^gm-brand-(linkedin|bluesky|facebook|instagram|youtube)$/;
  // except the bounds on a colour an author names, which aren't colours themselves
  for (const name of Object.keys(lightSet).filter((n) => !MARKS.test(n) && !/^gm-own-[lc]-/.test(n))) assert.match(forced[name] ?? '', SYSTEM, `--${name}`);
  assert.equal(forced['gm-accent'], 'Highlight');
  assert.equal(forced['gm-pick'], 'Highlight');
});

test("in the system's own colours, what a ground or a shadow said is said another way", () => {
  const under = (css) => after(css, '@media (forced-colors: active)');
  // the open file, a picked row, the place in Go to, a field with the keyboard, the page showing and those done
  for (const what of ['.files li:has(.now)', '.files li.picked', '.goto-list li.on', '.side-head input:focus', '.page-dot.now::before', '.page-dot.done::before', '.page-block.done']) {
    assert.ok(under(style).includes(what), what);
  }
  assert.match(under(read('features/steps/steps.css')), /li\.step-current \{ outline: 2px solid Highlight/);
  assert.match(under(read('features/qa/qa.css')), /qa-done > \.qa-label[\s\S]*background: CanvasText; color: Canvas/);
  assert.match(under(read('features/asides/marks.css')), /\.mk-highlight[^{]*\{[^}]*background: Mark; color: MarkText/);
  assert.match(under(read('features/highlight/highlight.css')), /\.line\.hl, \.callout-notes > li\.hl \{ outline: 2px solid Highlight/);
  assert.match(under(read('features/puzzles/kinds/sudoku.js')), /\.cursor \{ outline: 3px solid Highlight/);
  assert.match(under(read('features/tabs/tabs.css')), /\.tab \{ forced-color-adjust: none; \}/);
  assert.match(under(columns), /\.gm-who, ol\.badges > li:not\(\.gm-cont\)::before/);
  // a reviewer's chip, and a mark's line, in whatever colour an author named
  assert.match(under(asides), /\.gm-who, \.gm-who\.gm-own \{ background: CanvasText; \}/);
  assert.match(under(read('features/asides/marks.css')), /\.mk-lines path \{ stroke: CanvasText; \}/);
});


// A background an author names, as features/styles/styles.css takes it in
// OKLCH: at its palest, in the light, at --gm-bg-l-min and --gm-bg-c-max,
// and at its brightest, in the dark, at --gm-bg-l-max; in every hue, brought
// into sRGB as a browser does, by giving up chroma.
const bgCss = read('features/styles/styles.css');
const oklch = (l, c, h) => {
  const rgb = (chroma) => {
    const [a, b] = [chroma * Math.cos((h * Math.PI) / 180), chroma * Math.sin((h * Math.PI) / 180)];
    const [L, M, S] = [l + 0.3963377774 * a + 0.2158037573 * b, l - 0.1055613458 * a - 0.0638541728 * b, l - 0.0894841775 * a - 1.291485548 * b].map((v) => v ** 3);
    return [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S];
  };
  let [lo, hi] = [0, c];
  for (let k = 0; k < 20; k++) {
    const mid = (lo + hi) / 2;
    if (rgb(mid).every((v) => v >= -1e-4 && v <= 1 + 1e-4)) lo = mid;
    else hi = mid;
  }
  const gamma = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return toHex(rgb(lo).map((v) => gamma(Math.min(1, Math.max(0, v)))));
};
const grounds = (vars, dark) => {
  const [l, c] = [Number(dark ? vars['gm-bg-l-max'] : vars['gm-bg-l-min']), Number(vars['gm-bg-c-max'])];
  return Array.from({ length: 24 }, (_, k) => [k * 15, oklch(l, c, k * 15)]);
};

test("a background an author names keeps the document's inks readable on it, light and dark, and with more contrast asked for", () => {
  const lightVars = declared(block(bgCss, ':root {'));
  const darkVars = { ...lightVars, ...declared(block(bgCss, ':root.gm-dark {')) };
  const moreLight = { ...lightVars, ...declared(block(after(bgCss, MORE), ':root {')) };
  const moreDark = { ...moreLight, ...darkVars, ...declared(block(after(bgCss, MORE), ':root.gm-dark {')) };
  for (const [theme, vars, t, dark] of [['light', lightVars, doc.light, false], ['dark', darkVars, doc.dark, true]]) {
    for (const [hue, ground] of grounds(vars, dark)) {
      for (const ink of ['ink', 'ink-soft', 'accent']) readable(t[`gm-${ink}`], ground, `${theme} --gm-${ink} on a background of hue ${hue}`);
    }
  }
  for (const [theme, vars, t, dark] of [['light', moreLight, docMore.light, false], ['dark', moreDark, docMore.dark, true]]) {
    for (const [hue, ground] of grounds(vars, dark)) {
      for (const ink of ['ink', 'ink-soft']) clear(t[`gm-${ink}`], ground, `more contrast, ${theme} --gm-${ink} on a background of hue ${hue}`);
    }
  }
  // without relative colours, the dark's is 15% of it over the paper: white, at the brightest
  assert.match(bgCss, /:root\.gm-dark \.bg \{ --item-bg: color-mix\(in srgb, var\(--bg\) 15%, var\(--gm-paper\)\); \}/);
  for (const ink of ['ink', 'ink-soft', 'accent']) readable(doc.dark[`gm-${ink}`], mix('#ffffff', 0.15, doc.dark['gm-paper']), `dark --gm-${ink} on white, 15% over the paper`);
});
