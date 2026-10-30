import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { render } from '../src/render.js';
import { schemeLinks } from './scheme.js';

const speaker = (src) => render(src).body.replace(/ data-line="\d+"/g, '');

test('a short link is also the URL of a markdown link, its words for the brackets', () => {
  const body = speaker('[plowshares](scripture:isaiah/2/1-5), [Isaiah 2:1-5](scripture:), [D&C 88:26](scripture-lds:) and [the 404](rfc:9110#section-15.5 "Not Found")\n');
  assert.match(body, /<a href="https:\/\/www\.blueletterbible\.org\/rsv\/isaiah\/2\/1-5">plowshares<\/a>/);
  assert.match(body, /<a href="https:\/\/www\.blueletterbible\.org\/rsv\/isaiah\/2\/1-5">Isaiah 2:1-5<\/a>/);
  assert.match(body, /<a href="https:\/\/www\.churchofjesuschrist\.org\/study\/scriptures\/dc-testament\/dc\/88\?lang=eng&amp;id=p26#p26">D&amp;C 88:26<\/a>/);
  assert.match(body, /<a href="https:\/\/www\.rfc-editor\.org\/rfc\/rfc9110\.html#section-15\.5" title="Not Found">the 404<\/a>/);
});

test('it is the same link as the short one, with what the scheme adds', () => {
  const body = speaker('[Body scan](yt:v/FcWl8WgKP8E) is yt:v/FcWl8WgKP8E[Body scan], and [*look*](search:my+term)\n');
  const links = [...body.matchAll(/<a [^>]*>.*?<\/a>/g)].map(([a]) => a);
  assert.equal(links[0], links[1]);
  assert.equal(links[0], '<a class="social social-yt" href="https://www.youtube.com/watch?v=FcWl8WgKP8E">Body scan<span class="social-site"> on YouTube</span></a>');
  assert.equal(links[2], '<a class="search" href="https://www.google.com/search?q=my+term"><em>look</em></a>');
});

test('![]() with a scheme that has nothing to show is the link', () => {
  const body = speaker('![my channel](yt:jzheaux)\n\n![](rfc:9110)\n');
  assert.match(body, /<p><a class="social social-yt" href="https:\/\/www\.youtube\.com\/@jzheaux">my channel<span class="social-site"> on YouTube<\/span><\/a><\/p>/);
  assert.match(body, /<p><a href="https:\/\/www\.rfc-editor\.org\/rfc\/rfc9110\.html">RFC 9110<\/a><\/p>/);
  assert.doesNotMatch(body, /<img|<figure/);
});

test('a scheme can say what it shows, in the place of the image', () => {
  const md = new MarkdownIt();
  schemeLinks(md, {
    name: 'pic',
    scheme: 'pic',
    path: /\w*/,
    link: (path, label) => (path ? { href: `https://pics.example/${path}`, label: label || path } : null),
    show: (found, alt) => `<span class="pic" data-href="${found.href}">${md.utils.escapeHtml(alt)}</span>`,
  });
  assert.equal(md.renderInline('![a <cat>](pic:cat) [a cat](pic:cat)'),
    '<span class="pic" data-href="https://pics.example/cat">a &lt;cat&gt;</span> <a href="https://pics.example/cat">a cat</a>');
});

test('what a scheme shows is told the render\'s env, and is its alt text to what reads a line\'s words', () => {
  const md = new MarkdownIt();
  const seen = [];
  schemeLinks(md, {
    name: 'pic',
    scheme: 'pic',
    path: /\w*/,
    link: (path, label) => ({ href: `https://pics.example/${path}`, label: label || path }),
    show: (found, alt, env) => {
      seen.push(env);
      return env.exported ? null : '<span class="pic"></span>';
    },
  });
  const tokens = md.parseInline('a ![the cat](pic:cat)', { mine: 1 })[0].children;
  assert.deepEqual(seen, [{ mine: 1 }]);
  assert.deepEqual(tokens.map((t) => [t.type, t.content]), [['text', 'a '], ['scheme_shown', 'the cat']]);
  assert.equal(md.renderInline('![the cat](pic:cat)', { exported: true }), '<a href="https://pics.example/cat">the cat</a>');
});

test('images, unknown schemes and URLs a scheme can\'t read are as they were', () => {
  const body = speaker('![a photo](photo.jpg)\n\n[x](rfc:abc) ![y](nope:z) [z](scripture:) [w](https://example.com)\n');
  assert.match(body, /<figure><img src="photo\.jpg" alt="a photo"><figcaption>a photo<\/figcaption><\/figure>/);
  assert.match(body, /<a href="rfc:abc">x<\/a> <img src="nope:z" alt="y"> <a href="scripture:">z<\/a> <a href="https:\/\/example\.com">w<\/a>/);
});

test('a definition is still read as one, and ![ isn\'t a term', () => {
  const body = speaker('!yt: a site for videos\n\nSee !yt, or ![Body scan](yt:v/FcWl8WgKP8E).\n');
  assert.match(body, /<dt class="def-term">yt<\/dt>/);
  assert.match(body, /<span class="def-use"[^>]*>yt<span class="def-pop"/);
  assert.match(body, /<span class="video" data-video="FcWl8WgKP8E"/);
});
