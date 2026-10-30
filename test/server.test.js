import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createServer, listenFrames } from '../src/server.js';

let server, base, root, frames;

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-srv-'));
  fs.writeFileSync(path.join(root, 'note.md'), '# Note\n\n* a point\n\n~ my aside\n');
  fs.writeFileSync(path.join(root, 'page.html'), '<script>fetch("/api/tree")</script>');
  fs.writeFileSync(path.join(root, 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  fs.writeFileSync(path.join(root, 'doc.pdf'), '%PDF-1.4\n');
  const made = createServer({ root });
  ({ server } = made);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  // The frames' second port.
  frames = `http://127.0.0.1:${await listenFrames(made)}`;
});

after(() => server.close());

const json = (method, url, body) =>
  fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('serves the UI and the tree', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /<textarea id="editor"/);
  const { files } = await (await fetch(base + '/api/tree')).json();
  assert.deepEqual(files.map((f) => f.path).sort(), ['doc.pdf', 'note.md']);
});

test("info says which reader this is, and where its notes are", async () => {
  const { version } = await (await fetch(base + '/api/info')).json();
  assert.match(version.label, /^v\d+\.\d+\.\d+(\+[0-9a-f]{7})?$/);
  assert.match(version.url, /^https:\/\/github\.com\/jzheaux\/reader\/(releases\/tag|commit)\//);
});

test('render puts asides in the gutter column', async () => {
  const res = await json('POST', '/api/render', { text: '* a point\n\n~ my aside\n', path: 'note.md' });
  const out = await res.json();
  assert.match(out.body, /gm-aside-cell/);
  assert.match(out.body, /my aside/);
  assert.match(out.body, /<h1 class="gm-title">note<\/h1>/);
  assert.match(out.css, /--gm-aside-col/);
  assert.equal(out.notes, 1);
  assert.equal(out.deck, false);
});

test('render says whether the text is a deck, by its type:, for the Present button', async () => {
  const deck = async (text) => (await (await json('POST', '/api/render', { text })).json()).deck;
  assert.equal(await deck('---\ntype: slides\n---\n\n# One\n\n---\n\n# Two\n'), true);
  assert.equal(await deck('---\ntype: workbook\n---\n\n# One\n\n---\n\n# Two\n'), true);
  // Without one it's a document, notes and --- and all.
  assert.equal(await deck('---\ntitle: x\n---\n\n# One\n\n<!-- a note -->\n\n---\n\n# Two\n'), false);
});

test('render gives a deck being worked through as pages, and a document as itself', async () => {
  const deck = await (await json('POST', '/api/render', { text: '---\ntype: workbook\n---\n\n# One\n\n---\n\n# [x] Two\n', path: 'talk.md', pages: true })).json();
  assert.equal(deck.deck, true);
  assert.deepEqual(deck.pages.map((p) => p.line), [3, 7]);
  assert.match(deck.pages[1].body, /<h1 class="task-heading"/);
  // A deck with no `title:` is titled with its file's name, as the editor is.
  assert.equal(deck.title, 'talk');
  const titled = await (await json('POST', '/api/render', { text: '---\ntitle: Talk\ntype: slides\n---\n\n# One\n\n---\n\n# Two\n', path: 'talk.md', pages: true })).json();
  assert.equal(titled.title, 'Talk');
  const doc = await (await json('POST', '/api/render', { text: '# One\n\n---\n\n# Two\n', pages: true })).json();
  assert.equal(doc.pages, undefined);
  assert.match(doc.body, /One/);
});

test('a deck\'s pages come with its title, for the page\'s frame', async () => {
  const deck = await (await json('POST', '/api/render', { text: '---\ntitle: Talk\ntype: slides\n---\n\n# One\n\n---\n\n# Two\n', pages: true })).json();
  assert.equal(deck.title, 'Talk');
});

test('slides splits a deck and lifts its notes', async () => {
  const res = await json('POST', '/api/slides', { text: '# One\n\n<!-- hi -->\n\n---\n\n# Two\n', path: 'deck.md' });
  const out = await res.json();
  assert.equal(out.slides.length, 2);
  assert.equal(out.slides[0].notes, 'hi');
  assert.match(out.slides[1].body, /Two/);
});

test('save round-trips and reports conflicts as 409', async () => {
  const f = await (await fetch(base + '/api/file?path=note.md')).json();
  let res = await json('PUT', '/api/file', { path: 'note.md', text: 'edited\n', baseMtime: f.mtime });
  assert.equal(res.status, 200);
  assert.equal(fs.readFileSync(path.join(root, 'note.md'), 'utf8'), 'edited\n');

  res = await json('PUT', '/api/file', { path: 'note.md', text: 'stale\n', baseMtime: f.mtime - 1000 });
  assert.equal(res.status, 409);
});

test('refuses escapes, non-JSON writes and foreign hosts', async () => {
  let res = await fetch(base + '/api/file?path=' + encodeURIComponent('../x.md'));
  assert.equal(res.status, 400);
  res = await fetch(base + '/content/..%2F..%2Fetc%2Fpasswd');
  assert.equal(res.status, 400);
  res = await fetch(base + '/api/file', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(res.status, 415);

  const http = await import('node:http');
  const status = await new Promise((resolve) => {
    http.get(base + '/api/tree', { headers: { Host: 'evil.example:80' } }, (r) => resolve(r.statusCode));
  });
  assert.equal(status, 403);
});

test('a body over 20MB is answered with a 413, whether its length is given or not', async () => {
  const big = Buffer.alloc(21 * 1024 * 1024, 'a');
  const res = await fetch(base + '/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: big });
  assert.equal(res.status, 413);
  const status = await new Promise((resolve, reject) => {
    const req = http.request(base + '/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (r) => {
      r.resume();
      resolve(r.statusCode);
    });
    req.on('error', reject);
    for (let i = 0; i < 21; i++) req.write(big.subarray(0, 1024 * 1024));
    req.end();
  });
  assert.equal(status, 413);
});

test('a body, a field or an address that makes no sense is a 400, not a 500', async () => {
  const raw = (method, url, body) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body });
  for (const body of ['null', '[]', '"text"', '42']) {
    assert.equal((await raw('POST', '/api/render', body)).status, 400, body);
  }
  const bad = [
    ['POST', '/api/render', { text: 42 }],
    ['POST', '/api/render', { text: '# a', path: 42 }],
    ['POST', '/api/render', { text: '# a', pages: true, path: {} }],
    ['POST', '/api/slides', { text: ['# a'] }],
    ['PUT', '/api/file', { path: 'note.md', text: 'x', baseMtime: 'yesterday' }],
    ['POST', '/api/new', { name: 42 }],
    ['POST', '/api/rename', { moves: [null] }],
    ['POST', '/api/extract', { path: 'note.md', text: '', files: [null] }],
    ['POST', '/api/unextract', { path: 'note.md', text: '', mtime: 'then' }],
  ];
  for (const [method, url, body] of bad) {
    const res = await json(method, url, body);
    assert.equal(res.status, 400, `${url} ${JSON.stringify(body)}`);
    assert.equal(typeof (await res.json()).error, 'string');
  }
  for (const url of ['/content/%E0%A4%A', '/content/%', '/%E0%A4%A']) {
    assert.equal((await fetch(base + url)).status, 400, url);
  }
  const net = await import('node:net');
  for (const target of ['http://[', '//%zz', '/a%zz']) {
    const reply = await new Promise((resolve, reject) => {
      const socket = net.connect(server.address().port, '127.0.0.1');
      let got = '';
      socket.on('data', (c) => (got += c));
      socket.on('end', () => resolve(got));
      socket.on('error', reject);
      socket.end(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    assert.match(reply, /^HTTP\/1\.1 400 /, target);
  }
});

test('exports a document as one HTML file, its images inside it', async () => {
  fs.writeFileSync(path.join(root, 'dot.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  fs.writeFileSync(path.join(root, 'out.md'), '---\ntitle: Out & about\nbackground: dot.png navy\n---\n\n![a dot](dot.png)\n\n![far](https://example.com/far.png)\n');
  const res = await fetch(`${base}/api/export?path=out.md`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(res.headers.get('content-disposition'), `attachment; filename="out.html"; filename*=UTF-8''out.html`);
  const html = await res.text();
  assert.match(html, /<title>Out &amp; about<\/title>/);
  assert.match(html, /<style>[\s\S]*--gm-aside-col/);
  assert.match(html, /<img src="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(html, /background-image: url\(&quot;data:image\/png;base64,iVBORw0KGgo=&quot;\)/);
  assert.match(html, /<img src="https:\/\/example\.com\/far\.png"/);
  assert.doesNotMatch(html, /data-line=/);

  fs.writeFileSync(path.join(root, 'chart.md'), '```mermaid\ngraph TD\n```\n');
  const drawn = await json('POST', '/api/export', { path: 'chart.md', drawn: { mermaid: { 'graph TD': '<svg id="m1"></svg>' } } });
  assert.equal(drawn.status, 200);
  assert.match(drawn.headers.get('content-disposition'), /filename="chart\.html"/);
  assert.match(await drawn.text(), /<div class="mermaid drawn"><pre>[\s\S]*<\/pre><div class="mermaid-figure" role="img" aria-label="Diagram"><svg id="m1"><\/svg><\/div><\/div>/);
  assert.doesNotMatch(await (await fetch(`${base}/api/export?path=chart.md`)).text(), /mermaid-figure"/);
  assert.equal((await json('POST', '/api/export', { path: 'doc.pdf' })).status, 400);

  assert.equal((await fetch(`${base}/api/export?path=doc.pdf`)).status, 400);
  assert.equal((await fetch(`${base}/api/export?path=gone.md`)).status, 404);
  assert.equal((await fetch(`${base}/api/export?path=${encodeURIComponent('../x.md')}`)).status, 400);
});

test('serves content files sandboxed, so their scripts never run as the app', async () => {
  for (const file of ['page.html', 'pic.svg', 'note.md']) {
    const res = await fetch(`${base}/content/${file}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-security-policy'), 'sandbox', file);
  }
  const pdf = await fetch(`${base}/content/doc.pdf`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-security-policy'), null);
});

test('a script in the content directory is served as text, for this origin only', async () => {
  fs.writeFileSync(path.join(root, 'config.js'), 'window.token = "secret";\n');
  const res = await fetch(`${base}/content/config.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/plain/);
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(await res.text(), 'window.token = "secret";\n');
  for (const url of ['/api/tree', '/content/page.html', '/content/doc.pdf']) {
    assert.equal((await fetch(base + url)).headers.get('cross-origin-resource-policy'), 'same-origin', url);
  }
  // The app's own files are its own; the frames load theirs from their own origin (gh-206).
  for (const url of ['/', '/app/main.js', '/style.css', '/preview.js', '/frames.js']) {
    assert.equal((await fetch(base + url)).headers.get('cross-origin-resource-policy'), 'same-origin', url);
  }
  // What a preview frame, another origin's and opaque besides, loads of the app's: a note's images.
  fs.writeFileSync(path.join(root, 'dot.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  assert.equal((await fetch(base + '/content/dot.png')).headers.get('cross-origin-resource-policy'), null);
});

test("another site's page can't ask for the API or the user's files, but a link from it opens them", async () => {
  fs.writeFileSync(path.join(root, 'config.js'), 'window.token = "secret";\n');
  fs.writeFileSync(path.join(root, 'dot.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  // Not by fetch(), which sets Sec-Fetch-Mode itself.
  const ask = (url, headers, method = 'GET') => new Promise((resolve, reject) => {
    http.request(base + url, { method, headers }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject).end(method === 'POST' ? '{}' : undefined);
  });
  const from = (site, mode, dest) => ({ 'Sec-Fetch-Site': site, 'Sec-Fetch-Mode': mode, 'Sec-Fetch-Dest': dest });
  for (const site of ['cross-site', 'same-site']) {
    assert.equal(await ask('/content/config.js', from(site, 'no-cors', 'script')), 403, site);
    assert.equal(await ask('/content/note.md', from(site, 'no-cors', 'style')), 403, site);
    assert.equal(await ask('/api/tree', from(site, 'cors', 'empty')), 403, site);
    assert.equal(await ask('/api/file?path=note.md', from(site, 'no-cors', 'script')), 403, site);
    assert.equal(await ask('/content/doc.pdf', from(site, 'navigate', 'iframe')), 403, site);
    assert.equal(await ask('/api/render', { ...from(site, 'cors', 'empty'), 'Content-Type': 'application/json' }, 'POST'), 403, site);
    // A link followed from elsewhere, to the app, a line, or a file.
    assert.equal(await ask('/', from(site, 'navigate', 'document')), 200, site);
    assert.equal(await ask('/content/doc.pdf', from(site, 'navigate', 'document')), 200, site);
    assert.equal(await ask('/content/doc.pdf', from(site, 'navigate', 'document'), 'HEAD'), 200, site);
  }
  // The preview frames are another origin, by name (cross-site) or by port (same-site), and ask for a note's images.
  for (const site of ['cross-site', 'same-site']) {
    assert.equal(await ask('/content/dot.png', from(site, 'no-cors', 'image')), 200, site);
  }
  // The app itself, a page typed in, and a client that doesn't say.
  assert.equal(await ask('/content/config.js', from('same-origin', 'no-cors', 'script')), 200);
  assert.equal(await ask('/api/tree', from('same-origin', 'cors', 'empty')), 200);
  assert.equal(await ask('/content/config.js', from('none', 'navigate', 'document')), 200);
  assert.equal(await ask('/api/tree', {}), 200);
});

test('the preview loads a script for each kind of puzzle and each feature that has one', async () => {
  const html = await (await fetch(frames + '/preview.html')).text();
  assert.match(html, /<script src="\/features\/puzzles\/preview\.js"><\/script>/);
  for (const kind of ['sudoku', 'tracks', 'wordsearch', 'coord', 'maze']) {
    assert.match(html, new RegExp(`<script src="/features/puzzles/kinds/${kind}\\.js"></script>`));
    assert.equal((await fetch(`${frames}/features/puzzles/kinds/${kind}.js`)).status, 200);
  }
  // The core comes before the kinds that register with it.
  assert.ok(html.indexOf('/features/puzzles/preview.js') < html.indexOf('/features/puzzles/kinds/'));
  for (const name of ['fields', 'tasks', 'qa']) {
    assert.match(html, new RegExp(`<script src="/features/${name}/preview\\.js"></script>`));
    const res = await fetch(`${frames}/features/${name}/preview.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
  }
  assert.doesNotMatch(html, /<!-- scripts -->/);
  // Only the scripts features name are served from there.
  for (const other of ['/features/fields/index.js', '/features/qa/index.js', '/features/index.js', '/features/puzzles/index.js', '/puzzles/sudoku.js']) {
    assert.equal((await fetch(frames + other)).status, 404, other);
  }
  // Nor from the app, whose page loads none of them.
  assert.equal((await fetch(`${base}/features/qa/preview.js`)).status, 404);
});

test('each page says what it may load: its own scripts only, nothing inline', async () => {
  const policy = async (url) => (await fetch((url === '/preview.html' ? frames : base) + url)).headers.get('content-security-policy');
  for (const page of ['/', '/speaker.html', '/preview.html']) {
    const csp = await policy(page);
    assert.match(csp, /default-src 'none'/, page);
    assert.match(csp, /script-src 'self'(;|$)/, page);
    assert.match(csp, /object-src 'none'/, page);
  }
  assert.match(await policy('/'), /frame-ancestors 'none'/);
  assert.match(await policy('/'), /style-src 'self'(;|$)/);
  assert.match(await policy('/preview.html'), new RegExp(`frame-ancestors ${base}(;|$)`));
  assert.match(await policy('/preview.html'), /style-src 'self' 'unsafe-inline'/);
  const print = await policy('/print.html');
  assert.match(print, /default-src 'none'/);
  assert.doesNotMatch(print, /script-src/);
  assert.match(print, /style-src 'unsafe-inline'/);
  for (const page of ['index.html', 'speaker.html', 'preview.html', 'print.html']) {
    const html = await (await fetch(`${page === 'preview.html' ? frames : base}/${page}`)).text();
    assert.doesNotMatch(html, /<script>|<script(?![^>]*\bsrc=)[^>]*>|\son[a-z]+=/i, `${page} has no inline script`);
  }
});

// What the server answers on `port` for `path`, asked by the name `host`.
const asking = (port, host, path, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path, method, headers: { Host: host, ...headers } }, (res) => {
    let text = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { text += c; });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text }));
  });
  req.on('error', reject);
  req.end(body);
});

// Where a page of the app's is told its frames are, and what its policy lets it frame and ask.
async function told(port, host, page) {
  const { body, headers } = await asking(port, host, page);
  const meta = /<meta name="frames"(?: data-name="([^"]+)")? data-port="([^"]+)">/.exec(body);
  const csp = headers['content-security-policy'];
  const directive = (name) => new RegExp(`(?:^|; )${name} ([^;]*)`).exec(csp)?.[1];
  return { name: meta[1], port: meta[2], frameSrc: directive('frame-src'), connectSrc: directive('connect-src') };
}

test('at a loopback name, the app is told its frames are frames.localhost on its own port, else their second port (gh-206)', async () => {
  const port = server.address().port;
  const second = new URL(frames).port;
  for (const name of ['127.0.0.1', 'localhost']) {
    const app = await told(port, `${name}:${port}`, '/');
    assert.equal(app.name, `http://frames.localhost:${port}`, name);
    assert.equal(app.port, `http://${name}:${second}`, name);
    assert.equal(app.frameSrc, `'self' ${app.name} ${app.port}`, name);
    // To ask whether the name answers, and nothing more.
    assert.equal(app.connectSrc, `'self' ${app.name}`, name);
    const speaker = await told(port, `${name}:${port}`, '/speaker.html');
    assert.equal(speaker.frameSrc, `${app.name} ${app.port}`, name);
    assert.equal(speaker.connectSrc, app.name, name);
  }
  // At any other name, only the second port, at that name.
  const lan = createServer({ root, allowHosts: ['my-nas'] });
  await new Promise((r) => lan.server.listen(0, '127.0.0.1', r));
  try {
    const at = lan.server.address().port;
    const frameAt = await listenFrames(lan);
    const app = await told(at, `my-nas:${at}`, '/');
    assert.equal(app.name, undefined);
    assert.equal(app.port, `http://my-nas:${frameAt}`);
    assert.equal(app.frameSrc, `'self' http://my-nas:${frameAt}`);
    assert.equal(app.connectSrc, "'self'");
    const preview = await asking(frameAt, `my-nas:${frameAt}`, '/preview.html');
    assert.match(preview.headers['content-security-policy'], new RegExp(`frame-ancestors http://my-nas:${at}(;|$)`));
    assert.equal((await asking(frameAt, `evil.example:${frameAt}`, '/preview.html')).status, 403);
  } finally {
    await new Promise((r) => lan.server.close(r));
  }
});

test('the preview frames\' origin, by name or by port, serves what a frame loads and nothing else (gh-206)', async () => {
  const port = server.address().port;
  const second = new URL(frames).port;
  const ways = {
    name: { at: port, host: `frames.localhost:${port}`, app: `http://127.0.0.1:${port} http://localhost:${port}` },
    port: { at: second, host: `127.0.0.1:${second}`, app: base },
  };
  for (const [via, { at, host, app }] of Object.entries(ways)) {
    const get = (url, opts) => asking(at, host, url, opts);
    const preview = await get('/preview.html');
    assert.equal(preview.status, 200, via);
    // Only the app may frame it, at either loopback name by name; not [::1], which a policy can't name.
    const csp = preview.headers['content-security-policy'];
    assert.match(csp, new RegExp(`frame-ancestors ${app}(;|$)`), via);
    assert.match(csp, new RegExp(`base-uri ${app};`), via);
    assert.match(csp, /script-src 'self';/, via);
    // And it's told the same, to know the app's messages by.
    assert.match(preview.body, new RegExp(`<meta name="app" content="${app}">`), via);
    assert.equal((await get('/preview.html', { method: 'HEAD' })).status, 200, via);
    // Opaque frames load its files too, so they're for anyone.
    for (const url of ['/preview.js', '/preview.css', '/preview-api.js', '/spoken.js', '/tone.js', '/ink.js',
      '/features/qa/preview.js', '/features/mermaid/vendor/mermaid.min.js']) {
      const res = await get(url, { method: 'HEAD' });
      assert.equal(res.status, 200, `${via} ${url}`);
      assert.equal(res.headers['cross-origin-resource-policy'], undefined, `${via} ${url}`);
    }
    for (const url of ['/', '/index.html', '/speaker.html', '/print.html', '/style.css', '/app/main.js', '/theme.js', '/frames.js',
      '/views.js', '/vendor/pdf.min.mjs', '/api/tree', '/api/info', '/api/file?path=note.md', '/content/note.md', '/content/pic.svg',
      '/api/export?path=note.md', '/features/qa/index.js', '/../package.json', '/%2e%2e/package.json']) {
      assert.equal((await get(url)).status, 404, `${via} ${url}`);
    }
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const res = await get('/api/file', { method, headers: { 'Content-Type': 'application/json' }, body: '{"path":"note.md","text":"x"}' });
      assert.equal(res.status, 405, `${via} ${method}`);
    }
  }
  assert.notEqual(fs.readFileSync(path.join(root, 'note.md'), 'utf8'), 'x');
  // A frame's request to the app's API is cross-site by name, same-site by port, and refused either way.
  for (const [site, origin] of [['cross-site', `http://frames.localhost:${port}`], ['same-site', frames]]) {
    const headers = { Origin: origin, 'Sec-Fetch-Site': site, 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' };
    assert.equal((await asking(port, `127.0.0.1:${port}`, '/api/tree', { headers })).status, 403, site);
    const put = await asking(port, `127.0.0.1:${port}`, '/api/file', {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{"path":"note.md","text":"x"}',
    });
    assert.equal(put.status, 403, site);
  }
  // The app serves the preview no longer.
  assert.equal((await fetch(base + '/preview.html')).status, 404);
});

test('published on other ports, the frames\' port keeps its distance from the app\'s (gh-206)', async () => {
  const port = server.address().port;
  const apart = Number(new URL(frames).port) - port;
  const app = await told(port, 'localhost:9000', '/');
  assert.equal(app.name, 'http://frames.localhost:9000');
  assert.equal(app.port, `http://localhost:${9000 + apart}`);
  const preview = await asking(Number(new URL(frames).port), `localhost:${9000 + apart}`, '/preview.html');
  assert.match(preview.headers['content-security-policy'], /frame-ancestors http:\/\/localhost:9000(;|$)/);
});

test('[::1] is sent on to 127.0.0.1, the same port and address, since a policy can\'t name it (gh-206)', async () => {
  const port = server.address().port;
  for (const [path, method] of [['/', 'GET'], ['/#notes/a.md', 'GET'], ['/api/tree?x=1', 'GET'], ['/api/file', 'PUT']]) {
    const res = await asking(port, `[::1]:${port}`, path, { method });
    assert.equal(res.status, 307, path);
    assert.equal(res.headers.location, `http://127.0.0.1:${port}${path.replace(/#.*/, '')}`, path);
  }
});

test('the frames\' port closes with the app\'s', async () => {
  const made = createServer({ root });
  await new Promise((r) => made.server.listen(0, '127.0.0.1', r));
  await listenFrames(made);
  assert.ok(made.frames.listening);
  await new Promise((r) => made.server.close(r));
  assert.equal(made.frames.listening, false);
});

test('a page is served only by its own name, so no spelling of it comes without its policy', async () => {
  for (const url of ['/PREVIEW.HTML', '/Preview.html', '/INDEX.HTML', '/Speaker.html', '/APP/main.js']) {
    const res = await fetch(base + url);
    assert.equal(res.status, 404, url);
    assert.equal((await fetch(frames + url)).status, 404, url);
  }
  assert.equal((await fetch(frames + '/preview.html')).status, 200);
});

test('a request addressed to another host is refused, unless the server was started with its name', async () => {
  const ask = (port, host) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/api/info', headers: { Host: host } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject);
  });
  assert.equal(await ask(server.address().port, 'my-nas:8734'), 403);
  const named = createServer({ root, allowHosts: ['My-NAS'] }).server;
  await new Promise((r) => named.listen(0, '127.0.0.1', r));
  try {
    assert.equal(await ask(named.address().port, 'my-nas:8734'), 200);
    assert.equal(await ask(named.address().port, 'localhost'), 200);
    assert.equal(await ask(named.address().port, 'evil.example'), 403);
  } finally {
    named.close();
  }
});

test('a save of what a record\'s inputs wrote is refused a day after it closed, and what\'s typed into it never is', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-record-'));
  const text = '---\nopen-until: 2026-10-28 04:00\n---\n\n- [ ] a\n';
  fs.writeFileSync(path.join(dir, 'day.md'), text);
  let clock = new Date(2026, 9, 29, 3, 59).getTime();
  const own = createServer({ root: dir, now: () => clock }).server;
  await new Promise((r) => own.listen(0, '127.0.0.1', r));
  const put = async (body) => {
    const { mtime } = await (await fetch(`http://127.0.0.1:${own.address().port}/api/file?path=day.md`)).json();
    return fetch(`http://127.0.0.1:${own.address().port}/api/file`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'day.md', baseMtime: mtime, ...body }),
    });
  };
  try {
    // Closed, but within the day's grace, for a server whose zone isn't the reader's.
    assert.equal((await put({ text: text.replace('[ ]', '[x]'), worked: true })).status, 200);
    clock = new Date(2026, 9, 29, 4, 0).getTime();
    const refused = await put({ text, worked: true });
    assert.equal(refused.status, 423);
    assert.match((await refused.json()).error, /day\.md is a record/);
    assert.match(fs.readFileSync(path.join(dir, 'day.md'), 'utf8'), /\[x\]/);
    assert.equal((await put({ text: `${text}\nA note, after.\n` })).status, 200, 'typed into the file');
    // A page without a time is never a record.
    assert.equal((await put({ text: '- [x] a\n', worked: true })).status, 200);
  } finally {
    own.close();
  }
});
