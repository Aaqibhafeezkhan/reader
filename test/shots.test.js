import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readArgs, shotName, shotsOf, contextOptions } from '../scripts/shots.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = path.join(ROOT, 'scripts/shots.js');

const names = (...argv) => {
  const args = readArgs(argv);
  return shotsOf(args).map(shotName);
};

test('every browser, size and theme is shot unless a subset is asked for', () => {
  const all = names('test/fixtures/journal.md');
  assert.equal(all.length, 3 * 2 * 4);
  assert.ok(all.includes('journal.chromium.light.png'));
  assert.ok(all.includes('journal.webkit.phone.dark.png'));
  assert.ok(all.includes('journal.firefox.forced.png'));
  assert.ok(all.includes('journal.firefox.phone.contrast.png'));
});

test('a subset is chosen by browser, size and theme, comma-separated or repeated', () => {
  assert.deepEqual(names('a.md', '--browser', 'webkit', '--size', 'phone', '--theme', 'dark'), ['a.webkit.phone.dark.png']);
  assert.deepEqual(
    names('a.md', '--browser', 'chromium', '--size', '900,360', '--theme', 'light', '--theme', 'dark'),
    ['a.chromium.900.light.png', 'a.chromium.900.dark.png', 'a.chromium.360.light.png', 'a.chromium.360.dark.png'],
  );
});

test('a page and a part of one are in the name, only when there are such', () => {
  const shot = { file: 'a.md', browser: 'webkit', size: 'phone', theme: 'dark' };
  assert.equal(shotName({ ...shot, page: 3 }), 'a.webkit.phone.dark.page3.png');
  assert.equal(shotName({ ...shot, page: 3, part: 2 }), 'a.webkit.phone.dark.page3.part2.png');
  assert.equal(shotName({ ...shot, part: 2 }), 'a.webkit.phone.dark.part2.png');
});

test('what it can\'t do is refused by name', () => {
  assert.throws(() => readArgs([]), /which one file/);
  assert.throws(() => readArgs(['a.md', 'b.md']), /which one file/);
  assert.throws(() => readArgs(['a.md', '--browser', 'safari']), /no such name as safari/);
  assert.throws(() => readArgs(['a.md', '--theme', 'sepia']), /no such name as sepia/);
  assert.throws(() => readArgs(['a.md', '--size', 'big']), /no such size as big/);
  assert.throws(() => readArgs(['a.md', '--page', 'first']), /isn't a page number/);
  assert.throws(() => readArgs(['a.md', '--nope']), /nope/);
});

test('--page is a number, all, or left to the first', () => {
  assert.equal(readArgs(['a.md', '--page', '3']).page, 3);
  assert.equal(readArgs(['a.md', '--page', 'all']).page, 'all');
  assert.equal(readArgs(['a.md']).page, undefined);
});

test('a size is a desktop or a phone, with the phone\'s touch, and a width overrides its own', () => {
  const devices = {
    'Pixel 7': { viewport: { width: 412, height: 839 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625, userAgent: 'pixel' },
    'iPhone 14': { viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, userAgent: 'iphone' },
  };
  const of = (browser, size, theme = 'light') => contextOptions({ browser, size, theme }, devices);

  assert.equal(of('webkit', 'desktop').hasTouch, undefined);
  assert.equal(of('webkit', 'desktop').viewport.width, 1280);
  assert.equal(of('webkit', '900').viewport.width, 900);
  assert.equal(of('webkit', '900').hasTouch, undefined);

  assert.equal(of('webkit', 'phone').userAgent, 'iphone');
  assert.equal(of('chromium', 'phone').userAgent, 'pixel');
  assert.equal(of('webkit', 'phone').viewport.width, 390);
  assert.equal(of('webkit', '360').viewport.width, 360);
  assert.equal(of('webkit', '360').viewport.height, 664);
  assert.equal(of('webkit', '360').hasTouch, true);
  assert.equal(of('webkit', '360').isMobile, true);
});

test('each theme asks the browser for its own emulated media', () => {
  const of = (theme) => contextOptions({ browser: 'chromium', size: 'desktop', theme }, {});
  assert.equal(of('light').colorScheme, 'light');
  assert.equal(of('dark').colorScheme, 'dark');
  assert.equal(of('contrast').contrast, 'more');
  assert.equal(of('forced').forcedColors, 'active');
});

test('without a browser installed it says how to install it, and saves nothing', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-shots-test-'));
  const run = spawnSync(process.execPath,
    [SHOTS, 'test/fixtures/journal.md', '--browser', 'firefox', '--size', 'phone', '--theme', 'light', '--out', out],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, INIT_CWD: ROOT, PLAYWRIGHT_BROWSERS_PATH: path.join(out, 'none') } });
  assert.match(run.stdout, /firefox isn't installed: npx playwright install firefox/);
  assert.equal(run.status, 1);
  assert.deepEqual(fs.readdirSync(out).filter((f) => f.endsWith('.png')), []);
  fs.rmSync(out, { recursive: true, force: true });
});

test('a file that isn\'t there, or isn\'t markdown, is refused before anything starts', () => {
  const refused = (file) => spawnSync(process.execPath, [SHOTS, file],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, INIT_CWD: ROOT } });
  assert.match(refused('nowhere.md').stderr, /no such file: nowhere\.md/);
  assert.match(refused('package.json').stderr, /not a markdown file: package\.json/);
});

test('Playwright is for development only, and the shots aren\'t committed', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.devDependencies.playwright);
  assert.equal(pkg.dependencies.playwright, undefined);
  assert.match(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8'), /^shots\/$/m);
});
