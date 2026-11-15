import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';
import { readNumber } from './index.js';

const fence = (text) => `\`\`\`number\n${text}\n\`\`\`\n`;

test('the first line is the number, and the rest is the line under it', () => {
  assert.deepEqual(readNumber('\n 15% \n\ndaily code\nchange\n'), { figure: '15%', caption: 'daily code change' });
  assert.deepEqual(readNumber('42'), { figure: '42', caption: '' });
  assert.deepEqual(readNumber('\n'), { figure: '', caption: '' });
});

test('a number fence is a box: the figure, and its caption', () => {
  assert.match(render(fence('15%\ndaily code change')).body, /<div class="number">\n<p class="number-figure" style="--chars: 3">15%<\/p>\n<p class="number-caption">daily code change<\/p>\n<\/div>/);
  assert.match(render(fence('1,204')).body, /<div class="number">\n<p class="number-figure" style="--chars: 5">1,204<\/p>\n<\/div>/);
});

test('both lines are prose: a span styles one, and markup is shown, not run', () => {
  const { body } = render(fence('[15%]{seagreen}\n*daily* <b>change</b>'));
  assert.match(body, /<p class="number-figure" style="--chars: 3"><span class="gm-own" style="--own: seagreen; color: var\(--gm-own\)">15%<\/span><\/p>/);
  assert.match(body, /<p class="number-caption"><em>daily<\/em> &lt;b&gt;change&lt;\/b&gt;<\/p>/);
});

test('an empty fence stays code, and so do other fences', () => {
  assert.match(render(fence('')).body, /<pre><code class="language-number">/);
  assert.doesNotMatch(render('```\nnumber\n```\n').body, /class="number/);
});

test('the box takes the block\'s line', () => {
  assert.match(render(`# T\n\n${fence('15%')}`, { lines: true }).body, /<div class="number" data-line="2">/);
});

test('on a slide, a number under the title is the slide\'s body', () => {
  const { body } = slides(`# T\n\n${fence('15%')}\n---\n\n# Two\n`).slides[0];
  assert.match(body, /<header class="slide-title">\n<h1 id="t">T<\/h1>\n<\/header>\n<div class="slide-body">\n<section class="gm-pair">\n<div class="gm-speaker">\n<div class="number">/);
});
