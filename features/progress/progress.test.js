import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import MarkdownIt from 'markdown-it';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';
import { preview, settle } from '../../test/dom.js';
import { progress } from './index.js';

const bars = (body) => [...body.matchAll(/<span class="progress"([^>]*)><progress value="([^"]*)" max="([^"]*)" aria-label="([^"]*)"><\/progress> <span class="progress-count">([^<]*)<\/span><\/span>/g)]
  .map(([, attrs, value, max, name, count]) => ({ attrs, value, max, name, count }));

test('a bar written as a count is drawn as written, named by the words after it', () => {
  const { body } = render('progress:[326/1007] pages\n');
  assert.deepEqual(bars(body), [{ attrs: '', value: '326', max: '1007', name: 'pages', count: '326 of 1007' }]);
  assert.match(body, /<\/span><\/span> pages<\/p>/, 'the words stay where they\'re written');
  assert.equal(bars(render('progress:[ 1.5 / 3 ]\n').body)[0].name, 'Progress', 'one with no words is named for what it is');
  assert.match(render('progress:[lots] and progress:[1/]\n').body, /<p>progress:\[lots\] and progress:\[1\/\]<\/p>/, 'what isn\'t a count stays as typed');
});

test('empty brackets count the boxes in its section and those done, not its heading\'s own box, nor a choice', () => {
  const { body } = render('# [ ] Work\n\nprogress:[] reviewed\n\n- [x] a\n- [ ] b\n- ( ) c\n\n## [x] Sub\n- [x][x] d\n- [x][ ] e\n\n# Other\n- [x] f\n');
  assert.deepEqual(bars(body), [{ attrs: ' data-lines="4 5 8 9 10"', value: '3', max: '5', name: 'reviewed', count: '3 of 5' }]);
});

test('a bar with nothing to count is empty', () => {
  assert.deepEqual(bars(render('progress:[] done\n').body)[0], { attrs: ' data-lines=""', value: '0', max: '1', name: 'done', count: '0 of 0' });
});

test('it counts whatever a feature tags as done or not, without knowing which feature drew it', () => {
  const md = new MarkdownIt().use(progress);
  md.core.ruler.before('progress_count', 'chores', (state) => {
    state.tokens.forEach((t) => {
      if (t.type === 'inline' && /^chore/.test(t.content)) t.children.push(Object.assign(new state.Token('text', '', 0), { content: '', meta: { done: /done/.test(t.content), line: t.map[0] } }));
    });
  });
  const body = md.render('progress:[] chores\n\n- chore done\n- chore\n- chore done\n');
  assert.deepEqual(bars(body), [{ attrs: ' data-lines="2 3 4"', value: '2', max: '3', name: 'chores', count: '2 of 3' }]);
});

test('on a slide, and in a record, it counts the boxes as the file has them', () => {
  const deck = slides('# One\n\n- [x] a\n\n---\n\nprogress:[] done\n\n- [x] b\n- [ ] c\n').slides;
  assert.equal(bars(deck[1].body)[0].count, '1 of 2', 'the slide\'s own');
  const record = '---\nopen-until: 2026-10-28 04:00\n---\n\nprogress:[] done\n\n- [x] a\n- [ ] b\n';
  assert.equal(bars(render(record, { now: new Date(2026, 9, 29).getTime() }).body)[0].count, '1 of 2');
});

test('in the preview, the bar fills as its boxes are ticked, before the page is drawn again', async () => {
  const p = preview();
  p.show(render('## Chores\n\nprogress:[] done\n\n- [ ] a\n- [ ] b\n- [x][ ] c\n\n## Else\n\n- [ ] d\n').body);
  const $ = (sel) => p.document.querySelector(sel);
  const click = (node) => node.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const shows = () => [$('.progress progress').value, $('.progress-count').textContent];
  assert.deepEqual(shows(), [0, '0 of 3']);
  click($('input[data-line="4"]'));
  await settle();
  assert.deepEqual(shows(), [1, '1 of 3']);
  click($('.stage-box'));
  await settle();
  assert.deepEqual(shows(), [2, '2 of 3'], 'a staged box once it\'s full');
  click($('input[data-line="10"]'));
  await settle();
  assert.deepEqual(shows(), [2, '2 of 3'], 'not a box in another section');
});

test('the bar is drawn in the page\'s colours, empty as empty in every browser, and the browser\'s own where colours are forced', () => {
  const css = readFileSync(new URL('./progress.css', import.meta.url), 'utf8');
  // Firefox drew an empty bar full in the dark theme from an accent-color (gh-248).
  assert.doesNotMatch(css, /accent-color:/);
  const drawn = /@media not \(forced-colors: active\) \{([\s\S]*)\n\}/.exec(css)?.[1] ?? '';
  assert.match(drawn, /\.progress progress \{[^}]*appearance: none;[^}]*background: var\(--gm-rule\);/);
  assert.match(drawn, /\.progress progress::-webkit-progress-bar \{ background: var\(--gm-rule\); \}/);
  assert.match(drawn, /\.progress progress::-webkit-progress-value \{ background: var\(--gm-accent\); \}/);
  assert.match(drawn, /\.progress progress::-moz-progress-bar \{ background: var\(--gm-accent\); \}/);
});
