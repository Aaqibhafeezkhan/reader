import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outline, flatten, find, slug, extract } from '../static/app/sections.js';

const shape = (entries) => entries.map((e) => (e.children.length ? [e.title, shape(e.children)] : e.title));

const day = `---
title: DevNexus day 1
---

# Keynote: The Future of Java

Notes on the keynote.

---

# Spring Security 7

## Passkeys

They're in.

## Authorization changes

\`\`\`
# not a heading
---
\`\`\`

---

Lunch ideas, written down
- soup
`;

test('parts between --- are entries, named by their first heading or line, with headings under them', () => {
  const { entries, parts, talk } = outline(day);
  assert.equal(talk, false);
  assert.equal(parts.length, 3);
  assert.deepEqual(shape(entries), [
    'Keynote: The Future of Java',
    ['Spring Security 7', ['Passkeys', 'Authorization changes']],
    'Lunch ideas, written down',
  ]);
  const [keynote, security] = entries;
  assert.deepEqual([keynote.line, keynote.end], [3, 8]);
  // A heading runs to the next at its level, and not past its part.
  const [passkeys, authz] = security.children;
  assert.deepEqual([passkeys.line, passkeys.end], [12, 16]);
  assert.equal(authz.end, security.end);
});

test('without ---, the headings are the outline, nested by level', () => {
  const { entries } = outline('# Ideas\n\n## [x] One\n\ntext\n\n### Detail\n\n## **Two**\n\n#### too deep\n');
  assert.deepEqual(shape(entries), [['Ideas', [['One', ['Detail']], 'Two']]]);
  const two = entries[0].children[1];
  assert.equal(two.end, 12);
});

test('in a talk, slides are entries, gathered under a section\'s title slide', () => {
  const talk = [
    '---', 'type: slides', '---',
    '# Opening', '', '## not listed', '<!-- hello -->',
    '---', '# Part one',
    '---', '# Slide A', 'text',
    '---', 'An image slide',
    '---', '# Part two', '<!-- a note -->',
    '---', '## Slide B',
  ].join('\n');
  const { entries, talk: isTalk } = outline(talk);
  assert.equal(isTalk, true);
  assert.deepEqual(shape(entries), ['Opening', ['Part one', ['Slide A', 'An image slide']], ['Part two', ['Slide B']]]);
  assert.deepEqual([entries[1].line, entries[1].end], [8, 14]);
});

test('a talk says so: without `type: slides`, its notes don\'t make one', () => {
  const parts = '# Opening\n\n## listed\n<!-- hello -->\n---\n# Part one\n';
  const { entries, talk } = outline(parts);
  assert.equal(talk, false);
  assert.deepEqual(shape(entries), [['Opening', ['listed']], 'Part one']);
  assert.equal(outline(`---\ntype: workbook\n---\n${parts}`).talk, false);
  assert.equal(outline(`---\ntype: Slides\n---\n${parts}`).talk, true);
});

test('a heading in a note or a code fence is not an entry', () => {
  const { entries } = outline('# One\n<!--\n# hidden\n-->\n```md\n# code\n```\n# Two\n');
  assert.deepEqual(shape(entries), ['One', 'Two']);
});

test('find puts the start of a title first, then a word in it, then letters in order', () => {
  const { entries } = outline('# Authorization\n# Spring Security\n# Security\n# Something Else Close\n');
  assert.deepEqual(find(entries, 'sec').map((e) => e.title), ['Security', 'Spring Security', 'Something Else Close']);
  assert.equal(flatten(entries).length, 4);
});

test('slug makes a file name of a title', () => {
  assert.equal(slug('Spring Security 7!'), 'spring-security-7');
  assert.equal(slug('Café: résumé'), 'cafe-resume');
  assert.equal(slug('***'), 'section');
});

test('extract takes a part out, leaving a link, and copies the front matter retitled', () => {
  const { entries } = outline(day);
  const { text, files } = extract(day, [entries[1]], ['spring-security-7.md']);
  assert.deepEqual(files.map((f) => f.name), ['spring-security-7.md']);
  assert.equal(files[0].text, `---
title: DevNexus day 1 - Spring Security 7
---

# Spring Security 7

## Passkeys

They're in.

## Authorization changes

\`\`\`
# not a heading
---
\`\`\`
`);
  assert.match(text, /\n---\n\n→ \[Spring Security 7\]\(spring-security-7\.md\)\n\n---\n\nLunch ideas/);
  assert.deepEqual(shape(outline(text).entries).length, 3);
});

test('extract takes several at once, each leaving its link', () => {
  const src = '# Ideas\n\n## One\n\nfirst\n\n## Two\n\nsecond\n';
  const [ideas] = outline(src).entries;
  const { text, files } = extract(src, ideas.children, ['one.md', 'two.md']);
  assert.equal(text, '# Ideas\n\n→ [One](one.md)\n\n→ [Two](two.md)\n');
  assert.deepEqual(files, [{ name: 'one.md', text: '## One\n\nfirst\n' }, { name: 'two.md', text: '## Two\n\nsecond\n' }]);
});

test('extract escapes a title\'s brackets and backslashes in its link', () => {
  const src = '# Ideas\n\n## [draft] C:\\\n\ntext\n';
  const [ideas] = outline(src).entries;
  const { text } = extract(src, ideas.children, ['draft.md']);
  assert.equal(text, '# Ideas\n\n→ [\\[draft\\] C:\\\\](draft.md)\n');
});
