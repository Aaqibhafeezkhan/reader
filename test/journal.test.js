import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pages, isDeck } from '../src/slides.js';
import { outline } from '../static/app/sections.js';
import { render } from '../src/render.js';
import { app, globals, page } from './dom.js';

// What Work counts done is read in the app, from the pages it's sent.
globals(app());
const { mark, tally } = await import('../static/app/done.js');

// The daily journal 0.0.4 is to make possible, written ahead of the syntax it
// promises (see its comment). What reader can't read yet shows as written; as
// each feature lands, this should say what it now draws.
const JOURNAL = readFileSync(new URL('./fixtures/journal.md', import.meta.url), 'utf8');

// It's open until 4:00 the next morning, by the clock of whoever has it:
// the evening it's filled in, and the moment it's a record.
const EVENING = new Date(2026, 9, 27, 21, 0).getTime();
const CLOSING = new Date(2026, 9, 28, 4, 0).getTime();
const drawn = (now) => pages(JOURNAL, { file: 'journal.md', now }).pages.map((p) => p.body);

test('the daily journal is a workbook of its twelve pages, in order', () => {
  const out = pages(JOURNAL, { file: 'journal.md' });
  const titles = out.pages.map((p) => p.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').trim());
  assert.deepEqual(titles, [
    'Today’s Celebrations', 'Daily Exercise', 'Meditation', 'Work To-Do', 'Gratitude Practice', 'Body Check-In',
    'Social Connection', 'Personal To-Do', 'Learning &amp; Reading', 'Body Scan &amp; Stretch', 'Singing Warmup', 'How are you feeling?',
  ]);
});

test('it says it\'s a workbook: worked a page at a time, its pages the outline\'s entries, not a talk\'s slides', () => {
  // And it opens in Work (type-app.test.js).
  assert.equal(isDeck(JOURNAL), true);
  const { talk, entries } = outline(JOURNAL);
  assert.equal(talk, false);
  assert.equal(entries.length, 12);
});

test('its fields say what goes in them: a hint, faint in the blank, not part of its label', () => {
  const all = drawn(EVENING).join('\n');
  const hinted = [...all.matchAll(/<span class="field-label[^"]*">([^<]*)<\/span><span class="field-value"[^>]* data-hint="([^"]*)"/g)]
    .map(([, label, hint]) => [label, hint]);
  assert.equal(hinted.length, 13);
  assert.deepEqual(hinted.slice(0, 2), [['What did you do?', 'Only for C'], ['1', 'I\'m grateful for…']]);
  assert.ok(hinted.some(([label, hint]) => label === 'The Way of Kings' && hint === 'What would you tell someone to make them pick it up?'));
  assert.doesNotMatch(all, /class="field-label">[^<]*\{/, 'no label shows its braces');
});

test('its to-dos count how many are reviewed, and each book how far it\'s read', () => {
  const out = drawn(EVENING);
  const bars = (body) => [...body.matchAll(/<progress value="(\d+)" max="(\d+)" aria-label="([^"]*)"><\/progress> <span class="progress-count">([^<]*)<\/span>/g)]
    .map(([, value, max, name, count]) => [value, max, name, count]);
  // Its own box, on the heading, says the page is done, and isn't counted.
  assert.deepEqual(bars(out[3]), [['0', '10', 'reviewed', '0 of 10']]);
  assert.deepEqual(bars(out[8]), [['326', '1007', 'pages', '326 of 1007'], ['22', '314', 'pages', '22 of 314'], ['241', '436', 'pages', '241 of 436']]);
  // And as a record, the same.
  assert.deepEqual(bars(drawn(CLOSING)[3]), [['0', '10', 'reviewed', '0 of 10']]);
});

test('each book on the reading page is a row: its cover, small, beside its title and how far it\'s read (#45)', () => {
  const reading = drawn(EVENING)[8];
  const rows = [...reading.matchAll(/<div class="row"[^>]*>\n<div class="row-lead"[^>]*><img src="[^"]+" alt="" style="width: 56px"><\/div>\n<div class="row-rest"[^>]*>\n<p[^>]*><strong><a href="[^"]+">([^<]+)<\/a><\/strong> · ([^<]+)<\/p>\n(?:<p[^>]*><span class="progress"><progress value="(\d+)")?/g)]
    .map(([, title, author, read]) => [title, author, read]);
  assert.deepEqual(rows, [
    ['Moral Ambition', 'Rutger Bregman', undefined],
    ['The Way of Kings', 'Brandon Sanderson', '326'],
    ['Smart but Scattered', 'Peg Dawson', '22'],
    ['My Friends', 'Fredrik Backman', '241'],
    ['The Stranger', 'Albert Camus, Matthew Ward', undefined],
  ]);
  assert.doesNotMatch(reading, /<figure|::: row|\*\*/, 'no cover is a figure, and nothing shows as typed');
});

test('its singing warmup names each note in a button that plays it, the evening it\'s filled in and as a record', () => {
  for (const now of [EVENING, CLOSING]) {
    const warmup = drawn(now)[10];
    const notes = [...warmup.matchAll(/<button type="button" class="pitch" data-hz="([^"]*)" aria-label="Play (\w+)">\2<\/button>/g)].map((m) => m[2]);
    assert.deepEqual(notes, ['C4', 'G3', 'G4', 'C5', 'G4', 'C5', 'E4', 'A4', 'G4', 'B4', 'A4', 'C5', 'A4', 'B4', 'C5', 'B4', 'C5', 'C5']);
    assert.doesNotMatch(warmup, /pitch:/, 'none is left as typed');
  }
});

test('its singing warmup has a timer for each step, to start, the evening it\'s filled in and as a record', () => {
  for (const now of [EVENING, CLOSING]) {
    const warmup = drawn(now)[10];
    const timers = [...warmup.matchAll(/<span class="timer" role="group" aria-label="Timer, ([^"]*)" data-seconds="(\d+)"[^>]*><span class="timer-time" role="timer">([^<]*)<\/span><button type="button" class="timer-go">Start<\/button>/g)]
      .map((m) => m.slice(1));
    assert.deepEqual(timers, [['2 minutes', '120', '2:00'], ['3 minutes', '180', '3:00'], ['4 minutes', '240', '4:00'], ['5 minutes', '300', '5:00']]);
    assert.doesNotMatch(warmup, /timer:/, 'none is left as typed');
  }
});

test('the evening it\'s filled in, each page says until when, and its boxes, choices and blanks can be worked', () => {
  const out = drawn(EVENING);
  for (const body of out) {
    assert.match(body, /<p class="open-until" data-until="2026-10-28 04:00"[^>]*>Editable Until 4:00 on 28 October 2026<span class="open-until-away"><\/span><\/p>/);
  }
  const all = out.join('\n');
  assert.doesNotMatch(all, /<input[^>]* disabled/);
  assert.equal(all.match(/role="textbox"/g).length, 13);
  // A minute before, still.
  assert.doesNotMatch(drawn(CLOSING - 60 * 1000).join('\n'), /No Longer Editable|disabled/);
});

test('from 4:00 the next morning it\'s a record: each page says so, every box and choice is shut, and no blank asks for more', () => {
  const out = drawn(CLOSING);
  for (const body of out) {
    assert.match(body, /<p class="open-until open-until-closed" role="note" tabindex="0" aria-label="No Longer Editable. Closed at 4:00 on 28 October 2026"[^>]*>No Longer Editable<\/p>/);
  }
  const all = out.join('\n');
  const inputs = all.match(/<input[^>]*>/g);
  assert.equal(inputs.length, 64);
  assert.ok(inputs.every((i) => / disabled/.test(i)), 'every box and choice is shut');
  assert.doesNotMatch(all, /role="textbox"|data-hint|aria-placeholder|tabindex="0" role="button"|task-reset/, 'nothing to type in, pick or press');
  assert.equal(all.match(/<span class="field-blank">blank<\/span>/g).length, 13, 'its blanks left empty are said to be blank, with no hint');
});

test('Work counts its pages done, by a heading\'s box or a choice made, and still does once it\'s a record', () => {
  const count = (src, now) => tally(pages(src, { file: 'journal.md', now }).pages.map((p, i) => mark(p.body, i)));
  // Every page has something to do, and none of it's done yet.
  assert.deepEqual(count(JOURNAL, EVENING), { done: 0, of: 12 });
  const filled = JOURNAL.replace("# [ ] Today's Celebrations", "# [x] Today's Celebrations")
    .replace('- ( ) **B** · Running', '- (x) **B** · Running');
  assert.deepEqual(count(filled, EVENING), { done: 2, of: 12 });
  assert.deepEqual(count(filled, CLOSING), { done: 2, of: 12 });
});

test('its videos are on the page, each a card to play it from, its choice named for it (#31)', () => {
  for (const out of [drawn(EVENING), drawn(CLOSING)]) {
    const videos = (body) => [...body.matchAll(/<span class="video" data-video="([\w-]+)"[^>]*><button type="button" class="video-screen video-play" aria-label="Play ([^"]+)">/g)].map(([, id, name]) => [id, name]);
    assert.equal(videos(out[2]).length, 7);
    assert.deepEqual(videos(out[2])[0], ['-Fy2GxrurO4', 'Kirtan · Kirtan Kriya Meditation · Dr Ameeta Gajjar']);
    assert.equal(videos(out[9]).length, 4);
    assert.match(out[2], /aria-label="Kirtan · Kirtan Kriya Meditation · Dr Ameeta Gajjar"[^>]*> <span class="video" data-video="-Fy2GxrurO4"/);
    assert.doesNotMatch(out.join('\n'), /<img src="yt:|youtube-nocookie/);
  }
});

test('its choices are laid out in grids, two or three across, each still one group to pick from (#44)', () => {
  for (const out of [drawn(EVENING), drawn(CLOSING)]) {
    const grids = out.map((body) => [...body.matchAll(/<div class="grid grid-items cards" style="--grid: (\d)"[^>]*>\n<ul[^>]*>([\s\S]*?)<\/ul>\n<\/div>/g)]
      .map(([, n, items]) => [Number(n), items.match(/<li/g).length, new Set(items.match(/name="choice-\d+"/g)).size]));
    // Across, items, and groups: exercise, meditation, body scan, feelings.
    assert.deepEqual(grids[1], [[2, 4, 1]]);
    assert.deepEqual(grids[2], [[3, 7, 1]]);
    assert.deepEqual(grids[9], [[2, 4, 1]]);
    assert.deepEqual(grids[11], [[2, 4, 1]]);
    assert.equal(grids.flat().length, 4);
    assert.doesNotMatch(out.join('\n'), /'grid'|'\d'|'cards'/, 'neither grid, its count nor its look is a font');
  }
});

test('its choices are cards: the box over each, the chosen one checked, and shut once it\'s a record (#49)', () => {
  const cards = (body) => [...body.matchAll(/<div class="grid grid-items cards"[^>]*>\n<ul[^>]*>([\s\S]*?)<\/ul>\n<\/div>/g)].map((m) => m[1]);
  const evening = drawn(EVENING);
  // Exercise, meditation, body scan, feelings: every item is a card with its box first in it, to lie over it.
  assert.deepEqual([1, 2, 9, 11].map((n) => cards(evening[n]).length), [1, 1, 1, 1]);
  for (const n of [1, 2, 9, 11]) {
    const items = cards(evening[n])[0].split('<li').slice(1);
    assert.ok(items.every((item) => /^ class="(?:bg )?task"[^>]*><input type="radio" class="choice-box" name="choice-\d+"/.test(item)), `page ${n + 1}`);
  }
  // A video's play button is its own, inside the card; a feeling's closest word is a choice of its own inside it.
  assert.match(cards(evening[2])[0], /<input type="radio" class="choice-box"[^>]*> <span class="video"[^>]*><button type="button" class="video-screen video-play"/);
  assert.equal(cards(evening[11])[0].match(/<span class="field"[^>]*role="radiogroup"/g).length, 4);
  // Picked, its card is the chosen one, and as a record still is, but can't be changed.
  const filled = JOURNAL.replace('- ( ) **B** · Running', '- (x) **B** · Running');
  const record = pages(filled, { file: 'journal.md', now: CLOSING }).pages[1].body;
  assert.match(cards(record)[0], /<input type="radio" class="choice-box"[^>]*checked disabled> <strong>B<\/strong> · Running/);
  assert.doesNotMatch(cards(drawn(EVENING)[1])[0], /disabled/);
});

test('how it\'s feeling is a choice of four, each with its own closest word to pick', () => {
  const feeling = drawn(EVENING)[11];
  const items = feeling.split('<li').slice(1);
  assert.equal(items.length, 4);
  const words = items.map((item) => [...item.matchAll(/<label class="field-choice"><input type="radio" class="choice-box" name="field-\d+"[^>]*> (\w+)<\/label>/g)].map((m) => m[1]));
  assert.deepEqual(words.map((w) => w.length), [6, 6, 6, 6]);
  assert.deepEqual(words[3], ['Calm', 'Content', 'Peaceful', 'Relaxed', 'Grateful', 'Serene']);
  assert.ok(items.every((item) => /<span class="field-label" id="field-\d+">Closest word<\/span>/.test(item)));
  assert.doesNotMatch(feeling.replace(/<[^>]*>/g, ''), /@ Closest word/, 'none is left as typed');
});

test('each feeling is a card tinted its own background, its choice and closest word in it, the evening it\'s filled in and as a record (#47)', () => {
  for (const now of [EVENING, CLOSING]) {
    const feeling = drawn(now)[11];
    assert.match(feeling, /<div class="grid grid-items cards" style="--grid: 2"/);
    const items = [...feeling.matchAll(/<li class="bg task" style="--bg: (\w+)"[^>]*><input type="radio" class="choice-box"[^>]*> <strong>([^<]+)<\/strong>\n<span class="field"/g)]
      .map(([, bg, name]) => [name, bg]);
    assert.deepEqual(items, [
      ['High energy · Unpleasant', 'mistyrose'],
      ['High energy · Pleasant', 'lemonchiffon'],
      ['Low energy · Unpleasant', 'lavender'],
      ['Low energy · Pleasant', 'honeydew'],
    ]);
    assert.doesNotMatch(feeling.replace(/<[^>]*>/g, ''), /\{|bg-/, 'no braces are left as typed');
  }
});

test('a mood\'s card keeps its own box, whichever of cards and styles is read first', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const styles = read('../features/styles/styles.css');
  const cards = read('../features/cards/cards.css');
  // a mood to pick, and a card with nothing to pick
  const html = render('::: grid 2 cards\n- ( ) **Low energy · Pleasant** {bg-honeydew}\n- Breathe {bg-lavender}\n:::\n').body;
  for (const css of [styles + cards, cards + styles]) {
    const window = page(`<style>${css}</style>${html}`);
    for (const item of window.document.querySelectorAll('.cards li.bg')) {
      const box = window.getComputedStyle(item);
      assert.deepEqual([box.padding, box.margin, box.borderRadius], ['11.2px 14.4px', '0px', '8px']);
    }
    window.close();
  }
});
