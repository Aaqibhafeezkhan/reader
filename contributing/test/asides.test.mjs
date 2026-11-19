import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { boxes, open, runOn } from '../lib/asides-open.mjs';
import { run, scratch, settings, tree } from './setup.mjs';

const CLAUDE = { ai: 'Claude' };
const texts = (list) => list.map((a) => a.text);

test('an aside waits until the AI answers under it, or the contributor closes it', (t) => {
  const day = tree(scratch(t), {
    'review.md': [
      'One line.',
      '~# a question',
      '',
      'Two line.',
      '~# answered',
      '~~c here you go',
      '',
      'Three line.',
      '~# closed in the end',
      '~~c an answer',
      '~# [x] thanks',
      '',
      'Four line.',
      '~# asked',
      'Five line.',
      '~c this answers five, not four',
      '',
      '```md',
      '~# a sample in a fence',
      '```',
    ].join('\n'),
  });
  assert.deepEqual(open(day, day, CLAUDE).map((a) => [a.at, a.text]), [
    ['review.md:2', '~# a question'],
    ['review.md:14', '~# asked'],
  ]);
});

test('an answer written ~c, an aside of its own that closing the thread leaves open, waits to be made ~~c', (t) => {
  const day = tree(scratch(t), {
    'review.md': [
      'One line.',
      '~# a question',
      '~c an answer, unthreaded',
      '  carried on',
      '~# [x] thanks',
      '',
      'Two line.',
      '~# asked',
      '~~c answered in the thread',
    ].join('\n'),
  });
  assert.deepEqual(open(day, day, CLAUDE).map((a) => [a.at, a.text]), [
    ['review.md:3', '~c an answer, unthreaded (a reply written ~c: make it ~~c)'],
  ]);
});

test('a thread waits until its last word is the AI\'s reply, ~~c, and again when the contributor replies after it', (t) => {
  const day = tree(scratch(t), {
    'review.md': [
      'One line.',
      '~# a question',
      '~~c an answer',
      '  over two lines',
      '',
      'Two line.',
      '~# a question',
      '~~c an answer',
      '~~# but what about',
      '',
      'Three line.',
      '~# and another',
      '~~c one',
      '~~# then',
      '~~c two',
    ].join('\n'),
  });
  assert.deepEqual(open(day, day, CLAUDE).map((a) => a.at), ['review.md:7']);
});

test('a retro card waits for the AI\'s answer, named as the config names it', (t) => {
  const day = tree(scratch(t), {
    'retro.md': [
      'Good (Ada): the watcher.',
      'A (Codex): Agreed.',
      '',
      'Bad (Ada): too long.',
      '',
      'Good [x] (Ada): closed, so done with.',
      '+1 (Grace)',
      '',
      'Try (Codex): my own card.',
    ].join('\n'),
    // Only a retro's cards are to answer; a try file may just show one.
    'gh-1/try-cards.md': 'Good (Ada): a sample card.\n',
  });
  assert.deepEqual(texts(open(day, day, { ai: 'Codex' })), ['Bad (Ada): too long.']);
  // To Claude, Codex is anyone else: its answer is one more to answer.
  assert.deepEqual(texts(open(day, day, CLAUDE)), ['Good (Ada): the watcher.', 'A (Codex): Agreed.', 'Bad (Ada): too long.', 'Try (Codex): my own card.']);
});

test('what waits on the contributor: boxes, criteria, untried Tries and unpicked choices, asides and their answers allowed between them, but not the Send box', (t) => {
  const day = tree(scratch(t), {
    'review.md': [
      '- [ ] Send to Claude',
      '- [ ] a plain box',
      '- [x] a ticked box',
      '- [x][x][ ] a staged box, not done',
      '- [x][x][x] a staged box, done',
      '',
      '1) [ ] a criterion',
      '2) [x] an accepted one',
      '',
      'Try: something',
      'Try [x]: tried',
      '',
      'Q (Claude): which?',
      '- ( ) this',
      '  ~# hmm',
      '- ( ) that',
      '',
      'Q (Claude): and?',
      '- (x) picked',
      '~# why?',
      '~~c Because,',
      '   on a line of its own.',
      '- ( ) not',
      '',
      '@ Size: ( ) small ( ) large',
      '',
      '```md',
      '- [ ] a sample',
      '```',
    ].join('\n'),
    // Only review.md files hold what's waiting on the contributor.
    'gh-1/try-boxes.md': '- [ ] a box to play with\n',
  });
  assert.deepEqual(boxes(day, day, CLAUDE).map((b) => [b.at, b.text]), [
    ['review.md:2', '- [ ] a plain box'],
    ['review.md:4', '- [x][x][ ] a staged box, not done'],
    ['review.md:7', '1) [ ] a criterion'],
    ['review.md:10', 'Try: something'],
    ['review.md:14', '- ( ) this'],
    ['review.md:25', '@ Size: ( ) small ( ) large'],
  ]);
  assert.deepEqual(texts(boxes(day, day, { ai: 'Codex' })).slice(0, 2), ['- [ ] Send to Claude', '- [ ] a plain box'],
    'the Send box left out is the configured AI\'s');
});

test('a choice\'s own lines under it, a closing comment\'s quote after a blank, keep its question one, picked or waiting once', (t) => {
  const closing = (pick) => [
    'Q (Claude): Does gh-1 still describe what shipped?',
    `- (${pick[0]}) The issue stands`,
    `- (${pick[1]}) The issue stands, with this closing comment:`,
    '',
    '  > Nothing went beyond it.',
    '- ( ) A PR replaces it',
    '- ( ) [@ Something else]',
  ];
  const day = tree(scratch(t), {
    'review.md': [
      ...closing(' x'),
      '',
      ...closing('  '),
    ].join('\n'),
  });
  assert.deepEqual(boxes(day, day, CLAUDE).map((b) => [b.at, b.text]), [
    ['review.md:10', '- ( ) The issue stands'],
  ]);
});

test('asides-open lists both, under the names the config gives, with / between folders', (t) => {
  const dir = scratch(t);
  const day = tree(path.join(dir, 'meetings', '2026-11-22'), {
    'gh-7/review.md': 'Line.\n~# why?\n\n- [ ] a box\n',
  });
  for (const skill of ['review-open', 'review-round']) {
    const { status, out } = run(`${skill}/scripts/asides-open.mjs`, [day], settings(dir, { READER_AI: 'Codex' }));
    assert.equal(status, 0, out);
    assert.equal(out, 'Waiting on Codex: 1\n  gh-7/review.md:2: ~# why?\nWaiting on you: 1\n  gh-7/review.md:4: - [ ] a box\n');
  }
});

test('send-watch wakes on a ticked Send box, with what is waiting in that box\'s item', (t) => {
  const dir = scratch(t);
  tree(path.join(dir, 'meetings'), {
    '2026-11-22/review.md': '- [ ] Send to Claude\n\nIndex line.\n~# about the index\n',
    '2026-11-22/gh-7/review.md': '- [x] Send to Claude\n\nItem line.\n~# about the item\n',
    '2026-11-22/gh-7/try-it.md': 'Try line.\n~# about its try file\n',
    '2026-11-22/gh-8/review.md': '- [ ] Send to Claude\n\nOther line.\n~# about another item\n',
  });
  const { status, out } = run('review-round/scripts/send-watch.mjs', ['50', '--once'], settings(dir));
  assert.equal(status, 0, out);
  assert.equal(out, 'send 2026-11-22/gh-7/review.md:1: 2 waiting\n  2026-11-22/gh-7/review.md:4: ~# about the item\n  2026-11-22/gh-7/try-it.md:2: ~# about its try file\n');
});

test('send-watch on the index\'s box lists the whole day, and watches for the configured AI\'s box', (t) => {
  const dir = scratch(t);
  tree(path.join(dir, 'meetings'), {
    '2026-11-22/review.md': '- [x] Send to Claude\n- [x] Send to Codex\n',
    '2026-11-22/gh-7/review.md': 'Item line.\n~# about the item\n',
  });
  const { out } = run('review-open/scripts/send-watch.mjs', ['50', '--once'], settings(dir, { READER_AI: 'Codex' }));
  assert.equal(out, 'send 2026-11-22/review.md:2: 1 waiting\n  2026-11-22/gh-7/review.md:2: ~# about the item\n');
});

test('send-watch passes over a box left ticked in a day already merged', (t) => {
  const dir = scratch(t);
  tree(path.join(dir, 'meetings'), {
    '2026-11-09/review.md': '- [x] Send to Claude\n\nAll answered.\n\n- [x] Then: push, open the PR, merge it.\n',
    '2026-11-11/gh-199/review.md': '- [x] Send to Claude\n\nItem line.\n~# about the item\n',
  });
  const { status, out } = run('review-round/scripts/send-watch.mjs', ['50', '--once'], settings(dir));
  assert.equal(status, 0, out);
  assert.equal(out, 'send 2026-11-11/gh-199/review.md:1: 1 waiting\n  2026-11-11/gh-199/review.md:4: ~# about the item\n');
});

test('send-watch says so when there are no day folders', (t) => {
  const dir = scratch(t);
  const { status, out } = run('review-round/scripts/send-watch.mjs', ['50', '--once'], settings(dir));
  assert.equal(status, 2);
  assert.match(out, /no day folders at/);
});

test('a line straight after the AI\'s reply, indented past its ~, is listed to check, as it reads as the page\'s text (gh-305)', (t) => {
  const day = tree(scratch(t), {
    'review.md': [
      'One line.',
      '~# a question',
      '~#',
      '~# asked on two paragraphs',
      '~~c An answer,',
      '~~c carried on as it should be,',
      '  and one that isn\'t.',
      '',
      '- [ ] An item',
      '  ~# asked',
      '  ~~c answered',
      '- [ ] The next item',
      '',
      '~c An aside of the AI\'s own',
      'The page, carrying on.',
      '',
      '```md',
      '~~c a sample',
      '  in a fence',
      '```',
    ].join('\n'),
  });
  assert.deepEqual(runOn(day).map((a) => [a.at, a.text]), [
    ['review.md:7', 'and one that isn\'t.'],
  ]);
  assert.deepEqual(open(day, day, CLAUDE), [], 'an aside of three lines, answered once');
});

test('send-watch says every box ticked in the pass that wakes it, not only the first', (t) => {
  const dir = scratch(t);
  tree(path.join(dir, 'meetings'), {
    '2026-11-22/review.md': '- [ ] Send to Claude\n',
    '2026-11-22/gh-7/review.md': '- [x] Send to Claude\n\nItem line.\n~# about seven\n',
    '2026-11-22/gh-8/review.md': '- [x] Send to Claude\n\nItem line.\n~# about eight\n',
  });
  const { out } = run('review-round/scripts/send-watch.mjs', ['50', '--once'], settings(dir));
  assert.match(out, /^send 2026-11-22\/gh-7\/review.md:1: 1 waiting\n.*\nsend 2026-11-22\/gh-8\/review.md:1: 1 waiting\n/);
});

test('send-watch counts a box already ticked when it starts, in a day not merged, though only choices were picked (gh-262\'s)', (t) => {
  const dir = scratch(t);
  tree(path.join(dir, 'meetings'), {
    '2026-11-16/review.md': '- [ ] Send to Claude\n\n- [ ] Then: push, open the PR, merge it.\n',
    '2026-11-16/gh-262/review.md': '- [x] Send to Claude\n\nQ (Claude): Keep both?\n- (x) Yes\n- ( ) No\n',
  });
  const { status, out } = run('review-round/scripts/send-watch.mjs', ['50', '--once'], settings(dir));
  assert.equal(status, 0, out);
  assert.equal(out, 'send 2026-11-16/gh-262/review.md:1: 0 waiting\n');
});
