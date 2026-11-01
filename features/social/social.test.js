import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { socialLink } from './index.js';

test('each site has its address, and its way of writing a name', () => {
  assert.deepEqual(socialLink('linkedin', 'jzheaux', ''), { href: 'https://www.linkedin.com/in/jzheaux', label: 'linkedin.com/in/jzheaux' });
  assert.deepEqual(socialLink('linkedin', 'company/vmware', ''), { href: 'https://www.linkedin.com/company/vmware', label: 'linkedin.com/company/vmware' });
  assert.deepEqual(socialLink('bluesky', 'jzheaux', ''), { href: 'https://bsky.app/profile/jzheaux.bsky.social', label: '@jzheaux.bsky.social', site: 'Bluesky' });
  assert.deepEqual(socialLink('bluesky', '@jzheaux.dev', ''), { href: 'https://bsky.app/profile/jzheaux.dev', label: '@jzheaux.dev', site: 'Bluesky' });
  assert.deepEqual(socialLink('gh', 'jzheaux', ''), { href: 'https://github.com/jzheaux', label: 'github.com/jzheaux' });
  assert.deepEqual(socialLink('fb', 'jzheaux', ''), { href: 'https://www.facebook.com/jzheaux', label: 'facebook.com/jzheaux' });
  assert.deepEqual(socialLink('insta', 'jzheaux', ''), { href: 'https://www.instagram.com/jzheaux', label: '@jzheaux', site: 'Instagram' });
  assert.deepEqual(socialLink('yt', '@jzheaux', ''), { href: 'https://www.youtube.com/@jzheaux', label: '@jzheaux', site: 'YouTube' });
  assert.deepEqual(socialLink('yt', 'v/FcWl8WgKP8E', ''), { href: 'https://www.youtube.com/watch?v=FcWl8WgKP8E', label: 'youtu.be/FcWl8WgKP8E', site: 'YouTube' });
  assert.equal(socialLink('yt', 'jzheaux/videos', ''), null, 'a video has a path of its own');
  assert.deepEqual(socialLink('gh', 'jzheaux', ' my GitHub '), { href: 'https://github.com/jzheaux', label: 'my GitHub' });
  assert.equal(socialLink('gh', '', ''), null);
});

test('a GitHub issue or commit is written as GitHub writes it', () => {
  assert.deepEqual(socialLink('gh', 'jzheaux/reader#25', ''), { href: 'https://github.com/jzheaux/reader/issues/25', label: 'jzheaux/reader#25', site: 'GitHub' });
  assert.deepEqual(socialLink('gh', 'jzheaux/reader@f61f000a1b2c', ''), { href: 'https://github.com/jzheaux/reader/commit/f61f000a1b2c', label: 'jzheaux/reader@f61f000', site: 'GitHub' });
  assert.deepEqual(socialLink('gh', 'jzheaux/reader#25', 'the ticket'), { href: 'https://github.com/jzheaux/reader/issues/25', label: 'the ticket', site: 'GitHub' });
  assert.equal(socialLink('gh', 'jzheaux#25', ''), null, 'an issue is in a repository');
  assert.equal(socialLink('gh', 'jzheaux/reader#x', ''), null);
  assert.equal(socialLink('gh', 'jzheaux/reader@nothex', ''), null);
  const { body } = render('- [ ] gh:jzheaux/reader#25[] and gh:jzheaux/reader@f61f000[]\n');
  assert.match(body, /<a class="social social-gh" href="https:\/\/github\.com\/jzheaux\/reader\/issues\/25">jzheaux\/reader#25<span class="social-site vh"> on GitHub<\/span><\/a>/);
  assert.match(body, /<a class="social social-gh" href="https:\/\/github\.com\/jzheaux\/reader\/commit\/f61f000">jzheaux\/reader@f61f000<span class="social-site vh"> on GitHub<\/span><\/a>/);
});

test('a profile is a link marked with its site', () => {
  const { body } = render('Find me: linkedin:jzheaux[] and gh:jzheaux[*here*], not `yt:x[]`, sigh:x[] or gh:[]\n');
  assert.match(body, /<a class="social social-linkedin" href="https:\/\/www\.linkedin\.com\/in\/jzheaux">linkedin\.com\/in\/jzheaux<\/a>/);
  assert.match(body, /<a class="social social-gh" href="https:\/\/github\.com\/jzheaux"><em>here<\/em><span class="social-site vh"> on GitHub<\/span><\/a>/);
  assert.match(body, /<code>yt:x\[\]<\/code>, sigh:x\[\] or gh:\[\]/);
});

test('a link says its site, for whoever can\'t see the mark', () => {
  const { body, css } = render('insta:jzheaux[] yt:jzheaux[] bluesky:jzheaux[] linkedin:jzheaux[] fb:jzheaux[] gh:jzheaux[my GitHub]\n');
  const names = [...body.matchAll(/<a [^>]*>(.*?)<\/a>/g)].map(([, inner]) => inner.replace(/<[^>]*>/g, ''));
  assert.deepEqual(names, [
    '@jzheaux on Instagram',
    '@jzheaux on YouTube',
    '@jzheaux.bsky.social on Bluesky',
    'linkedin.com/in/jzheaux',
    'facebook.com/jzheaux',
    'my GitHub',
  ]);
  assert.equal(new Set(names).size, names.length, 'no two read the same');
  assert.match(body, /<span class="social-site vh"> on Instagram<\/span>/, 'and the site is read, not shown');
  assert.match(css, /\.vh \{[^}]*clip-path: inset\(50%\)/);
});

test('every site\'s mark is in the stylesheet', () => {
  const { css } = render('x\n');
  for (const scheme of ['linkedin', 'bluesky', 'gh', 'fb', 'insta', 'yt']) {
    assert.match(css, new RegExp(`a\\.social-${scheme}::before \\{ --mark: url\\("data:image/svg\\+xml,%3Csvg viewBox=%220 0 24 24%22`));
  }
  assert.match(css, /a\.social-gh::before \{ --mark: url\([^)]*\); \}/, 'GitHub\'s is the text\'s own color');
});
