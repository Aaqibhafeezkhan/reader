import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

const meaning = (body) => body.match(/<dd class="def-meaning">([^]*?)<\/dd>/)[1];

test('a ! line is a term and what it means', () => {
  const { body } = render('!sealed interface: a type whose **subtypes** are [all](https://x.test) known\n');
  assert.match(body, /<dl class="defs">\n<div class="def">\n<dt class="def-term">sealed interface<\/dt>\n<dd class="def-meaning">a type whose <strong>subtypes<\/strong> are <a href="https:\/\/x\.test">all<\/a> known<\/dd>\n<\/div>\n<\/dl>/);
  assert.doesNotMatch(body, /[\uE030\uE031]/);
});

test('a space after the ! is allowed, and one after the colon is needed', () => {
  assert.match(render('! SLAB: x\n').body, /<dt class="def-term">SLAB<\/dt>/);
  assert.doesNotMatch(render('!http://x.test\n').body, /class="defs"/);
});

test('an image, an escaped line, code and an aside are not definitions', () => {
  const { body } = render('![alt](x.png)\n\n\\!plain: stays\n\n```\n!code: x\n```\n\nsaid\n\n~ !mine: a thought\n');
  assert.match(body, /<img src="x\.png" alt="alt">/);
  assert.match(body, /<p>!plain: stays<\/p>/);
  assert.match(body, /<code>!code: x\n<\/code>/);
  assert.match(body, /!mine: a thought/);
  assert.doesNotMatch(body, /class="defs"/);
});

test('who used the term follows the meaning', () => {
  const { body } = render('!SLAB (Venkat): similar layers of abstraction\n!TLA ([Ann](https://x.test)): three letter acronym\n');
  assert.match(body, /<b class="def-initial">b<\/b>straction<span class="def-name">Venkat<\/span><\/dd>/);
  assert.match(body, /<span class="def-name"><a href="https:\/\/x\.test">Ann<\/a><\/span><\/dd>/);
});

test('definitions in a row are one glossary, a term again its next sense', () => {
  const { body } = render('text\n!one: 1\n!gatherer: first\n!gatherer (Ann): second\n!two: 2\n\n!three: 3\n');
  assert.match(body, /<p>text<\/p>\n<dl class="defs">/);
  assert.equal(body.match(/<dl class="defs">/g).length, 2);
  assert.match(body, /<div class="def def-senses">\n<dt class="def-term">gatherer<\/dt>\n<dd class="def-meaning">first<\/dd>\n<dd class="def-meaning">second<span class="def-name">Ann<\/span><\/dd>\n<\/div>/);
});

test('a term with no meaning yet is a blank to fill in', () => {
  const { body } = render('# Notes\n\n!REPL (Venkat):\n');
  assert.match(body, /<span class="field def-blank" data-line="2" data-text="!REPL \(Venkat\):" data-head="!REPL \(Venkat\):"><span class="field-value" data-value="" data-empty="not yet defined" tabindex="0" role="textbox" aria-label="REPL"><\/span><\/span><span class="def-name">Venkat<\/span>/);
});

test('on an exported page, a term with no meaning yet is a blank but not a box', () => {
  const { body } = render('# Notes\n\n!REPL (Venkat):\n', { exported: true });
  assert.match(body, /<span class="field def-blank"[^>]*><span class="field-value" data-value="" data-empty="not yet defined"><\/span><\/span>/);
  assert.doesNotMatch(body, /tabindex|role="textbox"|aria-label/);
});

test('on a slide, a term with no meaning yet isn\'t a box', () => {
  const { body } = slides('# One\n\n!REPL:\n\n---\n\n# Two\n').slides[0];
  assert.match(body, /<span class="field-value" data-value="" data-empty="not yet defined"><\/span><\/span>/);
  assert.doesNotMatch(body, /class="field-value"[^>]*(tabindex|role=)/);
  // The stylesheet's "not yet defined" is what says it's empty.
  assert.doesNotMatch(body, /field-blank/);
});

test('an acronym has the letters it is spelled with bolded', () => {
  const b = (letter) => `<b class="def-initial">${letter}</b>`;
  assert.equal(meaning(render('!SLAB: similar layers of abstraction').body), `${b('s')}imilar ${b('l')}ayers of ${b('a')}${b('b')}straction`);
  assert.equal(meaning(render('!JSON: JavaScript Object Notation').body), `${b('J')}ava${b('S')}cript ${b('O')}bject ${b('N')}otation`);
  assert.equal(meaning(render('!API: an application programming interface').body), `an ${b('a')}pplication ${b('p')}rogramming ${b('i')}nterface`);
  assert.equal(meaning(render('!POS: point of sale').body), `${b('p')}oint ${b('o')}f ${b('s')}ale`);
  assert.equal(meaning(render('!REPL: read-eval-print loop').body), `${b('r')}ead-${b('e')}val-${b('p')}rint ${b('l')}oop`);
  assert.equal(meaning(render('!FOO: not this one').body), 'not this one');
  assert.equal(meaning(render('!slab: similar layers of abstraction').body), 'similar layers of abstraction');
});

test('the term written with a ! elsewhere shows its meaning on hover', () => {
  const { body } = render('!SLAB and SLAB, !slab, `!SLAB`, [!SLAB](x), !SLABS, \\!SLAB, wow!SLAB.\n\n!SLAB: similar layers of abstraction\n!sealed interface: closed\n\nA !Sealed interface, a sealed interface.\n\n~ !SLAB in an aside\n');
  const use = (n) => `<span class="def-use" tabindex="0" aria-describedby="def-pop-${n}">SLAB<span class="def-pop" role="tooltip" aria-hidden="true"><b class="def-pop-term">SLAB</b> <span id="def-pop-${n}">similar layers of abstraction</span></span></span>`;
  assert.ok(body.includes(use(3)));
  assert.match(body, new RegExp(`<p>${use(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} and SLAB, !slab, <code>!SLAB</code>, <a href="x">!SLAB</a>, !SLABS, !SLAB, wow!SLAB\\.</p>`));
  assert.match(body, /A <span class="def-use" tabindex="0" aria-describedby="def-pop-2">Sealed interface<span class="def-pop" role="tooltip" aria-hidden="true"><b class="def-pop-term">sealed interface<\/b> <span id="def-pop-2">closed<\/span><\/span><\/span>, a sealed interface\./);
});

test('a term written plural or singular is the term', () => {
  const { body } = render('!innovation token: one new thing\n!SLO: service level objective\n!policies: rules\n\n- three !innovation tokens, two !SLOs, one !policy\n\n!SLOS and !slos as typed\n');
  const term = (text, t) => `<span class="def-use" tabindex="0" aria-describedby="def-pop-\\d+">${text}<span class="def-pop" role="tooltip" aria-hidden="true"><b class="def-pop-term">${t}</b>`;
  assert.match(body, new RegExp(`three ${term('innovation tokens', 'innovation token')}.*two ${term('SLOs', 'SLO')}.*one ${term('policy', 'policies')}`));
  assert.match(body, /<p>!SLOS and !slos as typed<\/p>/);
  assert.doesNotMatch(body, /ingredient/);
});

test('a term with senses, or none yet, says so on hover', () => {
  const { body } = render('!g: one\n!g: *two*\n!h:\n\n!g and !h\n');
  assert.match(body, /<b class="def-pop-term">g<\/b> <span id="def-pop-1"><b class="def-pop-sense">1\.<\/b> one <b class="def-pop-sense">2\.<\/b> <em>two<\/em><\/span><\/span>/);
  assert.match(body, /<b class="def-pop-term">h<\/b> <span id="def-pop-\d+"><i>not yet defined<\/i>/);
});

test('a later slide knows the terms an earlier one defined', () => {
  const deck = slides('# One\n\n!SLAB: similar layers of abstraction\n\n---\n\n# Two\n\n!SLAB again\n');
  assert.match(deck.slides[1].body, /<span class="def-use" tabindex="0" aria-describedby="def-pop-1">SLAB<span class="def-pop"/);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('!x: y\n').css, /\.def-use \{/);
});

test('with lines, a glossary names the line it starts on', () => {
  const { body } = render('para\n\n!slab: x\n!ok: y\n', { lines: true });
  assert.match(body, /<dl class="defs" data-line="2">\n<div class="def" data-line="2">/);
});
