/**
 *   npm run shots -- <file> [--browser <names>] [--size <names>] [--theme <names>]
 *                           [--out <dir>] [--page <n|all>] [--screen] [--state <script>]
 *
 * Screenshots of a page as reader shows it, in each browser, size and theme
 * asked for, each file named for what it shows. It's for reviews, on demand:
 * Playwright is a dev dependency, loaded only here, and no test needs its
 * browsers. See CONTRIBUTING.md.
 */

/* global document, window, getComputedStyle, matchMedia, requestAnimationFrame, innerHeight, scrollTo, devicePixelRatio -- for what runs in the page */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const READER = fileURLToPath(new URL('../bin/reader.js', import.meta.url));

export const BROWSERS = ['chromium', 'firefox', 'webkit'];
export const SIZES = ['desktop', 'phone'];
export const THEMES = ['light', 'dark', 'contrast', 'forced'];

// Each engine with a phone that runs it, so that what it says it is, is so.
const PHONES = { chromium: 'Pixel 7', firefox: 'Pixel 7', webkit: 'iPhone 14' };
const DESKTOP = { width: 1280, height: 800 };
// A width asked for is a phone's under this, with its touch and its height.
const PHONE_UNDER = 600;
// Sharp enough to read, and a tall page stays a size that can be opened.
const PHONE_SCALE = 2;
// Pixels down that every engine will draw: Firefox refuses past 32767, and
// Chromium leaves the rest blank past about twice that. A taller document
// comes in parts.
const TALLEST = 32000;

const THEME_OPTIONS = {
  light: { colorScheme: 'light' },
  dark: { colorScheme: 'dark' },
  contrast: { colorScheme: 'light', contrast: 'more' },
  forced: { colorScheme: 'light', forcedColors: 'active' },
};

const THEME_WORDS = { light: 'a light theme', dark: 'a dark theme', contrast: 'more contrast', forced: 'forced colours' };

const USAGE = `usage: npm run shots -- <file> [options]

  <file>              the markdown file to show; its folder is served from a
                      scratch copy, so the file itself is never written to
  --browser <names>   ${BROWSERS.join(', ')} (default: all)
  --size <names>      ${SIZES.join(', ')}, or a width in pixels (default: desktop,
                      phone); a width under ${PHONE_UNDER} is the phone at that width
  --theme <names>     ${THEMES.join(', ')} (default: all)
  --out <dir>         where the shots go (default: shots)
  --page <n|all>      which page of a workbook or a deck, which show one at a
                      time (default: the first)
  --screen            only what's on the screen, not the whole document
  --state <script>    a module whose default export, async ({ page, frame }),
                      gets the page to the state to be shot; frame is the
                      document's

Names can be comma-separated or the option repeated.
`;

class Refused extends Error {}

/** Every value given for a repeatable option, each maybe comma-separated. */
const listOf = (values) => values?.flatMap((v) => v.split(',')).filter(Boolean);

function chosen(values, known, option) {
  const names = listOf(values) ?? known;
  for (const name of names) {
    if (!known.includes(name)) throw new Refused(`${option}: no such name as ${name} (${known.join(', ')})`);
  }
  return [...new Set(names)];
}

function chosenSizes(values) {
  const names = listOf(values) ?? SIZES;
  for (const name of names) {
    if (!SIZES.includes(name) && !/^[1-9]\d*$/.test(name)) throw new Refused(`--size: no such size as ${name} (${SIZES.join(', ')}, or a width)`);
  }
  return [...new Set(names)];
}

/** What's asked for on the command line, with nothing yet opened. */
export function readArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        browser: { type: 'string', multiple: true },
        size: { type: 'string', multiple: true },
        theme: { type: 'string', multiple: true },
        out: { type: 'string', default: 'shots' },
        page: { type: 'string' },
        screen: { type: 'boolean', default: false },
        state: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    throw new Refused(err.message);
  }
  const { values, positionals } = parsed;
  if (values.help) return { help: true };
  if (positionals.length !== 1) throw new Refused('which one file?');
  const { page } = values;
  if (page !== undefined && page !== 'all' && !/^[1-9]\d*$/.test(page)) throw new Refused(`--page: ${page} isn't a page number or all`);
  return {
    file: positionals[0],
    browsers: chosen(values.browser, BROWSERS, '--browser'),
    sizes: chosenSizes(values.size),
    themes: chosen(values.theme, THEMES, '--theme'),
    out: values.out,
    page: page === undefined || page === 'all' ? page : Number(page),
    screen: values.screen,
    state: values.state,
  };
}

/** The file a shot goes in: `journal.webkit.phone.dark.png`, desktop going without saying. */
export function shotName({ file, browser, size, theme, page, part }) {
  const parts = [path.basename(file, path.extname(file)), browser];
  if (size !== 'desktop') parts.push(size);
  parts.push(theme);
  if (page) parts.push(`page${page}`);
  if (part) parts.push(`part${part}`);
  return `${parts.join('.')}.png`;
}

/** Every shot asked for, one for each browser, size and theme. */
export function shotsOf({ file, browsers, sizes, themes }) {
  return browsers.flatMap((browser) => sizes.flatMap((size) => themes.map((theme) => ({ file, browser, size, theme }))));
}

/** The browser context for a shot: what it's run on, and what it asks of the page. */
export function contextOptions({ browser, size, theme }, devices) {
  const width = Number(size) || null;
  const look = THEME_OPTIONS[theme];
  if (size === 'desktop' || width >= PHONE_UNDER) {
    return { viewport: { ...DESKTOP, width: width ?? DESKTOP.width }, ...look };
  }
  const phone = devices[PHONES[browser]];
  return { ...phone, deviceScaleFactor: PHONE_SCALE, viewport: { ...phone.viewport, width: width ?? phone.viewport.width }, ...look };
}

/**
 * Whether the browser did what the theme asks. For forced colours a media
 * query won't do: WebKit answers that it matches and draws the page in its
 * own colours regardless. A colour the page gives is replaced only if it's so.
 */
function honoured(theme) {
  if (theme === 'forced') {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'rgb(1, 2, 3)';
    document.body.append(probe);
    const forced = getComputedStyle(probe).backgroundColor !== 'rgb(1, 2, 3)';
    probe.remove();
    return forced;
  }
  return matchMedia({
    light: '(prefers-color-scheme: light)',
    dark: '(prefers-color-scheme: dark)',
    contrast: '(prefers-contrast: more)',
  }[theme]).matches;
}

/** Everything the page is waiting on in the frame: what features draw late, fonts, and images. */
function settled() {
  const images = [...document.images].filter((i) => !i.complete)
    .map((i) => new Promise((done) => { i.onload = i.onerror = done; }));
  const pending = async () => {
    while (window.Preview?.pending().length) await Promise.all(window.Preview.pending());
  };
  const onward = Promise.all([pending(), document.fonts.ready, ...images]);
  // An image from a site that doesn't answer doesn't hold up the shot.
  return Promise.race([onward, new Promise((done) => setTimeout(done, 5000))])
    .then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

/**
 * The window made as tall as the document, since the document scrolls inside
 * its frame, where a full-page screenshot of the app wouldn't reach. Again
 * if that brought more of it in: images load as they come into sight. It
 * stops at what a picture can hold.
 */
async function stretch(page, frame) {
  const tallest = Math.floor(TALLEST / await page.evaluate(() => devicePixelRatio));
  for (let i = 0; i < 4; i++) {
    await frame.evaluate(settled);
    const more = await frame.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const { width, height } = page.viewportSize();
    if (more <= 0 || height >= tallest) return;
    await page.setViewportSize({ width, height: Math.min(tallest, height + more) });
  }
}

/** Saves what's showing under the name `name` gives it, in as many parts as it won't fit in one. */
async function save(page, frame, name, screen) {
  const shot = (file) => page.screenshot({ path: file, animations: 'disabled' });
  if (screen) {
    await shot(name());
    return [name()];
  }
  await stretch(page, frame);
  const [whole, seen] = await frame.evaluate(() => [document.documentElement.scrollHeight, innerHeight]);
  const parts = Math.max(1, Math.ceil(whole / seen));
  const saved = [];
  for (let part = 1; part <= parts; part++) {
    const file = name(parts > 1 ? part : null);
    await frame.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), (part - 1) * seen);
    await frame.evaluate(settled);
    await shot(file);
    saved.push(file);
  }
  return saved;
}

/** The document open and drawn in Work: a workbook opens there, and anything else is taken there. */
async function open(page, url) {
  await page.goto(url);
  await page.waitForSelector('#split');
  const frame = await (await page.waitForSelector('#preview')).contentFrame();
  await page.waitForFunction(() => document.querySelector('#crumb')?.textContent);
  if (!await page.$('#split.work-mode')) await page.locator('#workBtn').dispatchEvent('click');
  await frame.waitForFunction(() => document.querySelector('.gm-doc')?.children.length);
  await frame.evaluate(settled);
  return frame;
}

/** How many pages it has been cut into in Work, or 0 if it's shown whole. */
const pageCount = (page) => page.evaluate(() => {
  const pages = document.querySelector('#pages');
  return pages.hidden ? 0 : Number(document.querySelector('#pageCount').textContent.match(/(\d+)\s*$/)?.[1] ?? 0);
});

/**
 * On to the next page, once it's the one drawn. Not a real click: a button
 * off the edge of a narrow screen gets scrolled to first, and the whole app
 * would stay scrolled sideways in the shot.
 */
async function nextPage(page, frame) {
  const was = await frame.evaluate(() => document.body.innerText);
  await page.locator('#pageNext').dispatchEvent('click');
  // Two pages can read the same, so this only waits so long.
  await frame.waitForFunction((was) => document.body.innerText !== was, was, { timeout: 3000 }).catch(() => {});
  await frame.evaluate(settled);
}

// What it says on stderr is heard only if it doesn't start: a browser closed
// with a save under way is reported there, and that's nothing to the shots.
const startReader = (dir, file) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [READER, dir, '--port', '0', '--no-browser', '--open', file],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  let said = '';
  let complained = '';
  child.stderr.on('data', (chunk) => { complained += chunk; });
  child.on('exit', (code) => reject(new Error(`reader stopped, with ${code}: ${complained}`)));
  child.stdout.on('data', (chunk) => {
    said += chunk;
    const url = said.match(/http:\S+/)?.[0];
    if (url) resolve({ url, stop: () => child.kill() });
  });
});

/**
 * A copy of the file's folder, so a state's clicks write to nothing that
 * matters, under the folder's own name, which the app's bar shows: a name
 * different each run would differ between a before and an after.
 */
function scratchCopy(file) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-shots-'));
  const from = path.dirname(file);
  const dir = path.join(scratch, path.basename(from));
  fs.cpSync(from, dir, {
    recursive: true,
    filter: (at) => at === from || !/^(\..*|node_modules|shots)$/.test(path.basename(at)),
  });
  return { scratch, dir };
}

/** Saves the shots of one browser, size and theme: one, or one for each page. */
async function shoot(browser, shot, { url, out, page: which, screen, state, devices, say }) {
  const context = await browser.newContext(contextOptions(shot, devices));
  try {
    const page = await context.newPage();
    const frame = await open(page, url);
    if (!await frame.evaluate(honoured, shot.theme)) {
      say(`skip   ${shotName(shot)}: ${shot.browser} can't emulate ${THEME_WORDS[shot.theme]}`);
      return { saved: 0, skipped: 1 };
    }
    const count = await pageCount(page);
    if (typeof which === 'number' && which > (count || 1)) {
      throw new Refused(`--page ${which}: it has ${count || 1}`);
    }
    const first = typeof which === 'number' ? which : 1;
    const last = which === 'all' ? count || 1 : first;
    for (let at = 1; at < first; at++) await nextPage(page, frame);
    const screenful = page.viewportSize();
    let saved = 0;
    for (let at = first; at <= last; at++) {
      // A page's height is its own, not whatever the one before it stretched to.
      if (at > first) {
        await page.setViewportSize(screenful);
        await nextPage(page, frame);
      }
      if (state) await state({ page, frame });
      const pageShot = { ...shot, page: which === undefined ? null : at };
      const files = await save(page, frame, (part) => path.join(out, shotName({ ...pageShot, part })), screen);
      files.forEach((file) => say(`saved  ${file}`));
      saved += files.length;
    }
    return { saved, skipped: 0, count };
  } finally {
    await context.close();
  }
}

/** Every shot in one browser, or else why it couldn't be had. */
async function runBrowser(playwright, name, shots, options) {
  let browser;
  try {
    browser = await playwright[name].launch();
  } catch (err) {
    if (!/Executable doesn't exist|install/i.test(err.message)) throw err;
    options.say(`${name} isn't installed: npx playwright install ${name}`);
    return { saved: 0, skipped: 0, failed: shots.length };
  }
  const total = { saved: 0, skipped: 0, failed: 0, count: 0 };
  try {
    for (const shot of shots) {
      try {
        const { saved, skipped, count } = await shoot(browser, shot, options);
        total.saved += saved;
        total.skipped += skipped;
        total.count = count ?? total.count;
      } catch (err) {
        if (err instanceof Refused) throw err;
        total.failed++;
        options.say(`failed ${shotName(shot)}: ${err.message.split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  return total;
}

async function main(argv) {
  const args = readArgs(argv);
  if (args.help) return void process.stdout.write(USAGE);

  // npm run starts in the package's folder; a path is meant from where it was typed.
  const here = process.env.INIT_CWD ?? process.cwd();
  const file = path.resolve(here, args.file);
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Refused(`no such file: ${args.file}`);
  if (!/\.(md|markdown)$/i.test(file)) throw new Refused(`not a markdown file: ${args.file}`);
  const out = path.resolve(here, args.out);

  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new Refused("Playwright isn't installed: npm install, then npx playwright install");
  }
  const state = args.state && (await import(pathToFileURL(path.resolve(here, args.state)).href)).default;

  const began = Date.now();
  fs.mkdirSync(out, { recursive: true });
  const { scratch, dir } = scratchCopy(file);
  const reader = await startReader(dir, path.basename(file));
  try {
    const shots = shotsOf({ ...args, file });
    const options = { url: reader.url, out: out.startsWith(here + path.sep) ? path.relative(here, out) : out, page: args.page, screen: args.screen, state, devices: playwright.devices, say: console.log };
    // Each browser takes its own shots in turn, and they go side by side.
    const totals = await Promise.all(args.browsers.map((name) =>
      runBrowser(playwright, name, shots.filter((s) => s.browser === name), options)));
    const sum = (key) => totals.reduce((n, t) => n + (t[key] ?? 0), 0);
    const count = Math.max(...totals.map((t) => t.count ?? 0));
    if (count > 1 && args.page === undefined) {
      console.log(`\nIt shows a page at a time, and these are page 1 of ${count}: --page all for each of them.`);
    }
    console.log(`\n${sum('saved')} saved, ${sum('skipped')} skipped, ${sum('failed')} failed, in ${Math.round((Date.now() - began) / 1000)}s`);
    if (sum('failed')) process.exitCode = 1;
  } finally {
    reader.stop();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Refused ? `shots: ${err.message}\n\n${USAGE}` : err);
    process.exit(1);
  });
}
