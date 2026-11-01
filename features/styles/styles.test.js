import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('[text]{…} styles a span with a color and fonts', () => {
  const { body } = render('[red *text*]{red} [x]{Blue times-new-roman monospace} `[y]{red}`\n');
  assert.match(body, /<span style="color: red">red <em>text<\/em><\/span>/);
  assert.match(body, /<span class="font" style="color: blue; --font: 'times new roman', monospace">x<\/span>/);
  assert.match(body, /<code>\[y\]\{red\}<\/code>/);
});

test('::: styles every block until the closing :::', () => {
  const src = '::: red georgia\n# H\n\ntext\n- [ ] task\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\n---\n\n    [c]{red}\n\n~ aside\n:::\n\nafter\n\n:::\n';
  const { body } = render(src);
  const style = `class="font" style="color: red; --font: 'georgia'"`;
  assert.match(body, new RegExp(`<h1 ${style}>H</h1>`));
  assert.match(body, new RegExp(`<p ${style}>text</p>`));
  assert.match(body, /<li class="font task" style="[^"]*"><input type="checkbox" class="task-box" data-line="4" [^>]*> task<\/li>/);
  assert.match(body, /<td class="font" style="text-align:right; color: red; --font: 'georgia'">2<\/td>/);
  assert.match(body, /<hr>/);
  assert.match(body, /<code>\[c\]\{red\}\n<\/code>/);
  assert.match(body, new RegExp(`<p ${style}><span class="gm-mark" aria-hidden="true">~</span>aside</p>`));
  assert.match(body, /<p>after<\/p>\n<p>:::<\/p>/);
  assert.doesNotMatch(body, /[\uE000-\uE007]/);
});

test('nested ::: blocks take the innermost color and font first', () => {
  const { body } = render('::: red georgia\n::: blue\ninner\n:::\nouter\n:::\n');
  assert.match(body, /<p class="font" style="color: blue; --font: 'georgia'">inner<\/p>/);
  assert.match(body, /<p class="font" style="color: red; --font: 'georgia'">outer<\/p>/);
});

test('a span can hold a link, and a link a span', () => {
  const { body } = render('[see [x](https://x.test)]{red} and [[y]{blue}](https://y.test)\n');
  assert.match(body, /<span style="color: red">see <a href="https:\/\/x\.test">x<\/a><\/span>/);
  assert.match(body, /<a href="https:\/\/y\.test"><span style="color: blue">y<\/span><\/a>/);
});

test('an image, an escape, or braces that name nothing are not a span', () => {
  const { body } = render('![a]{red} \\[b]{red} [c]{} [d]{red!}\n');
  assert.doesNotMatch(body, /<span/);
});

test('a ::: block styles quotes, tasks, exchanges and fields inside it', () => {
  const { body } = render('::: red\n> quoted\n- [ ] task\nQ: asked\n\n@ Name: x\n:::\n');
  assert.match(body, /<blockquote>\n<p style="color: red">quoted<\/p>/);
  assert.match(body, /<li class="task" style="color: red"><input type="checkbox"/);
  assert.match(body, /<li class="qa qa-q" style="color: red"><span class="qa-label">Q<\/span>asked<\/li>/);
  assert.match(body, /<p style="color: red"><span class="field" data-line="5"/);
});

test('a ::: with nothing open stays as typed, and code inside a block is left alone', () => {
  const { body } = render(':::\n\n::: red\n```\ncode\n```\n    indented\n:::\n');
  assert.match(body, /<p>:::<\/p>/);
  assert.match(body, /<pre><code>code\n<\/code><\/pre>/);
  assert.match(body, /<pre><code>indented\n<\/code><\/pre>/);
});

test('an aside in a ::: block keeps its mark', () => {
  const { body } = render('::: red\n~ aside\n:::\n');
  assert.match(body, /<p style="color: red"><span class="gm-mark" aria-hidden="true">~<\/span>aside<\/p>/);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('x\n').css, /\.font \{ font-family: var\(--font\), var\(--gm-face\); \}/);
});

test('a line in a ::: block can open with bold or italics around punctuation', () => {
  const { body } = render('::: gray\n**[a](b)** x\n\n**"quoted"** y\n\n*(aside)* z\n\n- **[c](d)** w\n\n| **[e](f)** |\n|---|\n:::\n');
  assert.match(body, /<p style="color: gray"><strong><a href="b">a<\/a><\/strong> x<\/p>/);
  assert.match(body, /<p style="color: gray"><strong>“quoted”<\/strong> y<\/p>/);
  assert.match(body, /<p style="color: gray"><em>\(aside\)<\/em> z<\/p>/);
  assert.match(body, /<li style="color: gray"><strong><a href="d">c<\/a><\/strong> w<\/li>/);
  assert.match(body, /<th style="color: gray"><strong><a href="f">e<\/a><\/strong><\/th>/);
  assert.doesNotMatch(body, /\*|[\uE000-\uE007]/);
});

test('inside a ::: block, a glossary, displayed math and callouts are still themselves', () => {
  const { body } = render('::: red\n!slab: similar layers of abstraction\n!OK: fine\n\nmath:[a >> b]\n\n```\na <1>\n```\n<1> the first\n:::\n');
  assert.doesNotMatch(body, /[\uE000-\uF8FF]/);
  assert.match(body, /<div class="def" style="color: red">\n<dt class="def-term">slab<\/dt>\n<dd class="def-meaning">similar layers of abstraction<\/dd>/);
  assert.match(body, /<div class="def" style="color: red">\n<dt class="def-term">OK<\/dt>/);
  assert.match(body, /<p class="math-display" style="color: red">/);
  assert.match(body, /<ol class="callout-notes">\n<li data-callout="1"[^>]*><span class="callout" data-n="1"><\/span><span>the first<\/span><\/li>/);
});

test('braces after a list item\'s bullet and box style the whole item, its box included', () => {
  const { body } = render('- ( ) {bg-lemonchiffon} **High** · excited\n  @ Closest word: ( ) Happy ( ) Joyful\n- [ ] {red  monospace} task\n- {Navy} plain\n- [x][ ][ ] {gray} onion\n\n1) [ ] {bg-lavender} a step\n');
  assert.match(body, /<li class="bg task" style="--bg: lemonchiffon"><input type="radio" class="choice-box"[^>]* data-on="- \(x\) \{bg-lemonchiffon\} \*\*High\*\* · excited" data-off="- \( \) \{bg-lemonchiffon\} \*\*High\*\* · excited" aria-label="High · excited"> <strong>High<\/strong> · excited\n<span class="field"/);
  assert.match(body, /<li class="font task" style="color: red; --font: monospace"><input type="checkbox"[^>]* data-on="- \[x\] \{red {2}monospace\} task"[^>]* aria-label="task"> task<\/li>/);
  assert.match(body, /<li style="color: navy">plain<\/li>/);
  assert.match(body, /<li class="task staged" style="color: gray">.*data-lines="\[&quot;- \[ \]\[ \]\[ \] \{gray\} onion&quot;.*aria-label="onion: 1 of 3"|<li class="task staged" style="color: gray"><button[^>]*aria-label="onion: 1 of 3"[^>]*data-lines="\[&quot;- \[ \]\[ \]\[ \] \{gray\} onion&quot;/);
  assert.match(body, /<li class="bg task step" style="--bg: lavender" data-n="1"[^>]*><input type="checkbox"[^>]* data-on="1\) \[x\] \{bg-lavender\} a step"[^>]*> a step<\/li>/);
  assert.doesNotMatch(body.replace(/data-[a-z]+="[^"]*"/g, ''), /\{|[\uE000-\uE009]/);
});

test('braces that aren\'t all style names, or aren\'t right after an item\'s bullet and box, stay as typed', () => {
  const src = '- {placeholder} a\n- {red georgia} b\n- [c]{red} d\n- {red}e\n- f {red}\n- [ ] g {red}\n- h\n  {red} i\n- {red}\n\n{red} j\n\n    - {red} k\n\n- `{red} l`\n- [@ m] {red} n\n';
  const { body } = render(src);
  assert.match(body, /<li>\{placeholder\} a<\/li>/);
  assert.match(body, /<li>\{red georgia\} b<\/li>/);
  assert.match(body, /<li><span style="color: red">c<\/span> d<\/li>/);
  assert.match(body, /<li>\{red\}e<\/li>/);
  assert.match(body, /<li>f \{red\}<\/li>/);
  assert.match(body, /aria-label="g \{red\}"> g \{red\}<\/li>/);
  assert.match(body, /<li>h\n\{red\} i<\/li>/);
  assert.match(body, /<li>\{red\}<\/li>/);
  assert.match(body, /<p>\{red\} j<\/p>/);
  assert.match(body, /<pre><code>- \{red\} k\n<\/code><\/pre>/);
  assert.match(body, /<li><code>\{red\} l<\/code><\/li>/);
  assert.match(body, /<\/span> \{red\} n<\/li>/);
  assert.doesNotMatch(body, /<li [^>]*style=|[\uE000-\uE009]/);
});

test('an item\'s own color wins over its ::: block\'s, whose font still comes after', () => {
  const { body } = render('::: gray georgia\n- {blue} mine\n- theirs\n:::\n');
  assert.match(body, /<li class="font" style="color: blue; --font: 'georgia'">mine<\/li>/);
  assert.match(body, /<li class="font" style="color: gray; --font: 'georgia'">theirs<\/li>/);
});

test('bg- and a color name is a background: a span\'s, a ::: block\'s round all of it, an item\'s', () => {
  const { body } = render('[marked]{bg-Yellow darkred} [x]{bg-nothing}\n\n::: bg-aliceblue slategray\none\n\n::: bg-honeydew\ntwo\n:::\n:::\n\n- {bg-mistyrose} item\n');
  assert.match(body, /<span class="bg" style="color: darkred; --bg: yellow">marked<\/span>/);
  assert.match(body, /<span class="font" style="--font: 'bg nothing'">x<\/span>/);
  assert.match(body, /<div class="bg" style="--bg: aliceblue">\n<p style="color: slategray">one<\/p>\n<div class="bg" style="--bg: honeydew">\n<p style="color: slategray">two<\/p>\n<\/div>\n<\/div>/);
  assert.match(body, /<li class="bg" style="--bg: mistyrose">item<\/li>/);
  assert.doesNotMatch(body, /[\uE000-\uE009]|:::/);
});

test('in a layout, a background tints each of its cells', () => {
  const { body } = render('::: grid 2 bg-lavender\n- a\n- b\n:::\n');
  assert.match(body, /<div class="grid grid-items" style="--grid: 2"[^>]*>\n<ul>\n<li class="bg" style="--bg: lavender">a<\/li>\n<li class="bg" style="--bg: lavender">b<\/li>/);
});

test('a background is kept readable, its ground told to a card as --item-bg, and outlined in the system\'s colours', () => {
  const { css } = render('x\n');
  assert.match(css, /\.bg \{ --item-bg: var\(--bg\); background: var\(--item-bg\); \}/);
  assert.match(css, /--item-bg: oklch\(from var\(--bg\) clamp\(var\(--gm-bg-l-min\), l, var\(--gm-bg-l-max\)\) min\(c, var\(--gm-bg-c-max\)\) h\)/);
  assert.match(css, /li:not\(\.bg\) \{ --item-bg: initial; \}/);
  assert.match(css, /li\.bg \{ --card-bg: var\(--item-bg\); \}/);
  assert.match(css, /@media \(forced-colors: active\) \{\n {2}\.bg \{ border: 1px solid CanvasText; \}/);
});

test('uppercase sets a span, a ::: block, a list item and a heading in capitals, keeping the words as written', () => {
  const src = "[Today's prompt]{uppercase}: why?\n\n::: uppercase red\nlabel\n:::\n\n- [ ] {uppercase} Walk\n\n## {uppercase} Ways to embrace today\n\n## [ ] {Uppercase navy} Done\n";
  const { body } = render(src);
  assert.match(body, /<span class="uppercase">Today’s prompt<\/span>: why\?/);
  assert.match(body, /<p class="uppercase" style="color: red">label<\/p>/);
  assert.match(body, /<li class="uppercase task"><input type="checkbox"[^>]* data-on="- \[x\] \{uppercase\} Walk"[^>]*> Walk<\/li>/);
  assert.match(body, /<h2 class="uppercase">Ways to embrace today<\/h2>/);
  assert.match(body, /<h2 class="uppercase task-heading" style="color: navy"><input type="checkbox"[^>]* aria-label="Done"> Done<\/h2>/);
  assert.doesNotMatch(body, /\{uppercase\}<|>\{|--font: 'uppercase'/i);
});

test('braces after a heading\'s #s that aren\'t all style names stay as typed', () => {
  const { body } = render('## {foo} bar\n\n## a {uppercase} b\n');
  assert.match(body, /<h2>\{foo\} bar<\/h2>/);
  assert.match(body, /<h2>a \{uppercase\} b<\/h2>/);
});
