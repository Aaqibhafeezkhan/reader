import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

test('Q: and A: lines become an exchange', () => {
  const { body } = render('- a bullet\nQ: Why?\nA (Thomas): Because.\n\n   More.\nQ (audience): And?\nA: So.\n\n\\A: plain\n');
  assert.match(body, /<li>a bullet<\/li>\n<\/ul>\n<ul>/);
  assert.match(body, /<li class="qa qa-q"(?: id="[A-Z]\d+")?>\n<p><span class="qa-label">Q<\/span>Why\?<\/p>/);
  assert.match(body, /<li class="qa qa-a">\n<p><span class="qa-label">A<\/span><span class="qa-name">Thomas<\/span>Because\.<\/p>\n<p>More\.<\/p>/);
  assert.match(body, /<span class="qa-label">Q<\/span><span class="qa-name">audience<\/span>And\?/);
  assert.match(body, /<p>A: plain<\/p>/);
  assert.doesNotMatch(body, /[\uE000-\uE00C]/);
});

test('an exchange inside ::: is styled too', () => {
  const { body } = render('::: slategray\nQ: Styled?\nA: Yes.\n:::\n');
  assert.match(body, /<li class="gm-own qa qa-q" style="--own: slategray; color: var\(--gm-own\)"(?: id="[A-Z]\d+")?><span class="qa-label">Q<\/span>Styled\?<\/li>/);
  assert.match(body, /<li class="gm-own qa qa-a" style="--own: slategray; color: var\(--gm-own\)"><span class="qa-label">A<\/span>Yes\.<\/li>/);
});

test('a second A: or Q: in a row continues the one before', () => {
  const loose = render('Q: Why?\nA (Thomas): One.\n\nA: Two.\n\nA (Thomas): Three.\nA: Four.\nQ: So?\n').body;
  assert.match(loose, /<span class="qa-name">Thomas<\/span>One\.<\/p>\n<p>Two\.<\/p>\n<p>Three\.<\/p>\n<p>Four\.<\/p>\n<\/li>/);
  assert.equal(loose.match(/class="qa qa-a"/g).length, 1);

  const tight = render('A: b\nA: c\nA (Sarah): d\nA: e\nQ: f\nQ: g\n').body;
  assert.match(tight, /<span class="qa-label">A<\/span>b<span class="qa-para"><\/span>c<\/li>/);
  assert.match(tight, /<span class="qa-name">Sarah<\/span>d<span class="qa-para"><\/span>e<\/li>/);
  assert.match(tight, /<span class="qa-label">Q<\/span>f<span class="qa-para"><\/span>g<\/li>/);

  const apart = render('A: one\n\ntext\n\nA: two\n').body;
  assert.equal(apart.match(/class="qa qa-a"/g).length, 2);
  assert.doesNotMatch(loose + tight + apart, /[\uE000-\uE00D]/);
});

test('a name is markdown, never raw HTML', () => {
  const { body } = render('Q (<b>Ann</b> & co): Hi?\nA (Ann\'s *mom* -- "M"): Yes.\n');
  assert.match(body, /<span class="qa-name">&lt;b&gt;Ann&lt;\/b&gt; &amp; co<\/span>Hi\?/);
  assert.match(body, /<span class="qa-name">Ann’s <em>mom<\/em> – “M”<\/span>Yes\./);
});

test('code and asides are not exchanges', () => {
  const { body } = render('```\nQ: in code\n```\n\nsaid\n\n~ Q: my own question\n');
  assert.match(body, /<code>Q: in code\n<\/code>/);
  assert.match(body, /Q: my own question/);
  assert.doesNotMatch(body, /class="qa/);
});

test('an aside, like any line at the margin, ends the exchange', () => {
  const { body } = render('A (Ann): one\n~ a thought\nA (Ann): two\nA: three\n');
  assert.equal(body.match(/class="qa qa-a"/g).length, 2);
  assert.match(body, /two<span class="qa-para"><\/span>three/);
  assert.match(body, /a thought/);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('Q: x\n').css, /li\.qa \{/);
});

test('an escaped line keeps no backslash, even with no exchange about', () => {
  const { body } = render('text\n\n\\A: plain\n\n~ aside\n\\Q: in the aside\n');
  assert.match(body, /<p>A: plain<\/p>/);
  assert.match(body, /aside\nQ: in the aside/);
});

test('a name can be a link', () => {
  const { body } = render('Q (scripture:[John 3:16]): And?\nA ([Ann](https://x.test)): Yes.\n');
  assert.match(body, /<span class="qa-name"><a href="https:\/\/www\.blueletterbible\.org\/rsv\/john\/3\/16">John 3:16<\/a><\/span>And\?/);
  assert.match(body, /<span class="qa-name"><a href="https:\/\/x\.test">Ann<\/a><\/span>Yes\./);
});

test('a quote opening the line curls like any other', () => {
  const { body } = render('A (Ann): "Sparkle," she said.\n');
  assert.match(body, /<span class="qa-name">Ann<\/span>“Sparkle,” she said\./);
});

test('Good:, Bad: and Try: lines are cards, each one its own', () => {
  const { body } = render('Good (Josh): one\nGood (Josh): two\nA (Rob): agreed\nBad: three\n\nTry (Josh): four\n\n\\Good: plain\n');
  assert.equal(body.match(/class="qa qa-card qa-good"/g).length, 2);
  assert.match(body, /<li class="qa qa-card qa-good"(?: id="[A-Z]\d+")?>\n<p><span class="qa-label qa-toggle"[^>]*>G<\/span><span class="qa-name">Josh<\/span>two<\/p>\n<\/li>\n<li class="qa qa-a">\n<p><span class="qa-label">A<\/span><span class="qa-name">Rob<\/span>agreed/);
  assert.match(body, /<li class="qa qa-card qa-bad"(?: id="[A-Z]\d+")?>\n<p><span class="qa-label qa-toggle"[^>]*>B<\/span>three<\/p>/);
  assert.match(body, /<span class="qa-label qa-toggle qa-tried"[^>]*>T<\/span><span class="qa-name">Josh<\/span>four/);
  assert.match(body, /<p>Good: plain<\/p>/);
});

test('+1 under a card or a question is a vote, counted on it', () => {
  const { body } = render('Bad (Josh): late\n+1 (Rob)\n+1 (Joe): same, *again*\n+1\nA: so\n+1:\n\nQ: why?\n+1: me too\n');
  assert.match(body, /<span class="qa-label qa-toggle"[^>]*>B<\/span><span class="qa-tally">\+4<\/span><span class="qa-name">Josh<\/span>late/);
  assert.match(body, /<li class="qa qa-vote qa-bare">\n<p><span class="qa-label">\+1<\/span><span class="qa-name">Rob<\/span><\/p>/);
  assert.match(body, /<li class="qa qa-vote">\n<p><span class="qa-label">\+1<\/span><span class="qa-name">Joe<\/span>same, <em>again<\/em><\/p>/);
  assert.match(body, /<li class="qa qa-vote qa-bare">\n<p><span class="qa-label">\+1<\/span><\/p>\n<\/li>\n<li class="qa qa-a">/);
  assert.match(body, /<span class="qa-label">Q<\/span><span class="qa-tally">\+1<\/span>why\?/);
  assert.match(body, /<li class="qa qa-vote">\n<p><span class="qa-label">\+1<\/span>me too<\/p>/);
});

test('+1 with nothing to vote for stays as typed', () => {
  const { body } = render('+1 (Rob)\n\nGood: one\ntext\n+1\n\nA: two\n+1 (Ann)\n');
  assert.match(body, /<p>\+1 \(Rob\)<\/p>/);
  assert.match(body, /one\ntext\n\+1/);
  assert.doesNotMatch(body, /qa-vote|qa-tally/);
});

test('a card with [x] is done: it and what is said under it are faded', () => {
  const { body } = render('Good [x] (Josh): one\n+1 (Rob)\nA: yes\nQ: next\n\nBad [ ]: two\n\nQ [x]: plain\n');
  assert.match(body, /<li class="qa qa-card qa-good qa-done"(?: id="[A-Z]\d+")?>/);
  assert.match(body, /<li class="qa qa-vote qa-bare qa-done">/);
  assert.match(body, /<li class="qa qa-a qa-done">/);
  assert.match(body, /<li class="qa qa-q"(?: id="[A-Z]\d+")?>/);
  assert.match(body, /<li class="qa qa-card qa-bad"(?: id="[A-Z]\d+")?>/);
  assert.match(body, /<p>Q \[x\]: plain<\/p>/);
});

test('a card\'s label is a toggle named for its card, pressed once discussed; in an export, only a label', () => {
  const src = 'Good [x] (Josh): one\n\nBad: two\n';
  const { body } = render(src);
  assert.match(body, /<span class="qa-label qa-toggle" role="button" tabindex="0" aria-label="Good, discussed" aria-pressed="true"[^>]*>G<\/span>/);
  assert.match(body, /<span class="qa-label qa-toggle" role="button" tabindex="0" aria-label="Bad, discussed" aria-pressed="false"[^>]*>B<\/span>/);
  const exported = render(src, { for: 'export' }).body;
  assert.doesNotMatch(exported, /qa-toggle|role="button"|data-on=/);
  assert.match(exported, /<li class="qa qa-card qa-good qa-done"(?: id="[A-Z]\d+")?>\n<p><span class="qa-label">G<\/span>/);
});

test('a tried Try shows a check in place of its T, however it is set', () => {
  const { body } = render('Try [x] (Josh): one\nA: done\n\nTry [x]: two\n\nTry: three\n');
  assert.match(body, /aria-label="Try, tried" aria-checked="true"[^>]*>✓<\/span><span class="qa-name">Josh<\/span>one/);
  assert.match(body, /aria-checked="true"[^>]*>✓<\/span>two/);
  assert.match(body, /aria-checked="false"[^>]*>T<\/span>three/);
  assert.match(render('Try [x]: one\n', { for: 'export' }).body, /<span class="qa-label">✓<\/span>one/);
});

test('on a slide, a card\'s label says whether it\'s done, but can\'t be reached or pressed', () => {
  const src = '# One\n\nGood [x] (Josh): one\n\nTry: two\n\n---\n\n# Next\n';
  const { body } = slides(src).slides[0];
  assert.match(body, /<span class="qa-label qa-toggle" role="button" aria-disabled="true" aria-label="Good, discussed" aria-pressed="true" data-line[^>]*>G<\/span>/);
  assert.match(body, /<span class="qa-label qa-toggle qa-tried" role="checkbox" aria-disabled="true" aria-label="Try, tried" aria-checked="false" data-line[^>]*>T<\/span>/);
  assert.doesNotMatch(body, /tabindex|title=/);
});

test('a card\'s label writes its line done, or not, as written', () => {
  const src = '---\ntitle: x\n---\nGood [x] (Josh): one rfc:9110[]\n\nBad [ ]: two\n\nTry: three\n';
  const toggles = [...render(src, { line: 10 }).body.matchAll(/data-line="(\d+)" data-on="([^"]*)" data-off="([^"]*)"/g)].map((m) => m.slice(1));
  assert.deepEqual(toggles, [
    ['13', 'Good [x] (Josh): one rfc:9110[]', 'Good (Josh): one rfc:9110[]'],
    ['15', 'Bad [x]: two', 'Bad [ ]: two'],
    ['17', 'Try [x]: three', 'Try: three'],
  ]);
  assert.match(render('Q: x\nA: y\n').body, /^(?![\s\S]*qa-toggle)/);
});

test('a Try card\'s label is a box, ticked once it\'s been tried', () => {
  const { body } = render('Try (Josh): half the cumin\n\nTry [x]: less salt\n');
  assert.match(body, /<span class="qa-label qa-toggle qa-tried" role="checkbox" tabindex="0" aria-label="Try, tried" aria-checked="false" title="Mark it tried"[^>]*>T<\/span>/);
  assert.match(body, /<li class="qa qa-card qa-try qa-done"(?: id="[A-Z]\d+")?>\n<p><span class="qa-label qa-toggle qa-tried" role="checkbox"[^>]*aria-checked="true" title="Not tried yet"/);
});

test('( ) on an answer\'s line is radio buttons in a row, a group named by the question, each knowing its line with only it picked', () => {
  const md = 'Q (Claude): Put the *page bar* fix in 0.0.4?\nA (Josh): ( ) Yes (x) No ( ) **Later**\nA: ( ) Sat ( ) Sun\n';
  const { body } = render(md);
  assert.match(body, /<span class="qa-name">Josh<\/span><span class="qa-choices" role="radiogroup" aria-label="Put the page bar fix in 0\.0\.4\?" data-line="1" data-text="A \(Josh\): \( \) Yes \(x\) No \( \) \*\*Later\*\*" data-off="A \(Josh\): \( \) Yes \( \) No \( \) \*\*Later\*\*" data-answered="true">/);
  const radios = [...body.matchAll(/<label class="qa-choice"><input type="radio" class="qa-box" name="qa-(\d)" data-on="([^"]*)"( checked)?> (.*?)<\/label>/g)]
    .map((m) => [m[1], m[2], Boolean(m[3]), m[4]]);
  assert.deepEqual(radios, [
    ['1', 'A (Josh): (x) Yes ( ) No ( ) **Later**', false, 'Yes'],
    ['1', 'A (Josh): ( ) Yes (x) No ( ) **Later**', true, 'No'],
    ['1', 'A (Josh): ( ) Yes ( ) No (x) **Later**', false, '<strong>Later</strong>'],
    ['2', 'A: (x) Sat ( ) Sun', false, 'Sat'],
    ['2', 'A: ( ) Sat (x) Sun', false, 'Sun'],
  ]);
  // One set to a line, the second a paragraph of the same answer.
  assert.equal(body.match(/class="qa qa-a"/g).length, 1);
  assert.match(body, /data-line="2"[^>]*data-answered="false"/);
  assert.doesNotMatch(body, /[\uE000-\uF8FF]/);
});

test('a blank as one of an answer\'s choices is a blank, beside a button of its own named by it', () => {
  const { body } = render('Q: Ship it?\nA: ( ) Yes ( ) [@ Something else: (x) maybe]\n');
  assert.match(body, /<span class="qa-choice qa-choice-blank"><label class="qa-choice-box"><input type="radio" class="qa-box" name="qa-1" data-on="A: \( \) Yes \(x\) \[@ Something else: \(x\) maybe\]" aria-label="Something else"><\/label><span class="field field-inline" data-line="1"[^>]*>/);
  assert.match(body, /data-answered="false"/, 'a mark in the blank\'s answer is the answer\'s');
});

test('an answer\'s line that isn\'t all choices stays as typed', () => {
  for (const line of ['A: I said ( ) once', 'A: ( ) Yes ( )', 'A: ( ) **a ( ) b**', 'A: [( ) a](https://example.com) ( ) b', '\\A: ( ) a ( ) b', 'Q: ( ) a ( ) b', 'A: \\( ) a ( ) b']) {
    const { body } = render(`${line}\n`);
    assert.doesNotMatch(body, /qa-choices|type="radio"/, line);
    assert.doesNotMatch(body, /[\uE000-\uF8FF]/, line);
  }
  // A mark in code is the code's.
  const { body } = render('A: ( ) `( )` empty ( ) `(x)` full\n');
  assert.equal(body.match(/type="radio"/g).length, 2);
  assert.match(body, /data-on="A: \( \) `\( \)` empty \(x\) `\(x\)` full"/);
});

test('an answer\'s choices show what\'s picked and can\'t be changed on a slide, and are named for the answer with no question', () => {
  const deck = slides('A: ( ) Yes (x) No\n\n---\n\nNext\n').slides[0].body;
  assert.equal(deck.match(/class="qa-box"[^>]* disabled>/g).length, 2);
  assert.match(deck, /data-on="A: \( \) Yes \(x\) No" checked disabled>/);
  assert.match(deck, /role="radiogroup" aria-label="Answer"/);
});

const NESTED = [
  'Q (Claude): Fix the tracks bug now?',
  'A: Now, or file an issue.',
  '  Q (Claude): Fix part A now?',
  '  A: File an issue.',
  '  Q (Claude): Fix part B now?',
  '  A: Now.',
  'Q (Claude): Fix this other part?',
  'A: File an issue.',
].join('\n');

test('a Q: or A: indented under an exchange is an exchange of its own, a list in its item', () => {
  const { body } = render(`${NESTED}\n`);
  assert.match(body, /<li class="qa qa-a"><span class="qa-label">A<\/span>Now, or file an issue\.\n<ul>\n<li class="qa qa-q"(?: id="[A-Z]\d+")?><span class="qa-label">Q<\/span><span class="qa-name">Claude<\/span>Fix part A now\?<\/li>\n<li class="qa qa-a"><span class="qa-label">A<\/span>File an issue\.<\/li>\n<li class="qa qa-q"(?: id="[A-Z]\d+")?>[^\n]*Fix part B now\?<\/li>\n<li class="qa qa-a"><span class="qa-label">A<\/span>Now\.<\/li>\n<\/ul>\n<\/li>\n<li class="qa qa-q"(?: id="[A-Z]\d+")?>[^\n]*Fix this other part\?<\/li>/);
  assert.doesNotMatch(body, /Q \(Claude\)|A: /);
});

test('exchanges nest as deep as they\'re indented, and back out to the depth a line is indented to', () => {
  const md = 'Q: Top?\nA: Split it.\n  Q: Part?\n  A: Yes.\n    Q: Deeper?\n    A: Deeper yet.\n  A: Another thought.\nBad (Josh): A card\n  Try: nested\n  +1 (Rob)\nQ: Next\n';
  const { body } = render(md);
  assert.equal(body.match(/<ul>/g).length, 4);
  // Back from a deeper exchange, an answer is another, not the one before carried on.
  assert.match(body, /Deeper yet\.<\/li>\n<\/ul>\n<\/li>\n<li class="qa qa-a"><span class="qa-label">A<\/span>Another thought\.<\/li>/);
  // A card's under a card, and a vote for the one at its depth.
  assert.match(body, /data-on=" {2}Try \[x\]: nested"[^>]*>T<\/span><span class="qa-tally">\+1<\/span>nested<\/li>\n<li class="qa qa-vote qa-bare">/);
  assert.match(body, /<\/ul>\n<\/li>\n<li class="qa qa-q"(?: id="[A-Z]\d+")?><span class="qa-label">Q<\/span>Next<\/li>/);
});

test('an indented Q: with no exchange above it, or after the exchange ended, stays as typed', () => {
  for (const md of ['Some text\n  Q: not nested\n', '  A: alone\n', 'Q: Why?\nA: So.\nText ends it.\n  Q: as typed\n']) {
    const { body } = render(md);
    assert.match(body, /Q: not nested|A: alone|Q: as typed/, md);
  }
});

test('a Q: in a numbered item is drawn as a question inside it, its choices under it (gh-302)', () => {
  const md = '1) [ ] **Two lists numbered the same**\n\n   The first item to claim an id keeps it.\n\n   Q (Claude): Is that enough, for now?\n   - ( ) Yes\n   - ( ) [@ Something else]\n';
  const { body } = render(md);
  const item = /<li class="task step"[^>]*>([\s\S]*?)<\/li>\n<\/ol>/.exec(body)[1];
  assert.match(item, /<p>The first item to claim an id keeps it\.<\/p>\n<ul>\n<li class="qa qa-q" id="Q1"><span class="qa-label">Q<\/span><span class="qa-name">Claude<\/span>Is that enough, for now\?<\/li>\n<\/ul>\n<ul data-answered="false">/);
  assert.match(item, /data-on=" {3}- \(x\) Yes"/);
  assert.doesNotMatch(body, /Q \(Claude\):/);
});

test('a Q: and A: in a bullet\'s or a task\'s item are an exchange inside it, nesting under each other as at the margin (gh-302)', () => {
  const bullet = render('- one\n- two\n\n  Q: Under two?\n  A: ( ) Yes ( ) No\n    Q: Nested?\n\nafter\n').body;
  assert.match(bullet, /<p>two<\/p>\n<ul>\n<li class="qa qa-q" id="Q1"><span class="qa-label">Q<\/span>Under two\?<\/li>\n<li class="qa qa-a"><span class="qa-label">A<\/span><span class="qa-choices" role="radiogroup" aria-label="Under two\?" data-line="4" data-text=" {2}A: \( \) Yes \( \) No"/);
  assert.match(bullet, /<\/span>\n<ul>\n<li class="qa qa-q" id="Q2"><span class="qa-label">Q<\/span>Nested\?<\/li>/);
  assert.match(bullet, /<\/ul>\n<p>after<\/p>/);
  const task = render('- [ ] Fix it\n\n  Good (Josh): it\'s small\n').body;
  assert.match(task, /aria-label="Fix it"> Fix it<\/p>\n<ul>\n<li class="qa qa-card qa-good" id="G1"><span class="qa-label qa-toggle"[^>]*data-line="2" data-on=" {2}Good \[x\] \(Josh\): it's small"/);
  assert.match(render('- one\n\n  \\Q: as typed\n').body, /<p>Q: as typed<\/p>/);
});

test('a - Q: bullet is a question, its choices under it, and a - A: straight after it its answer, each its own bullet; 1) Good: keeps its number (gh-302)', () => {
  const { body } = render('- Q (Claude): Ship it?\n  - ( ) Yes\n  - ( ) No\n- Q (Claude): Or later?\n- A: ( ) Now ( ) Later\n');
  assert.match(body, /<ul>\n<li>\n<ul>\n<li class="qa qa-q" id="Q1"><span class="qa-label">Q<\/span><span class="qa-name">Claude<\/span>Ship it\?<\/li>\n<\/ul>\n<ul data-answered="false">\n<li class="task"><input type="radio"[^>]*data-on=" {2}- \(x\) Yes"/);
  assert.match(body, /<li class="qa qa-a"><span class="qa-label">A<\/span><span class="qa-choices" role="radiogroup" aria-label="Or later\?" data-line="4" data-text="- A: \( \) Now \( \) Later"/);
  assert.match(body, /data-on="- A: \(x\) Now \( \) Later"/);
  const card = render('1) Good (Josh): kept\n2) Try: next\n').body;
  assert.match(card, /<li data-n="1" id="1">\n<ul>\n<li class="qa qa-card qa-good" id="G1"><span class="qa-label qa-toggle"[^>]*data-on="1\) Good \[x\] \(Josh\): kept" data-off="1\) Good \(Josh\): kept">G<\/span>/);
  assert.match(card, /data-on="2\) Try \[x\]: next"/);
  assert.equal(render('+ Q: Plus?\n').body.match(/qa-label/g).length, 1, 'a + bullet labels the question once');
});

test('an aside under a question in a list\'s item goes beside it (gh-302)', () => {
  const md = '---\nreviewer #: Josh\n---\n\n1) [ ] **A point**\n\n   Q (Claude): Agreed?\n   ~# not yet\n   - ( ) Yes\n';
  const { body } = render(md);
  const beside = body.split('<section class="gm-pair">').slice(1).find((p) => p.includes('not yet'));
  assert.match(beside, /<span class="qa-label">Q<\/span><span class="qa-name">Claude<\/span>Agreed\?/);
  assert.doesNotMatch(body, /~#|Q \(Claude\):/);
});

test('a nested answer\'s choices are named by its own question and write its line as indented', () => {
  const { body } = render('Q: Top?\nA: Split it.\n  Q: Part A?\n  A: ( ) Now ( ) [@ Something else]\n');
  assert.match(body, /<span class="qa-choices" role="radiogroup" aria-label="Part A\?" data-line="3" data-text=" {2}A: \( \) Now \( \) \[@ Something else\]"/);
  assert.match(body, /data-on=" {2}A: \(x\) Now \( \) \[@ Something else\]"> Now<\/label>/);
});

test('an aside under a nested line goes beside it, at any depth', () => {
  const md = '---\nreviewer #: Josh\n---\n\nQ: Top?\nA: Split it.\n  ~# split in two\n  Q: Part A?\n  A: Now.\n    ~# it\'s small\n  Q: Part B?\n';
  const { body } = render(md);
  const pairs = body.split('<section class="gm-pair">').slice(1);
  const beside = (words) => pairs.find((p) => p.includes(words));
  assert.match(beside('split in two'), /Split it\./);
  assert.doesNotMatch(beside('split in two'), /Part A\?/);
  assert.match(beside('it’s small'), /<span class="qa-label">A<\/span>Now\./);
  assert.doesNotMatch(body, /~#/);
});

test('each question and card has an id by its label and how many of its kind are before it, nested ones too (gh-300)', () => {
  const { body, anchors } = render('Q (Daniel): Coffee?\nA (Maria): See [the next](#Q2).\n\nGood (Josh): Fun\n+1\nBad: Late\n  Q: Why?\n  A: Traffic.\nTry: Earlier\nGood: Calm\n');
  const ids = [...body.matchAll(/<li class="qa[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['Q1', 'G1', 'B1', 'Q2', 'T1', 'G2']);
  assert.deepEqual(Object.keys(anchors).sort(), ['B1', 'G1', 'G2', 'Q1', 'Q2', 'T1']);
  assert.doesNotMatch(body, /<li class="qa qa-a"[^>]* id=/, 'an answer has none');
  assert.doesNotMatch(body, /qa-vote[^>]* id=/, 'nor a vote');
});

test('a question carried on by the same person\'s next is one question, with one id', () => {
  const { body } = render('Q (Daniel): Coffee?\nQ (Daniel): Or tea?\nQ (Maria): A break?\n');
  assert.deepEqual([...body.matchAll(/ id="(Q\d+)"/g)].map((m) => m[1]), ['Q1', 'Q2']);
});

test('a deck\'s questions count on across its slides, so each has its own id', () => {
  const deck = slides('Q: First?\n\n---\n\nQ: Second?\n').slides;
  assert.match(deck[0].body, / id="Q1"/);
  assert.match(deck[1].body, / id="Q2"/);
});

test('a card\'s words can start on the line under its label, indented, a paragraph or more (gh-219)', () => {
  const { body } = render('Good (Claude):\n\n  An aside kept each conversation in place.\n\n  Neither of us had to say which line.\n+1 (Josh): I\'d add that.\n');
  assert.match(body, /<li class="qa qa-card qa-good" id="G1">\n<p><span class="qa-label qa-toggle"[^>]*data-on="Good \[x\] \(Claude\):" data-off="Good \(Claude\):">G<\/span><span class="qa-tally">\+1<\/span><span class="qa-name">Claude<\/span>An aside kept each conversation in place\.<\/p>\n<p>Neither of us had to say which line\.<\/p>\n<\/li>/);
  assert.match(body, /<li class="qa qa-vote">\n<p><span class="qa-label">\+1<\/span><span class="qa-name">Josh<\/span>I’d add that\.<\/p>/);
  assert.doesNotMatch(body, /[\uE000-\uE00D]/);
});

test('words straight under a label, with no blank line, are its words too, and a question\'s or an answer\'s (gh-219)', () => {
  const { body } = render('Bad [x] (Josh):\n  Tight under.\n  More of it.\nQ:\n  Why?\nA (Rob):\n  Because.\n');
  assert.match(body, /<li class="qa qa-card qa-bad qa-done" id="B1"><span class="qa-label qa-toggle"[^>]*data-on="Bad \[x\] \(Josh\):" data-off="Bad \(Josh\):">B<\/span><span class="qa-name">Josh<\/span>Tight under\.\nMore of it\.<\/li>/);
  assert.match(body, /<li class="qa qa-q" id="Q1"><span class="qa-label">Q<\/span>Why\?<\/li>/);
  assert.match(body, /<li class="qa qa-a"><span class="qa-label">A<\/span><span class="qa-name">Rob<\/span>Because\.<\/li>/);
  assert.doesNotMatch(body, /[\uE000-\uE00D]/);
});

test('a label alone stays as typed with nothing indented under it, or with an aside, a vote or another label next (gh-219)', () => {
  for (const src of ['Good (Claude):\n\nNot indented.\n', 'Good (Claude):\n', 'Try (Ana):\n~ an aside\n', 'Good (Claude):\n  Q: a question\n', 'Good (Claude):\n  +1 (Rob)\n']) {
    const { body } = render(src);
    assert.match(body, /<p>(Good|Try) \((Claude|Ana)\):/, src);
    assert.doesNotMatch(body, /qa-card/, src);
  }
});

test('an aside on a card written under its label goes where it would beside it (gh-219)', () => {
  const page = (card) => render(`---\nreviewer #: Josh\n---\n\n${card}`).body.replace(/ data-(line|on|off)="[^"]*"/g, '');
  for (const words of ['An aside.\n  ~# I agree.\n\n  Second.\n', 'An aside.\n\n  Second.\n  ~# On the second.\n']) {
    assert.equal(page(`Good (Claude):\n\n  ${words}`), page(`Good (Claude): ${words}`));
  }
});

test('an aside between a label alone and its words goes beside the label, a blank line before the words (gh-219)', () => {
  const page = render('---\nreviewer m: Maria\nreviewer #: Josh\n---\n\nBad (Maria):\n~m This makes me think ...\n~# A comment.\n\n  Straight under.\nA (Claude): Answered beside.\n').body;
  assert.match(page, /<li class="qa qa-card qa-bad" id="B1">\n<p><span class="qa-label qa-toggle"[^>]*>B<\/span><span class="qa-name">Maria<\/span>Straight under\.<\/p>/);
  assert.equal(page.match(/gm-aside-cell/g)?.length, 2, 'both asides, beside it');
  assert.match(page, /<li class="qa qa-a">(?:\n<p>)?<span class="qa-label">A<\/span><span class="qa-name">Claude<\/span>Answered beside\./);
  // With no blank line, the indented line is the aside's own, and the label has no words.
  const tight = render('---\nreviewer m: Maria\n---\n\nBad (Maria):\n~m An aside\n  its next line.\n').body;
  assert.match(tight, /<p>Bad \(Maria\):<\/p>/);
  assert.doesNotMatch(tight, /qa-card/);
});

test('a label alone with a list, a quote or code under it stays as typed, and what\'s under it as written (gh-219, gh-81)', () => {
  for (const [src, under] of [['A (Claude):\n  - ( ) Yes\n  - ( ) No\n', /<ul data-answered="false">/], ['Bad (Josh):\n  > quoted\n', /<blockquote>/], ['A (Josh):\n  ```\n  code\n  ```\n', /<pre><code>code/], ['Q (Josh):\n  1. first\n', /<ol>\n<li>first<\/li>/], ['Good (Josh):\n\n      indented code\n', /<pre><code>/]]) {
    const { body } = render(src);
    assert.match(body, /<p>(A|Bad|Q|Good) \(\w+\):<\/p>/, src);
    assert.doesNotMatch(body, /qa-(card|a|q)\b/, src);
    assert.match(body, under, src);
    assert.doesNotMatch(body, /[\uE000-\uE00D]/, src);
  }
});


test('braces at the start of the words under a label stay as typed, not styling the label', () => {
  const under = render('Good (Claude):\n\n  {red} Its words.\n').body;
  assert.doesNotMatch(under, /gm-red/);
  assert.match(under, /<span class="qa-name">Claude<\/span>\{red\} Its words\./);
  const beside = render('Good (Claude): {red} Its words.\n').body;
  assert.match(beside, /<li class="qa qa-card qa-good" style="color: var\(--gm-red\)"/);
});
