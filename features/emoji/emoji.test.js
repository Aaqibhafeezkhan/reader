import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { emojify } from './index.js';

test('shortcodes become emoji in text and asides', () => {
  const { body } = render('Done :tada: :+1:\n\n~ so :heart: this\n');
  assert.match(body, /Done 🎉 👍/);
  assert.match(body, /so ❤️ this/);
  assert.doesNotMatch(body, /:tada:|:heart:/);
});

test('code, unknown names and times are left alone', () => {
  const { body } = render('`:tada:` and :not_an_emoji: at 10:30:45\n\n```\n:tada:\n```\n');
  assert.match(body, /<code>:tada:<\/code>/);
  assert.match(body, /<pre><code[^>]*>:tada:\n<\/code><\/pre>/);
  assert.match(body, /:not_an_emoji:/);
  assert.match(body, /10:30:45/);
});

test('attributes are never rewritten', () => {
  assert.equal(
    emojify('<a href="https://x.test/:tada:/">:tada:</a>'),
    '<a href="https://x.test/:tada:/">🎉</a>',
  );
});

test('a shortcode in the masthead, a caption or a field shows too', () => {
  const { body } = render('---\ntitle: Party :tada:\n---\n\n![a :cake: cake](c.png)\n\n@ Mood: :smile:\n');
  assert.match(body, /<h1 class="gm-title">Party 🎉<\/h1>/);
  assert.match(body, /alt="a :cake: cake"><figcaption>a 🍰 cake<\/figcaption>/);
  assert.match(body, /data-value=":smile:"[^>]*>😄<\/span>/);
});

test('a shortcode in a line kept for click-to-edit stays as written', () => {
  const { body } = render('- [ ] a > b :tada:\n\n@ Mood: c > d :smile:\n');
  assert.match(body, /data-off="- \[ \] a &gt; b :tada:"/);
  assert.match(body, /data-text="@ Mood: c &gt; d :smile:"/);
  assert.doesNotMatch(body, /="[^"]*(🎉|😄)/);
});

test("a browser's shortcode shows its mark, named for a screen reader and as a tooltip", () => {
  const { body, css } = render('1) [x] :chrome: at desktop sizes\n2) [ ] :safari: :firefox: :edge: and :Chrome:\n');
  for (const [code, name] of [['chrome', 'Chrome'], ['safari', 'Safari'], ['firefox', 'Firefox'], ['edge', 'Edge']]) {
    assert.match(body, new RegExp(`<span class="emoji-mark emoji-${code}" role="img" aria-label="${name}" title="${name}"></span>`));
    assert.match(css, new RegExp(`\\.emoji-${code} \\{ --mark: url\\("data:image/svg\\+xml,%3Csvg`));
  }
  assert.doesNotMatch(body.replace(/<[^>]*>/g, ''), /:(chrome|safari|firefox|edge):/i, 'none is left as typed in the text');
  assert.match(css, /@media \(forced-colors: active\) \{\s*\.emoji-mark \{ forced-color-adjust: none; background-color: CanvasText; \}/);
});

test("a browser's shortcode in code stays as written", () => {
  const { body } = render('`:chrome:`\n');
  assert.match(body, /<code>:chrome:<\/code>/);
});
