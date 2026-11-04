import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { applyEdits } from '../../static/edits.js';
import { preview, settle, assertElement, assertNotElement } from '../../test/dom.js';

const SUDOKU = `\`\`\`sudoku
5 3 . | . 7 . | . . .
6 . . | 1 9 5 | . . .
. 9 8 | . . . | . 6 .
8 . . | . 6 . | . . 3
4 . . | 8 . 3 | . . 1
7 . . | . 2 . | . . 6
. 6 . | . . . | 2 8 .
. . . | 4 1 9 | . . 5
. . . | . 8 . | . 7 9
\`\`\`
`;

/** The preview frame showing `markdown`'s puzzle: `press(key)` presses it there. */
function playing(markdown) {
  const p = preview();
  p.show(render(markdown).body);
  const host = p.document.querySelector('.puzzle');
  const press = (key, opts = {}) => {
    const e = new p.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
    (p.document.activeElement ?? host).dispatchEvent(e);
    return e;
  };
  const said = () => p.document.querySelector('html > .vh')?.textContent.trim() ?? '';
  return { ...p, host, press, said };
}

test('a puzzle is an application named by its kind, and its board is named too', () => {
  const { host } = playing(SUDOKU);
  assert.equal(host.getAttribute('role'), 'application');
  assert.equal(host.getAttribute('aria-label'), 'Sudoku');
  const board = host.querySelector('.sudoku-grid');
  assert.equal(board.getAttribute('role'), 'img');
  assert.equal(board.getAttribute('aria-label'), 'Sudoku board');
});

test('a key a puzzle takes says where it left it, and nothing is said while it isn\'t played', () => {
  const { host, press, said } = playing(SUDOKU);
  assert.equal(said(), '');
  host.focus();
  press('ArrowRight');
  assert.equal(said(), 'Row 1, column 4: empty');
  press('6', { code: 'Digit6' });
  assert.equal(said(), 'Row 1, column 4: 6');
  press('7', { code: 'Digit7' });
  assert.equal(said(), 'Row 1, column 4: 7, repeated');
  press('ArrowLeft');
  press('ArrowLeft');
  assert.equal(said(), 'Row 1, column 2: 3, given');
});

/** Puzzles say how they stand after where a key left them: the first part is checked. */
const saysFirst = (said, where) => assert.equal(said().slice(0, where.length), where);

test('train tracks say which square a key left them on, and the track in it', () => {
  const { host, press, said } = playing(`\`\`\`tracks
1 1 3
━ · ·  3
· · ·  1
· · ·  1
A: left 1  B: bottom 3
\`\`\`
`);
  host.focus();
  press('ArrowRight');
  saysFirst(said, 'Row 1, column 2: empty');
  press('ArrowLeft');
  saysFirst(said, 'Row 1, column 1: track right to left, given');
  press('ArrowDown');
  saysFirst(said, 'Row 2, column 1: empty');
});

test('a maze says which ways are open where a key left it', () => {
  // A fork near S: an arrow runs along the corridor only as far as the next turn-off.
  const { host, press, said } = playing(`\`\`\`maze
+--+--+--+
|S       |
+  +  +  +
|       E|
+--+--+--+
\`\`\`
`);
  host.focus();
  press('ArrowRight');
  saysFirst(said, 'Open down, left, right');
});

test('a maze counts one step as a step', () => {
  const { host, press, document } = playing(`\`\`\`maze
+--+--+--+
|S       |
+  +  +  +
|       E|
+--+--+--+
\`\`\`
`);
  host.focus();
  press('ArrowRight');
  assert.match(document.querySelector('.puzzle-bar').textContent, /^1 step · /);
});

test('a word search says which letter a key left it on, and where a word being circled starts', () => {
  const { host, press, said } = playing(`\`\`\`wordsearch
B E L I E V E
H O N E S T Q
A B L E X Y Z
words: ABLE, BELIEVE, HONEST, ZEST
\`\`\`
`);
  host.focus();
  press('ArrowRight');
  saysFirst(said, 'Row 1, column 2: E');
  press('ArrowLeft');
  press('ArrowDown');
  saysFirst(said, 'Row 2, column 1: H');
  press('Enter');
  press('ArrowRight');
  saysFirst(said, 'Row 2, column 2: O, from row 2, column 1');
});

test('a coordinate graph says which point a key left the pencil at', () => {
  const { host, press, said } = playing(`\`\`\`coord
grid: 10 x 8
(1, 1) (5, 1) (5, 4)
(7, 2) (9, 2)
\`\`\`
`);
  host.focus();
  press('ArrowRight');
  saysFirst(said, 'At (1, 0)');
  press('ArrowUp');
  saysFirst(said, 'At (1, 1)');
});

test('Esc hands the keys back but keeps the puzzle in focus, and Enter takes them again', () => {
  const { document, host, press, said } = playing(SUDOKU);
  host.focus();
  assert.ok(press('Escape').defaultPrevented);
  assertElement(document.activeElement, host);
  assert.equal(said(), 'Keys handed back. Enter to play');
  // The page has them now: an arrow isn't the puzzle's, nor another Esc.
  assert.ok(!press('ArrowRight').defaultPrevented);
  assert.ok(!press('Escape').defaultPrevented);
  assert.ok(press('Enter').defaultPrevented);
  assert.ok(press('ArrowRight').defaultPrevented);
  assert.equal(said(), 'Row 1, column 4: empty');
});

/** `markdown` in the preview, played: `press` presses its Start over and says what went up. */
function startOver(markdown, draw = render(markdown).body) {
  const p = preview();
  p.show(draw);
  const sent = () => p.posted.splice(0).filter((m) => m.type === 'edit');
  const made = (edits, text = markdown) => {
    const c = applyEdits(text, edits);
    return c && text.slice(0, c.start) + c.text + text.slice(c.end);
  };
  const press = async () => {
    await settle();
    sent();
    p.document.querySelector('.task-reset').click();
    await settle();
    return sent().map((m) => ({ edits: m.edits, undo: m.undo, text: made(m.edits) }));
  };
  const key = async (host, key, opts = {}) => {
    host.focus();
    host.dispatchEvent(new p.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
    await settle();
  };
  return { ...p, press, sent, made, key, host: () => p.document.querySelector('.puzzle') };
}

const fence = (kind, text) => `\`\`\`${kind}\n${text}\n\`\`\``;

const GIVEN = SUDOKU.replace(/^```sudoku\n|\n```\n$/g, '');
const beside = (rows) => rows.split('\n').map((r) => `${r}    ${r}`);
const SUDOKU_START = [...beside(GIVEN.split('\n').slice(0, 3).join('\n')), '------+-------+------    ------+-------+------',
  ...beside(GIVEN.split('\n').slice(3, 6).join('\n')), '------+-------+------    ------+-------+------',
  ...beside(GIVEN.split('\n').slice(6).join('\n'))].join('\n');
const SUDOKU_SOLVED = SUDOKU_START.split('\n').map((row, r) => {
  const rows = ['5 3 4 | 6 7 8 | 9 1 2', '6 7 2 | 1 9 5 | 3 4 8', '1 9 8 | 3 4 2 | 5 6 7', null, '8 5 9 | 7 6 1 | 4 2 3', '4 2 6 | 8 5 3 | 7 9 1', '7 1 3 | 9 2 4 | 8 5 6', null, '9 6 1 | 5 3 7 | 2 8 4', '2 8 7 | 4 1 9 | 6 3 5', '3 4 5 | 2 8 6 | 1 7 9'];
  return rows[r] ? `${row.slice(0, 21)}    ${rows[r]}` : row;
}).join('\n');
const TRACKS_START = '1 1 3\n━ · ·  3\n· · ·  1\n· · ·  1\nA: left 1  B: bottom 3';
const WORDS_START = 'A B\nC D\nwords: AB';
const COORD_START = 'grid: 4 x 4\n(1, 1) (2, 2)\nplotted: 0';
const MAZE_ART = '+--+--+\n|S   E|\n+--+--+';
const MAZE_START = `${MAZE_ART}\npath:\nnotes:`;

// Each kind: how it starts, played some way, and solved.
const KINDS = [
  { kind: 'sudoku', start: SUDOKU_START, played: `${SUDOKU_START.replace('5 3 . | . 7 . | . . .    5 3 .', '5 3 . | . 7 . | . . .    5 3 4')}\nnotes: r1c4=26`, solved: SUDOKU_SOLVED },
  { kind: 'tracks', start: TRACKS_START, played: TRACKS_START.replace('━ · ·', '━ ─ ┐').replace('· · ·  1', '× · │  1'), solved: '1 1 3\n━ ─ ┐  3\n· · │  1\n· · │  1\nA: left 1  B: bottom 3' },
  { kind: 'wordsearch', start: WORDS_START, played: `${WORDS_START}\nmarks: AC r1c1-r2c1`, solved: `${WORDS_START}\nfound: AB r1c1-r1c2` },
  { kind: 'coord', start: COORD_START, played: COORD_START.replace('plotted: 0', 'plotted: 1'), solved: COORD_START.replace('plotted: 0', 'plotted: 2') },
  { kind: 'maze', start: MAZE_START, played: `${MAZE_ART}\npath: R\nnotes: r1c2`, solved: `${MAZE_ART}\npath: R\nnotes:` },
];

for (const { kind, start, played, solved } of KINDS) {
  test(`Start over puts a ${kind} back to its start, as one edit to undo, and draws it fresh`, async () => {
    const md = `## Try\n\n${fence(kind, played)}\n\nreset:[]\n`;
    const p = startOver(md);
    const [one, ...rest] = await p.press();
    assert.deepEqual(rest, []);
    assert.equal(one.undo, true);
    assert.equal(one.text, `## Try\n\n${fence(kind, start)}\n\nreset:[]\n`);
    assert.equal(p.host().classList.contains('solved'), false);
    assert.deepEqual(await p.press(), [], 'at its start, there\'s no more to do');
  });

  test(`Start over puts a solved ${kind} back to its start, the solved state gone`, async () => {
    const md = `${fence(kind, solved)}\n\nreset:[]\n`;
    const p = startOver(md);
    assert.equal(p.host().classList.contains('solved'), true, 'it starts out solved');
    const [{ text }] = await p.press();
    assert.equal(text, `${fence(kind, start)}\n\nreset:[]\n`);
    assert.equal(p.host().classList.contains('solved'), false);
    assert.doesNotMatch(p.host().querySelector('.puzzle-bar').textContent, /🎉/);
  });

  test(`a ${kind} with no moves in it is left as it is by Start over`, async () => {
    const md = `${fence(kind, start)}\n\nreset:[]\n`;
    assert.deepEqual(await startOver(md).press(), []);
  });

  test(`Start today's puts a ${kind} back to its start too, past its front matter`, () => {
    const md = `---\ntitle: T\n---\n\n${fence(kind, played)}\n`;
    const p = preview();
    p.show(render(md, { lines: true, now: 0 }).body);
    p.posted.length = 0;
    p.send({ type: 'start-over' });
    const [told] = p.posted.filter((m) => m.type === 'started-over');
    assert.equal(told.failed, null);
    const c = applyEdits(md, told.edits);
    assert.equal(md.slice(0, c.start) + c.text + md.slice(c.end), `---\ntitle: T\n---\n\n${fence(kind, start)}\n`);
  });
}

test('a puzzle just as it was written, in shorthand, is left as it is by Start over', async () => {
  for (const [kind, text] of [
    ['sudoku', GIVEN],
    ['tracks', '1 1 3\n━ . .  3\n. . .  1\n. . .  1\nA: left 1  B: bottom 3'],
    ['wordsearch', 'ab\ncd\nwords: AB'],
    ['coord', 'grid: 4 x 4\n(1, 1)  (2, 2)'],
    ['maze', MAZE_ART],
  ]) {
    assert.deepEqual(await startOver(`${fence(kind, text)}\n\nreset:[]\n`).press(), [], kind);
  }
});

test('Start over goes by the moves made since the page was drawn, which it wasn\'t drawn again for', async () => {
  const md = `${SUDOKU}\nreset:[]\n`;
  const p = startOver(md);
  await p.key(p.host(), '4', { code: 'Digit4' });
  await p.key(p.host(), 'ArrowRight');
  await p.key(p.host(), '6', { code: 'Digit6', shiftKey: true });
  const moves = p.sent().flatMap((m) => m.edits);
  const playedText = moves.reduce((text, e) => p.made([e], text), md);
  assert.match(playedText, /\nnotes: r1c4=6\n```/);
  const before = moves.at(-1).after;
  const [{ edits }] = await p.press();
  assert.deepEqual(edits[0].before, before);
  assert.equal(p.made(edits, playedText), `\`\`\`sudoku\n${SUDOKU_START}\n\`\`\`\n\nreset:[]\n`);
});

test('a move after Start over is made on its start, on the lines it now has', async () => {
  const md = `${fence('maze', `${MAZE_ART}\npath: R\nnotes:`)}\n\nreset:[]\n`;
  const p = startOver(md);
  await p.press();
  await p.key(p.host(), 'ArrowRight');
  const [edit] = p.sent().flatMap((m) => m.edits);
  assert.deepEqual([edit.from, edit.to], [1, 6]);
  assert.deepEqual(edit.before, MAZE_START.split('\n'));
  assert.deepEqual(edit.after, `${MAZE_ART}\npath: R\nnotes:`.split('\n'));
});

test('undone, Start over\'s moves are there again, as the page drawn from the text shows', async () => {
  const played = `${fence('maze', `${MAZE_ART}\npath: R\nnotes:`)}\n\nreset:[]\n`;
  const p = startOver(played);
  await p.press();
  assert.equal(p.host().querySelector('.way, .head'), null);
  p.show(render(played).body);
  assert.ok(p.host().querySelector('.way'));
  assert.equal(p.host().classList.contains('solved'), true);
});

test('nothing of how a puzzle was being played is left after Start over', async () => {
  const words = startOver(`${fence('wordsearch', 'A B\nC D\nwords: CD')}\n\nreset:[]\n`);
  const ws = words.host();
  await words.key(ws, 'ArrowRight');
  await words.key(ws, 'Enter');
  await words.key(ws, 'ArrowDown');
  await words.key(ws, '?');
  assert.ok(ws.querySelector('.pick'), 'a word half circled');
  assert.equal(await words.press().then((r) => r.length), 0, 'and no moves to take out');
  const again = words.host();
  assertNotElement(again, ws);
  assert.equal(again.querySelector('.pick'), null);
  assert.equal(again.querySelector('.cursor').getAttribute('x'), '0.06');
  assert.equal(again.querySelector('.cursor').getAttribute('y'), '0.06');
  assert.equal(again.querySelector('.puzzle-help').hidden, true);

  const pencil = startOver(`${SUDOKU}\nreset:[]\n`);
  await pencil.key(pencil.host(), 'n');
  await pencil.key(pencil.host(), 'ArrowDown');
  assert.equal(pencil.host().classList.contains('pencil'), true);
  await pencil.press();
  assert.equal(pencil.host().classList.contains('pencil'), false);
  assert.equal(pencil.document.querySelector('.sudoku-grid .cursor').dataset.i, '2', 'on its first empty square');

  const coord = startOver(`${fence('coord', COORD_START)}\n\nreset:[]\n`);
  await coord.key(coord.host(), 'Enter');
  assert.match(coord.document.querySelector('.puzzle-bar').textContent, /Not quite/);
  assert.ok(coord.host().querySelector('.miss'));
  await coord.press();
  assert.equal(coord.host().querySelector('.miss'), null);
  assert.doesNotMatch(coord.document.querySelector('.puzzle-bar').textContent, /Not quite/);
});

test('a puzzle being played keeps the keyboard through starting over', async () => {
  const p = startOver(`${SUDOKU}\nreset:[]\n`);
  p.host().focus();
  p.window.Preview.startOver();
  assertElement(p.document.activeElement, p.host());
  assert.equal(p.host().getAttribute('role'), 'application');
});

test('Start over clears a puzzle and the fields and boxes of its section, as one edit to undo', async () => {
  const md = ['## Try', '', '@ Name: Sam', '', fence('coord', COORD_START.replace('plotted: 0', 'plotted: 2')), '', '- [x] Done', '', 'reset:[]', ''].join('\n');
  const [one, ...rest] = await startOver(md).press();
  assert.deepEqual(rest, [], 'one edit');
  assert.equal(one.undo, true);
  assert.equal(one.edits.length, 3);
  assert.equal(one.text, ['## Try', '', '@ Name:', '', fence('coord', COORD_START), '', '- [ ] Done', '', 'reset:[]', ''].join('\n'));
});

test('Start over keeps to its section: the next heading and the `---` either side of it stop it', async () => {
  const puzzle = (n) => fence('coord', `grid: 4 x 4\n(1, 1) (2, 2)\nplotted: ${n}`);
  const md = (a, b, c, d) => ['# Top', '', puzzle(a), '', '---', '', '# Page', '', puzzle(b), '', 'reset:[]', '', '## Under', '', puzzle(c), '', '---', '', puzzle(d), ''].join('\n');
  const [{ text }] = await startOver(md(1, 1, 1, 1)).press();
  assert.equal(text, md(1, 0, 0, 1));

  const heading = (a, b) => ['## One', '', puzzle(a), '', 'reset:[]', '', '## Two', '', puzzle(b), ''].join('\n');
  const [{ text: first }] = await startOver(heading(1, 1)).press();
  assert.equal(first, heading(0, 1));
});

test('Start over writes a puzzle in a quote or a list with what its lines start with', async () => {
  const quoted = (n) => `> \`\`\`coord\n> grid: 4 x 4\n> (1, 1) (2, 2)\n> plotted: ${n}\n> \`\`\``;
  const [{ text }] = await startOver(`${quoted(2)}\n\nreset:[]\n`).press();
  assert.equal(text, `${quoted(0)}\n\nreset:[]\n`);
  const listed = (n) => `- item\n\n  \`\`\`coord\n  grid: 4 x 4\n  (1, 1) (2, 2)\n  plotted: ${n}\n  \`\`\``;
  const [{ text: inList }] = await startOver(`${listed(1)}\n\nreset:[]\n`).press();
  assert.equal(inList, `${listed(0)}\n\nreset:[]\n`);
});

test('Start over takes the moves out of a puzzle\'s fence, and leaves its board file alone', async () => {
  const read = () => MAZE_ART;
  const md = (own) => `\`\`\`maze one.maze\n${own}\`\`\`\n\nreset:[]\n`;
  const draw = (own) => render(md(own), { file: 'doc.md', read }).body;
  const [{ edits, text }, ...rest] = await startOver(md('path: R\nnotes: r1c2\n'), draw('path: R\nnotes: r1c2\n')).press();
  assert.deepEqual(rest, []);
  assert.deepEqual(edits.map((e) => [e.from, e.to]), [[1, 3]]);
  assert.equal(text, md('path:\nnotes:\n'));
  assert.deepEqual(await startOver(md(''), draw('')).press(), [], 'nothing played');
  assert.deepEqual(await startOver(md('path:\nnotes:\n'), draw('path:\nnotes:\n')).press(), [], 'nor is there here');
});

test('Start over leaves a board file with moves in it, which can\'t be written to, and a board it can\'t read', async () => {
  const read = () => `${MAZE_ART}\npath: R`;
  const md = '```maze one.maze\n```\n\n```maze gone.maze\n```\n\nreset:[]\n';
  const body = render(md, { file: 'doc.md', read: (f) => (f === 'one.maze' ? read() : (() => { throw new Error('no such file'); })()) }).body;
  assert.deepEqual(await startOver(md, body).press(), []);
});

test('Start over leaves a puzzle it can\'t write to, or read, as it is', async () => {
  // Its lines start differently, so it can't be played; nor can this one be read.
  const md = '> ```coord\n> grid: 4 x 4\n>\n> (1, 1)\n> plotted: 1\n> ```\n\n```sudoku\nnot one\n```\n\nreset:[]\n';
  assert.deepEqual(await startOver(md).press(), []);
});

test('on a workbook\'s page, Start over is for that page\'s puzzles, by their lines in the file', async () => {
  const md = `${fence('coord', COORD_START)}\n\n---\n\n${fence('coord', COORD_START.replace('plotted: 0', 'plotted: 1'))}\n\nreset:[]\n`;
  const page = render(`${fence('coord', COORD_START.replace('plotted: 0', 'plotted: 1'))}\n\nreset:[]\n`, { line: md.split('\n').indexOf('---') + 2 });
  const [{ text }] = await startOver(md, page.body).press();
  assert.equal(text, `${fence('coord', COORD_START)}\n\n---\n\n${fence('coord', COORD_START)}\n\nreset:[]\n`);
});
