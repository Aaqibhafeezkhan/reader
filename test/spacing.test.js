import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from '../src/render.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** The stylesheets a feature keeps in its script, each a template of nothing but CSS. */
const inScript = (path) => [...read(path).matchAll(/`\s*(\.[\w-]+ [^`]*)`/g)].map((m) => m[1]).join('\n');

// A page's whole stylesheet: the layout's, the render's and every feature's,
// so a new feature's is read without being named here; and what's added to
// it only sometimes, by a script.
const sheet = [
  render('# A page\n').css,
  inScript('src/columns.js'),
  inScript('features/puzzles/preview.js'),
  inScript('features/puzzles/kinds/coord.js'),
  inScript('features/puzzles/kinds/wordsearch.js'),
].join('\n');

/** Each declaration in `css`, with the selector it's under; @page's are the sheet of paper's. */
function declarations(css) {
  const out = [];
  const heads = [];
  let text = '';
  for (const c of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (c === '{') {
      heads.push(text.trim());
      text = '';
    } else if (c === ';' || c === '}') {
      const m = /^\s*([\w-]+)\s*:\s*([\s\S]+)$/.exec(text);
      if (m && heads.length && !heads.some((h) => h.startsWith('@page'))) {
        out.push({ selector: heads.at(-1).replace(/\s+/g, ' '), prop: m[1], value: m[2].trim() });
      }
      text = '';
      if (c === '}') heads.pop();
    } else {
      text += c;
    }
  }
  return out;
}

const SPACING = /^(margin|padding)(-|$)|(^|-)gap$|^--[\w-]+-(gap|pad)$/;
/** A length written out, not a var() (whose fallback would count), a bare 0 or a calc()'s factor. */
const bareLength = (value) => /(^|[\s(,-])\.?\d[\d.]*(rem|em|px|pt|ch|ex|lh|vh|vw|vmin|vmax|cm|mm|in)\b/.test(value.replace(/var\(--[\w-]+\)/g, ''));

// What keeps a length of its own, each saying so in its stylesheet too, since
// a step of the scale would move it or wouldn't mean anything there.
const OWN = new Set([
  // the sheet's own margins, and as far again from what it heads
  '.gm-doc padding',
  // and more of it where headings fold, for their chevrons (features/fold)
  '.gm-doc:has(.fold-heading) padding-left',
  '.gm-masthead margin-bottom',
  // room for what's hung in it, drawn at a set size
  'blockquote.quoted padding-left',
  'blockquote.quoted:not(.gm-cont)::before margin',
  'li.qa padding-left',
  'ol.badges padding-left',
  // hairlines: as near as a border, or on one
  '.stage-box gap',
  '.stage-box padding',
  '.date-cal-grid gap',
  '.tab margin-bottom',
  // inside the line of text it's in
  '.timer button padding',
  // as near its word as a pen would go
  '.mk-circle padding',
  '.mk-circle margin',
  // in code, a length goes by its characters
  'pre.code-numbers .line::before margin-right',
  'pre .callout margin-left',
  // the look of the paper a clipping is from
  '.headline-wired .headline-agency padding',
  '.headline-wired .headline-agency margin-bottom',
  '.headline-slashdot padding',
  '.headline-slashdot .headline-agency padding',
  '.headline-slashdot .headline-title padding',
  '.headline-slashdot .headline-deck padding',
  '.headline-slashdot .headline-dateline padding',
]);

const spacing = declarations(sheet).filter((d) => SPACING.test(d.prop) && bareLength(d.value));
const named = ({ selector, prop }) => `${selector} ${prop}`;

test('every margin, padding and gap in a document comes from the spacing scale, or says why not', () => {
  assert.deepEqual(spacing.filter((d) => !OWN.has(named(d))).map((d) => `${named(d)}: ${d.value}`), []);
});

test('what keeps a length of its own still does', () => {
  const found = new Set(spacing.map(named));
  assert.deepEqual([...OWN].filter((name) => !found.has(name)), []);
});

test('the check sees a length however it is written', () => {
  for (const value of ['1rem', '0.5em 0', '.3em', 'calc(1px + var(--a))', 'var(--a, 2px)', '0 -1.35rem']) assert.ok(bareLength(value), value);
  for (const value of ['0', 'auto', '0 auto', 'var(--gm-space-2) 0', 'calc(-1 * var(--gm-space-5))', 'calc(var(--a) * 0.7) var(--a)', '50%']) assert.ok(!bareLength(value), value);
});

/** The value of `prop` in the rule that starts with `selector`. */
const valueOf = (selector, prop) => declarations(sheet).find((d) => d.selector.startsWith(selector) && d.prop === prop).value;

test('a card, a callout and a glossary are the same box', () => {
  const card = valueOf('.cards > :is(ul, ol) > li, .cards > :is(.card', 'padding');
  assert.equal(valueOf('blockquote.alert', 'padding'), card);
  assert.equal(valueOf('dl.defs', 'padding'), card);
});

test('blocks stand the same distance apart', () => {
  const block = valueOf('.cards', 'margin');
  for (const selector of ['.row', '.grid', '.columns', 'blockquote.alert', 'figure', 'table', 'dl.defs', 'div.bg', '.number', '.headline', '.mermaid']) {
    assert.equal(valueOf(selector, 'margin'), block, selector);
  }
});

test('the scale goes up in steps, each of them used', () => {
  const steps = [...sheet.matchAll(/--gm-space-(\d+): ([\d.]+)em/g)].map((m) => [m[1], Number(m[2])]);
  assert.ok(steps.length > 0 && steps.length <= 7, `${steps.length} steps`);
  steps.forEach(([name, size], i) => {
    assert.ok(i === 0 || size > steps[i - 1][1], name);
    assert.ok(sheet.includes(`var(--gm-space-${name})`), `--gm-space-${name} is used`);
  });
});
