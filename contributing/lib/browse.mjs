// Drives reader in a browser through a list of steps, for a review's checks:
// clicks, taps, drags (touch or mouse), typing, waiting, and screenshots.
// Every step has a time limit, and the whole run has one, and whatever happens,
// even a failed step or Ctrl-C, the browser session, safaridriver and reader
// are ended. It runs the branch's own reader on a scratch copy of the file's
// folder, so nothing it clicks writes to a file that matters.
//
//   node browse.mjs <file.md> --steps <steps.json> --repo <reader checkout>
//        [--browser chromium|webkit|firefox|safari] [--phone] [--zoom 2] [--forced-colors] [--out <dir>]
//        [--step-timeout 8000] [--timeout 120000]
//
// --zoom 2 lays the page out as the browser's 200% would: half the window, at
// twice the pixels. --forced-colors is the system's colours, as Windows' contrast
// themes give. Both are Playwright's, so not for safari.
//
// safari is Safari Technology Preview, never the Safari you use: its own
// safaridriver and its own windows. Once only, it needs
//   "/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver" --enable
// and Develop > Allow Remote Automation in Safari Technology Preview.
// It can't run inside Claude Code's sandbox, where safaridriver can't listen.
//
// Steps are a JSON array, each one an object with one action. `frame: true`
// means inside the rendered page (#preview); without it, the app around it.
//   { "work": true }                          into Work, as a workbook opens
//   { "click": "#workBtn" }                   a mouse click
//   { "tap": ".cell", "frame": true }         a touch tap (a click in Safari)
//   { "drag": [".a", ".b"], "frame": true, "touch": true, "moves": 12 }
//   { "drag": [[10, 20], [200, 20]] }         from and to, as points on the screen
//   { "drag": [{ "at": "svg", "x": 0.4, "y": 0.4 }, { "at": "svg", "x": 0.75, "y": 0.4 },
//              { "at": "svg", "x": 0.75, "y": 0.75 }], "frame": true, "touch": true }
//      a place in an element, as fractions of its width and height from its top
//      left; a drag goes through every point given, in order
//   { "type": "walk", "into": "#filter" }     typing, into an element first if given
//   { "press": "Enter" }
//   { "wait": ".gm-doc", "frame": true }      until it's there
//   { "until": "document.title !== ''", "frame": true }   until it's true
//   { "eval": "document.querySelectorAll('.done').length", "frame": true }  prints it
//   { "shot": "after-drag" }                  <out>/<browser>[-phone][-zoom2][-forced]-<name>.png
//   { "sleep": 300 }
// Each step may also have "timeout" in ms. It stops at the first step that fails,
// takes a shot named failed, and exits 1.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';

const STP = '/Applications/Safari Technology Preview.app/Contents/MacOS/safaridriver';
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    steps: { type: 'string' },
    repo: { type: 'string', default: process.cwd() },
    browser: { type: 'string', default: 'chromium' },
    phone: { type: 'boolean', default: false },
    zoom: { type: 'string', default: '1' },
    'forced-colors': { type: 'boolean', default: false },
    out: { type: 'string', default: 'shots' },
    'step-timeout': { type: 'string', default: '8000' },
    timeout: { type: 'string', default: '120000' },
  },
});
const file = positionals[0] && path.resolve(positionals[0]);
const repo = path.resolve(opt.repo);
if (!file || !opt.steps || !fs.existsSync(path.join(repo, 'bin/reader.js'))) {
  console.error('usage: browse.mjs <file.md> --steps <steps.json> --repo <reader checkout> [--browser chromium|webkit|firefox|safari] [--phone] [--zoom 2] [--forced-colors] [--out <dir>]');
  process.exit(2);
}
const steps = JSON.parse(fs.readFileSync(opt.steps, 'utf8'));
const STEP_MS = Number(opt['step-timeout']);
const zoom = Number(opt.zoom);
if (!(zoom >= 1 && zoom <= 4)) {
  console.error(`--zoom is from 1 to 4, not ${opt.zoom}`);
  process.exit(2);
}
if (opt.browser === 'safari' && (zoom !== 1 || opt['forced-colors'])) {
  console.error('--zoom and --forced-colors are for Playwright\'s browsers, not safari');
  process.exit(2);
}
const label = `${opt.browser}${opt.phone ? '-phone' : ''}${zoom !== 1 ? `-zoom${opt.zoom}` : ''}${opt['forced-colors'] ? '-forced' : ''}`;
fs.mkdirSync(opt.out, { recursive: true });

// Everything to end, last started first. end() runs each once, whatever fails.
const enders = [];
let ending = null;
function end() {
  ending ??= (async () => {
    for (const e of enders.reverse()) {
      await Promise.race([Promise.resolve().then(e), new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
    }
  })();
  return ending;
}
const quit = (code, why) => {
  if (why) console.log(why);
  end().finally(() => process.exit(code));
};
process.on('SIGINT', () => quit(130, 'stopped: interrupted'));
process.on('SIGTERM', () => quit(143, 'stopped: terminated'));
setTimeout(() => quit(3, `stopped: the whole run passed its ${opt.timeout} ms`), Number(opt.timeout)).unref();

const within = (ms, what, p) => {
  let timer;
  return Promise.race([
    p,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what ? `${what}: ` : ''}no answer in ${ms} ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
};

// The file's folder, copied, as scripts/shots.js does.
function scratchCopy() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-browse-'));
  const from = path.dirname(file);
  const dir = path.join(scratch, path.basename(from));
  fs.cpSync(from, dir, { recursive: true, filter: (at) => at === from || !/^(\..*|node_modules|shots)$/.test(path.basename(at)) });
  enders.push(() => fs.rmSync(scratch, { recursive: true, force: true }));
  return path.join(dir, path.basename(file));
}

const startReader = (copy) => within(15000, 'starting reader', new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(repo, 'bin/reader.js'), path.dirname(copy), '--port', '0', '--no-browser', '--open', path.basename(copy)],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  enders.push(() => child.kill());
  let said = '';
  let complained = '';
  child.stderr.on('data', (c) => { complained += c; });
  child.on('exit', (code) => reject(new Error(`reader stopped, with ${code}: ${complained}`)));
  child.stdout.on('data', (c) => {
    said += c;
    const url = said.match(/http:\S+/)?.[0];
    if (url) resolve(url);
  });
}));

// ---- Playwright: chromium, webkit, firefox --------------------------------

async function playwright(url) {
  const pw = createRequire(path.join(repo, 'package.json'))('playwright');
  const browser = await within(30000, 'starting the browser', pw[opt.browser].launch());
  enders.push(() => browser.close());
  const phone = opt.browser === 'webkit' ? pw.devices['iPhone 14'] : pw.devices['Pixel 7'];
  const size = opt.phone ? PHONE : DESKTOP;
  // Zoomed, the page has the room the window would have at that zoom.
  const viewport = { width: Math.round(size.width / zoom), height: Math.round(size.height / zoom) };
  const seen = { ...(zoom !== 1 ? { deviceScaleFactor: zoom } : {}), ...(opt['forced-colors'] ? { forcedColors: 'active' } : {}) };
  const context = await browser.newContext(opt.phone
    ? { ...phone, viewport, ...seen, ...(opt.browser === 'firefox' ? { isMobile: undefined } : {}) }
    : { viewport, hasTouch: true, ...seen });
  const page = await context.newPage();
  await within(15000, 'opening reader', page.goto(url));
  await within(15000, 'reader drawing', page.waitForSelector('#preview'));
  const frame = async () => (await page.waitForSelector('#preview')).contentFrame();
  const where = async (s) => (s.frame ? frame() : page);
  const box = async (s, sel, fx = 0.5, fy = 0.5) => {
    const el = await (await where(s)).waitForSelector(sel, { timeout: STEP_MS });
    const b = await el.boundingBox();
    if (!b) throw new Error(`${sel} isn't on the screen`);
    return [b.x + b.width * fx, b.y + b.height * fy];
  };
  const point = (s, p) => (Array.isArray(p) ? p : typeof p === 'object' ? box(s, p.at, p.x, p.y) : box(s, p));
  const cdp = opt.browser === 'chromium' ? await context.newCDPSession(page) : null;

  // A drag: real touch through CDP in Chromium, the mouse, or else pointer
  // events made in the page, which is all Playwright offers WebKit and Firefox.
  async function drag(s) {
    const corners = [];
    for (const p of s.drag) corners.push(await point(s, p));
    const moves = s.moves ?? 10;
    // Every point along the way, `moves` between each corner and the next.
    const path = [corners[0]];
    for (let c = 1; c < corners.length; c++) {
      const [a, b] = [corners[c - 1], corners[c]];
      for (let i = 1; i <= moves; i++) path.push([a[0] + ((b[0] - a[0]) * i) / moves, a[1] + ((b[1] - a[1]) * i) / moves]);
    }
    const [from, to] = [path[0], path.at(-1)];
    if (!s.touch) {
      await page.mouse.move(...from);
      await page.mouse.down();
      for (const p of path.slice(1)) await page.mouse.move(...p);
      await page.mouse.up();
      return 'mouse';
    }
    if (cdp) {
      const touch = (type, [x, y]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await touch('touchStart', from);
      for (const p of path.slice(1)) await touch('touchMove', p);
      await touch('touchEnd', to);
      return 'real touch, through CDP';
    }
    const f = await frame();
    const off = s.frame ? await (await page.$('#preview')).boundingBox() : { x: 0, y: 0 };
    const inside = s.frame ? f : page;
    // The browser never saw this pointer, so capturing it would throw: for the
    // drag, capture is stood in for, for this pointer alone. Each event goes in
    // a task of its own, a frame apart, as a finger's do.
    await inside.evaluate(() => {
      const ID = 7;
      const was = { set: Element.prototype.setPointerCapture, release: Element.prototype.releasePointerCapture, has: Element.prototype.hasPointerCapture };
      const d = { ID, was, held: null };
      Element.prototype.setPointerCapture = function (id) { if (id === ID) d.held = this; else was.set.call(this, id); };
      Element.prototype.releasePointerCapture = function (id) { if (id === ID) d.held = null; else was.release.call(this, id); };
      Element.prototype.hasPointerCapture = function (id) { return id === ID ? d.held === this : was.has.call(this, id); };
      window.__browseDrag = d;
    });
    const fire = (type, [x, y]) => inside.evaluate(({ type, x, y }) => {
      const d = window.__browseDrag;
      const el = d.held ?? document.elementFromPoint(x, y) ?? document.body;
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: d.ID, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1 }));
    }, { type, x: x - off.x, y: y - off.y });
    try {
      await fire('pointerdown', from);
      for (const p of path.slice(1)) {
        await new Promise((r) => setTimeout(r, 16));
        await fire('pointermove', p);
      }
      await fire('pointerup', to);
    } finally {
      await inside.evaluate(() => {
        const { was } = window.__browseDrag;
        Object.assign(Element.prototype, { setPointerCapture: was.set, releasePointerCapture: was.release, hasPointerCapture: was.has });
        delete window.__browseDrag;
      }).catch(() => {});
    }
    return 'touch as pointer events made in the page, with capture stood in for: not real touch';
  }

  return {
    async work() {
      await page.waitForFunction(() => document.querySelector('#crumb')?.textContent, null, { timeout: STEP_MS });
      if (!await page.$('#split.work-mode')) await page.locator('#workBtn').dispatchEvent('click');
      await (await frame()).waitForFunction(() => document.querySelector('.gm-doc')?.children.length, null, { timeout: STEP_MS });
    },
    async click(s) { await page.mouse.click(...await point(s, s.click)); },
    async tap(s) { await page.touchscreen.tap(...await point(s, s.tap)); return 'touch tap'; },
    drag,
    async type(s) {
      if (s.into) await (await where(s)).click(s.into, { timeout: STEP_MS });
      await page.keyboard.type(String(s.type));
    },
    async press(s) { await page.keyboard.press(s.press); },
    async wait(s) { await (await where(s)).waitForSelector(s.wait, { timeout: STEP_MS }); },
    async until(s) { await (await where(s)).waitForFunction(s.until, null, { timeout: STEP_MS }); },
    async eval(s) { return JSON.stringify(await (await where(s)).evaluate(s.eval)); },
    async shot(name) {
      const to = path.join(opt.out, `${label}-${name}.png`);
      await page.screenshot({ path: to });
      return to;
    },
  };
}

// ---- Safari Technology Preview, through WebDriver -------------------------

const freePort = () => new Promise((resolve) => {
  // On 127.0.0.1, where reader listens too: a port free on :: may be reader's.
  const srv = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

async function safari(url) {
  if (!fs.existsSync(STP)) throw new Error('Safari Technology Preview is not installed');
  const port = await freePort();
  // Ending the session doesn't quit the browser it started in automation mode,
  // so whichever of those wasn't running before this run is ended with it.
  const automation = () => spawnSync('pgrep', ['-f', 'Safari Technology Preview.*--automation'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const before = new Set(automation());
  enders.push(() => { for (const pid of automation()) if (!before.has(pid)) try { process.kill(Number(pid)); } catch { /* already gone */ } });
  const driver = spawn(STP, ['-p', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  enders.push(() => driver.kill());
  const base = `http://127.0.0.1:${port}`;
  const call = async (method, at, body, ms = STEP_MS) => {
    const res = await fetch(base + at, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(ms) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${at}: ${json.value?.message ?? `${res.status} from ${res.headers.get('server') ?? 'an unnamed server'} on ${base}`}`);
    return json.value;
  };
  for (let i = 0; ; i++) {
    // It's up once safaridriver itself answers, not whatever else might be on the port.
    try {
      const r = await fetch(`${base}/status`, { signal: AbortSignal.timeout(1000) });
      if (!/safaridriver/.test(r.headers.get('server') ?? '')) throw new Error(`port ${port} answered by ${r.headers.get('server') ?? 'something else'}`);
      break;
    } catch (e) {
      if (i > 40) throw new Error(`safaridriver didn't start: ${e.message}`, { cause: e });
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  // Its own safaridriver drives only Safari Technology Preview; naming it as browserName is refused.
  const made = await call('POST', '/session', { capabilities: {} }, 30000)
    .catch((e) => { throw new Error(`${e.message}\n  Once only: "${STP}" --enable, and Develop > Allow Remote Automation in Safari Technology Preview`); });
  const s0 = `/session/${made.sessionId}`;
  enders.push(() => call('DELETE', s0, null, 5000));
  const size = opt.phone ? PHONE : DESKTOP;
  await call('POST', `${s0}/window/rect`, { x: 0, y: 0, ...size });
  await call('POST', `${s0}/url`, { url }, 15000);

  // An element is kept as the reference object safaridriver gave, whatever its key.
  const idOf = (ref) => Object.values(ref)[0];
  let inFrame = false;
  const into = async (frame) => {
    if (frame === inFrame) return;
    if (inFrame) {
      await call('POST', `${s0}/frame/parent`, {});
      inFrame = false;
    }
    if (frame) {
      // Until reader has put its page in the frame, the frame holds a blank
      // document, and Safari stays in that one, so go in only once the page is there.
      const until = Date.now() + STEP_MS;
      for (;;) {
        const ref = await find('#preview', false);
        await call('POST', `${s0}/frame`, { id: ref });
        if (await call('POST', `${s0}/execute/sync`, { script: "return location.href !== 'about:blank' && document.readyState === 'complete'", args: [] })) break;
        await call('POST', `${s0}/frame/parent`, {});
        if (Date.now() > until) throw new Error(`the page's frame didn't load in ${STEP_MS} ms`);
        await new Promise((r) => setTimeout(r, 150));
      }
      inFrame = true;
    }
  };
  async function find(sel, frame, ms = STEP_MS) {
    if (frame !== undefined && frame !== inFrame) await into(frame);
    const until = Date.now() + ms;
    for (;;) {
      try { return await call('POST', `${s0}/element`, { using: 'css selector', value: sel }); } catch (e) {
        if (Date.now() > until) throw new Error(`${sel}: not found in ${ms} ms`, { cause: e });
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }
  const script = async (s, js, args = []) => {
    await into(!!s.frame);
    return call('POST', `${s0}/execute/sync`, { script: js, args });
  };
  const poll = async (s, js) => {
    const until = Date.now() + (s.timeout ?? STEP_MS);
    while (!await script(s, `return !!(${js})`)) {
      if (Date.now() > until) throw new Error(`${js}: not true in time`);
      await new Promise((r) => setTimeout(r, 150));
    }
  };
  // A pointer action from one place to another. Safari on a Mac has no touch,
  // so a touch drag here is the mouse, and it says so.
  // An element origin is its centre, so a fraction of it is an offset from there.
  const at = async (s, p) => {
    if (Array.isArray(p)) return { x: Math.round(p[0]), y: Math.round(p[1]), origin: 'viewport' };
    const sel = typeof p === 'object' ? p.at : p;
    const ref = await find(sel, !!s.frame);
    if (typeof p !== 'object') return { x: 0, y: 0, origin: ref };
    const r = await call('GET', `${s0}/element/${idOf(ref)}/rect`);
    return { x: Math.round(r.width * ((p.x ?? 0.5) - 0.5)), y: Math.round(r.height * ((p.y ?? 0.5) - 0.5)), origin: ref };
  };
  const pointer = async (s, points, moves = 10) => {
    const spots = [];
    for (const p of points) spots.push(await at(s, p));
    const actions = [{ type: 'pointerMove', duration: 0, ...spots[0] }, { type: 'pointerDown', button: 0 }];
    // WebDriver moves in a straight line over a move's duration, so each leg is one move.
    for (const spot of spots.slice(1)) actions.push({ type: 'pointerMove', duration: 30 * moves, ...spot });
    actions.push({ type: 'pointerUp', button: 0 });
    await call('POST', `${s0}/actions`, { actions: [{ type: 'pointer', id: 'p', parameters: { pointerType: 'mouse' }, actions }] });
    await call('DELETE', `${s0}/actions`);
  };
  return {
    async work() {
      await poll({}, "document.querySelector('#crumb')?.textContent");
      await script({}, "if (!document.querySelector('#split.work-mode')) document.querySelector('#workBtn').click()");
      await poll({ frame: true }, "document.querySelector('.gm-doc')?.children.length");
    },
    async click(s) { await pointer(s, [s.click]); },
    async tap(s) { await pointer(s, [s.tap]); return 'a click: Safari on a Mac has no touch'; },
    async drag(s) {
      await pointer(s, s.drag, s.moves ?? 10);
      return s.touch ? 'the mouse: Safari on a Mac has no touch' : 'mouse';
    },
    async type(s) {
      const ref = s.into ? await find(s.into, !!s.frame) : await call('GET', `${s0}/element/active`);
      await call('POST', `${s0}/element/${idOf(ref)}/value`, { text: String(s.type) });
    },
    async press(s) {
      const keys = { Enter: '\uE007', Tab: '\uE004', Escape: '\uE00C', Backspace: '\uE003', ArrowLeft: '\uE012', ArrowUp: '\uE013', ArrowRight: '\uE014', ArrowDown: '\uE015' };
      // "Shift+Tab", as Playwright takes it: modifiers held down around the key.
      const mods = { Shift: '\uE008', Control: '\uE009', Alt: '\uE00A', Meta: '\uE03D' };
      const parts = s.press.split('+');
      const k = keys[parts.at(-1)] ?? parts.at(-1);
      const held = parts.slice(0, -1).map((m) => mods[m] ?? m);
      const actions = [...held.map((v) => ({ type: 'keyDown', value: v })), { type: 'keyDown', value: k }, { type: 'keyUp', value: k }, ...held.reverse().map((v) => ({ type: 'keyUp', value: v }))];
      await call('POST', `${s0}/actions`, { actions: [{ type: 'key', id: 'k', actions }] });
    },
    async wait(s) { await find(s.wait, !!s.frame, s.timeout ?? STEP_MS); },
    async until(s) { await poll(s, s.until); },
    async eval(s) { return JSON.stringify(await script(s, `return (${s.eval})`)); },
    async shot(name) {
      const to = path.join(opt.out, `${label}-${name}.png`);
      fs.writeFileSync(to, Buffer.from(await call('GET', `${s0}/screenshot`, null, 15000), 'base64'));
      return to;
    },
  };
}

// ---- the run ---------------------------------------------------------------

const ACTIONS = ['work', 'click', 'tap', 'drag', 'type', 'press', 'wait', 'until', 'eval', 'shot', 'sleep'];
let code = 0;
try {
  const url = await startReader(scratchCopy());
  const b = await (opt.browser === 'safari' ? safari(url) : playwright(url));
  console.log(`ok    ${label}: reader open at ${url}`);
  for (const [i, s] of steps.entries()) {
    const act = ACTIONS.find((a) => a in s);
    const what = `${i + 1} ${act} ${act === 'work' ? '' : JSON.stringify(s[act])}${s.frame ? ' (in the page)' : ''}`;
    try {
      if (!act) throw new Error(`no action; one of ${ACTIONS.join(', ')}`);
      const said = act === 'sleep'
        ? await new Promise((r) => setTimeout(r, s.sleep))
        : await within(s.timeout ?? STEP_MS, null, act === 'shot' ? b.shot(s.shot) : b[act](s));
      console.log(`ok    ${what}${said ? `: ${said}` : ''}`);
    } catch (e) {
      console.log(`FAIL  ${what}: ${e.message}`);
      await within(10000, 'the failure shot', b.shot('failed')).then((to) => console.log(`      shot: ${to}`)).catch(() => {});
      code = 1;
      break;
    }
  }
} catch (e) {
  console.log(`FAIL  ${e.message}`);
  code = 1;
}
await end();
process.exit(code);
