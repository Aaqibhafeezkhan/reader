// browse.mjs, checked without a browser. With --plan it says what it would do,
// a line for each run and each step, and starts nothing, so a test can read
// that. To add one: write the steps a review would, as `steps(t, [...])`, run
// `browse(t, file, stepsFile, '--browser', …, '--plan')`, and match the lines
// it prints, or its exit status for a mistake. What does need a browser, a
// click landing or a shot being taken, isn't tested here (gh-81's review).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONTRIBUTING, scratch } from './setup.mjs';

// The checkout these tests are in: browse.mjs needs one with bin/reader.js.
const REPO = path.resolve(CONTRIBUTING, '..');
const BROWSE = path.join(CONTRIBUTING, 'lib', 'browse.mjs');

// A note to browse, and `list` written as its steps file: { file, stepsFile }.
function steps(t, list) {
  const dir = scratch(t);
  const file = path.join(dir, 'note.md');
  fs.writeFileSync(file, '# A note\n');
  const stepsFile = path.join(dir, 'steps.json');
  fs.writeFileSync(stepsFile, JSON.stringify(list));
  return { file, stepsFile };
}

// browse.mjs run with these arguments: { status, out, lines }.
function browse(file, stepsFile, ...args) {
  const r = spawnSync(process.execPath, [BROWSE, file, '--steps', stepsFile, '--repo', REPO, ...args], { encoding: 'utf8', timeout: 20000 });
  const out = r.stdout + r.stderr;
  return { status: r.status, out, lines: out.trim().split('\n') };
}

test('without a file, its steps, or a checkout of reader, it says how to run it', (t) => {
  const { file, stepsFile } = steps(t, [{ click: '#x' }]);
  for (const args of [[BROWSE, '--steps', stepsFile, '--repo', REPO], [BROWSE, file, '--repo', REPO], [BROWSE, file, '--steps', stepsFile, '--repo', scratch(t)]]) {
    const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^usage: browse\.mjs <file\.md> --steps <steps\.json> --repo <reader checkout>/);
  }
});

test('a browser or a theme it doesn\'t know is refused, naming what it does', (t) => {
  const { file, stepsFile } = steps(t, [{ click: '#x' }]);
  const odd = browse(file, stepsFile, '--browser', 'chrome', '--plan');
  assert.equal(odd.status, 2);
  assert.match(odd.out, /^--browser is one of chromium, firefox, webkit, safari, or all, not chrome$/m);
  const dim = browse(file, stepsFile, '--theme', 'dim', '--plan');
  assert.equal(dim.status, 2);
  assert.match(dim.out, /^--theme is one of light, dark, not dim$/m);
  assert.equal(browse(file, stepsFile, '--zoom', '9', '--plan').status, 2, '--zoom is from 1 to 4');
});

test('one browser is one run, Chromium unless it\'s named', (t) => {
  const { file, stepsFile } = steps(t, [{ click: '#x' }]);
  assert.deepEqual(browse(file, stepsFile, '--plan').lines.filter((l) => /^(run|skip)/.test(l)), ['run   Chromium']);
  assert.deepEqual(browse(file, stepsFile, '--browser', 'webkit', '--theme', 'dark', '--plan').lines.filter((l) => /^(run|skip)/.test(l)), ['run   WebKit, dark']);
});

test('--browser all and --theme light,dark are a run for each browser in each theme', (t) => {
  const { file, stepsFile } = steps(t, [{ click: '#x' }]);
  const { status, lines } = browse(file, stepsFile, '--browser', 'all', '--theme', 'light,dark', '--plan');
  assert.equal(status, 0);
  assert.deepEqual(lines.filter((l) => l.startsWith('run')), [
    'run   Chromium, light', 'run   Chromium, dark',
    'run   Firefox, light', 'run   Firefox, dark',
    'run   WebKit, light', 'run   WebKit, dark',
    'run   Safari Technology Preview, light', 'run   Safari Technology Preview, dark',
  ]);
  // A list names just those.
  assert.deepEqual(browse(file, stepsFile, '--browser', 'firefox,safari', '--plan').lines.filter((l) => l.startsWith('run')), [
    'run   Firefox', 'run   Safari Technology Preview',
  ]);
});

test('--zoom and --forced-colors are Playwright\'s: Safari is skipped among others, and refused alone', (t) => {
  const { file, stepsFile } = steps(t, [{ click: '#x' }]);
  const { status, lines } = browse(file, stepsFile, '--browser', 'chromium,safari', '--forced-colors', '--plan');
  assert.equal(status, 0);
  assert.deepEqual(lines.filter((l) => /^(run|skip)/.test(l)), [
    'run   Chromium',
    'skip  Safari Technology Preview: --zoom and --forced-colors are Playwright\'s, not Safari\'s',
  ]);
  const alone = browse(file, stepsFile, '--browser', 'safari', '--zoom', '2', '--plan');
  assert.equal(alone.status, 2);
  assert.match(alone.out, /^--zoom and --forced-colors are for Playwright's browsers, not safari$/m);
});

test('each step acts in the app, the page\'s frame with "frame": true, or the frame it names', (t) => {
  const { file, stepsFile } = steps(t, [
    { click: '#workBtn' },
    { wait: '.gm-doc', frame: true },
    { click: '.slide', frame: 'stage' },
    { work: true },
  ]);
  const { status, lines } = browse(file, stepsFile, '--plan');
  assert.equal(status, 0);
  assert.deepEqual(lines.filter((l) => l.startsWith('step')), [
    'step  1 click "#workBtn" in the app',
    'step  2 wait ".gm-doc" in #preview',
    'step  3 click ".slide" in #stage',
    'step  4 work in the app',
  ]);
});

test('a step naming no action, or two, stops it before anything starts', (t) => {
  for (const [list, said] of [
    [[{ click: '#x' }, { frame: true }], /^step 2 names no action; each is one of work, click, tap, drag, type, press, wait, until, eval, console, shot, sleep$/m],
    [[{ click: '#x', eval: '1' }], /^step 1 names more than one action, click and eval;/m],
  ]) {
    const { file, stepsFile } = steps(t, list);
    // Not --plan: it's refused before reader or a browser would start.
    const { status, out } = browse(file, stepsFile, '--browser', 'chromium');
    assert.equal(status, 2, out);
    assert.match(out, said);
    assert.doesNotMatch(out, /reader open at/);
  }
});
