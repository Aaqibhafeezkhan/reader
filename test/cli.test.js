import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const READER = fileURLToPath(new URL('../bin/reader.js', import.meta.url));

function dir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-cli-'));
  fs.writeFileSync(path.join(root, 'a.md'), '# a\n');
  return root;
}

/** Start reader, and give back the address it printed, to be stopped with `stop`, which waits till it has. */
function start(...args) {
  const child = spawn(process.execPath, [READER, dir(), '--no-browser', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (c) => {
      out += c;
      const url = /^ {2}(http:\/\/\S+)$/m.exec(out)?.[1];
      if (url) resolve({ url, stop: () => new Promise((done) => child.once('exit', done).kill()) });
    });
    child.on('exit', (code) => reject(new Error(`exited ${code}: ${out}`)));
  });
}

test('the address printed is the one listened on', async () => {
  const { url, stop } = await start('--host', '::1', '--port', '0');
  try {
    assert.match(url, /^http:\/\/\[::1\]:\d+\/$/);
    // Sent on to a name a policy can name, which is ::1 too.
    const port = new URL(url).port;
    const res = await fetch(url + 'api/tree?x=1', { redirect: 'manual' });
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('location'), `http://localhost:${port}/api/tree?x=1`);
    const status = await new Promise((resolve, reject) => {
      http.get({ host: '::1', port, path: '/api/tree', headers: { Host: `localhost:${port}` } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      }).on('error', reject);
    });
    assert.equal(status, 200);
  } finally {
    await stop();
  }
});

test('a --port with nothing after it is refused, not taken as any free port', () => {
  for (const args of [['--port='], ['--port', ''], ['--port', ' ']]) {
    const out = spawnSync(process.execPath, [READER, dir(), '--no-browser', ...args], { encoding: 'utf8', timeout: 5000 });
    assert.equal(out.status, 1, args.join(' '));
    assert.match(out.stderr, /--port must be a number/);
  }
});

/** Run reader to its end, as it is when it refuses what it's given. */
function run(...args) {
  return spawnSync(process.execPath, [READER, ...args], { encoding: 'utf8', timeout: 5000 });
}

/** Listen on `port` here, so reader finds it busy; null if something else already has it. */
function hold(port) {
  const server = net.createServer();
  return new Promise((resolve) => {
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

test('--help says how to use it, and that is all', () => {
  const out = run('--help');
  assert.equal(out.status, 0);
  assert.match(out.stdout, /^usage: reader <dir>/);
  assert.equal(run('-h').stdout, out.stdout);
});

test('--version says the version the app shows', async () => {
  const out = run('--version');
  assert.equal(out.status, 0);
  const { version } = await import('../src/version.js');
  assert.equal(out.stdout, `${version().label}\n`);
});

test('an argument it doesn\'t know is refused, saying which', () => {
  const root = dir();
  const cases = [
    [['--nope'], /unknown option --nope\n\nusage:/],
    [[root, 'other'], /unexpected argument other\n\nusage:/],
    [['--host'], /--host needs a value/],
    [['--host', '--no-browser'], /--host needs a value/],
    [['--allow-host'], /--allow-host needs a value/],
    [['--port', '70000'], /--port must be a number/],
    [['--port', '-1'], /--port must be a number/],
    [['-p', '80a'], /--port must be a number/],
    [['--port=1.5'], /--port must be a number/],
    [['--frame-port', 'x'], /--frame-port must be a number/],
    [['--frame-port'], /--frame-port must be a number/],
    [['--port', '9000', '--frame-port=9000'], /--port and --frame-port must differ/],
    [[path.join(root, 'a.md')], /not a directory: .*a\.md/],
    [[path.join(root, 'missing')], /not a directory: .*missing/],
  ];
  for (const [args, message] of cases) {
    const out = run(...(args[0]?.startsWith('-') ? [root, ...args] : args), '--no-browser');
    assert.equal(out.status, 1, args.join(' '));
    assert.match(out.stderr, message, args.join(' '));
  }
});

test('--open puts the file in the address', async () => {
  const { url, stop } = await start('--port', '0', '--open', 'notes/a b.md');
  try {
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/#notes%2Fa%20b\.md$/);
  } finally {
    await stop();
  }
});

test('without --port, a busy 8734 moves it on to the next port free', async () => {
  const held = await hold(8734);
  const { url, stop } = await start();
  try {
    const port = Number(new URL(url).port);
    assert.ok(port > 8734 && port < 8734 + 50, url);
    assert.equal((await fetch(url + 'api/tree')).status, 200);
  } finally {
    await stop();
    held?.close();
  }
});

test('without --port, it gives up after fifty busy ports, saying which', async () => {
  const held = await Promise.all(Array.from({ length: 50 }, (_, i) => hold(8734 + i)));
  try {
    const out = run(dir(), '--no-browser');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /ports 8734-8783 are all busy; pick one with --port\./);
  } finally {
    for (const server of held) server?.close();
  }
});

test('a --port given that is busy is refused, not moved on from', async () => {
  const held = await hold(0);
  const { port } = held.address();
  try {
    const out = run(dir(), '--no-browser', '--port', String(port));
    assert.equal(out.status, 1);
    assert.match(out.stderr, new RegExp(`port ${port} is busy; pick another with --port`));
  } finally {
    held.close();
  }
});

/** Where the page at `url` is told its frames are, by name and by port. */
async function framesAt(url) {
  const html = await (await fetch(url)).text();
  const meta = /<meta name="frames"(?: data-name="([^"]+)")? data-port="([^"]+)">/.exec(html);
  return { name: meta[1], port: meta[2] };
}

test('the frames\' port is up by the time the address is printed: the one after the app\'s, or the one asked for (gh-206)', async () => {
  const held = await hold(0);
  const { port: free } = held.address();
  held.close();
  for (const [args, want] of [[['--port', '0'], (p) => p + 1], [['--port', '0', '--frame-port', String(free)], () => free]]) {
    const { url, stop } = await start(...args);
    try {
      const at = Number(new URL(url).port);
      const { name, port } = await framesAt(url);
      assert.equal(name, `http://frames.localhost:${at}`);
      assert.equal(port, `http://127.0.0.1:${want(at)}`);
      assert.equal((await fetch(`${port}/preview.html`)).status, 200, args.join(' '));
    } finally {
      await stop();
    }
  }
});

test('a --frame-port given that is busy is refused; the one after the app\'s, when busy, moves to one free', async () => {
  const held = await hold(0);
  const { port } = held.address();
  try {
    const out = run(dir(), '--no-browser', '--port', '0', '--frame-port', String(port));
    assert.equal(out.status, 1);
    assert.match(out.stderr, new RegExp(`port ${port} is busy; pick another with --frame-port`));
    if (port > 1) {
      const app = await hold(port - 1);
      if (app) {
        app.close();
        const { url, stop } = await start('--port', String(port - 1));
        try {
          const frames = (await framesAt(url)).port;
          assert.notEqual(Number(new URL(frames).port), port);
          assert.equal((await fetch(`${frames}/preview.html`)).status, 200);
        } finally {
          await stop();
        }
      }
    }
  } finally {
    held.close();
  }
});
