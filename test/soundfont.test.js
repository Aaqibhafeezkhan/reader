import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { note, cacheDir, NOTE } from '../src/soundfont.js';
import { createServer, listenFrames } from '../src/server.js';

const NOTE_BYTES = Buffer.from('ID3 a note');

/** A website that answers each note with `bytes`, or fails, counting what it was asked. */
function website({ fails = false, bytes = NOTE_BYTES } = {}) {
  const asked = [];
  const get = async (url) => {
    asked.push(url);
    if (fails) throw new Error('getaddrinfo ENOTFOUND');
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  };
  return { asked, get };
}

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'reader-notes-'));

test('a note is fetched from abcjs\'s sound fonts the first time, and kept, so it\'s never fetched again', async () => {
  const dir = scratch();
  const site = website();
  assert.deepEqual(await note('/soundfont/acoustic_grand_piano-mp3/Db4.mp3', { dir, get: site.get }), NOTE_BYTES);
  assert.deepEqual(await note('/soundfont/acoustic_grand_piano-mp3/Db4.mp3', { dir, get: site.get }), NOTE_BYTES);
  assert.deepEqual(site.asked, ['https://paulrosen.github.io/midi-js-soundfonts/abcjs/acoustic_grand_piano-mp3/Db4.mp3']);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'soundfont', 'acoustic_grand_piano-mp3')), ['Db4.mp3'], 'nothing half written is left');
});

test('offline, a note not kept says it needs the network, and nothing is kept', async () => {
  const dir = scratch();
  await assert.rejects(note('/soundfont/acoustic_grand_piano-mp3/C4.mp3', { dir, get: website({ fails: true }).get }), { status: 502, message: /needs the network/ });
  assert.equal(fs.existsSync(path.join(dir, 'soundfont')), false);
  await assert.rejects(note('/soundfont/acoustic_grand_piano-mp3/C4.mp3', { dir, get: website({ bytes: Buffer.alloc(0) }).get }), { status: 502 });
});

test('only a note\'s name is a note: nothing else is asked of the website', async () => {
  const site = website();
  for (const route of ['/soundfont/../x-mp3/C4.mp3', '/soundfont/piano-mp3/H4.mp3', '/soundfont/piano-mp3/C4.wav', '/soundfont/Piano-mp3/C4.mp3', '/soundfont/piano-mp3/C44.mp3', '/soundfont/a%2Fb-mp3/C4.mp3']) {
    assert.equal(NOTE.test(route), false, route);
    await assert.rejects(note(route, { dir: scratch(), get: site.get }), { status: 404 }, route);
  }
  assert.deepEqual(site.asked, []);
});

test('the cache is where each system keeps an app\'s, unless READER_CACHE says', () => {
  assert.equal(cacheDir({}, 'darwin', '/Users/a'), '/Users/a/Library/Caches/reader');
  assert.equal(cacheDir({}, 'linux', '/home/a'), '/home/a/.cache/reader');
  assert.equal(cacheDir({ XDG_CACHE_HOME: '/c' }, 'linux', '/home/a'), '/c/reader');
  assert.equal(cacheDir({ LOCALAPPDATA: 'C:\\L' }, 'win32', 'C:\\U'), 'C:\\L\\reader\\Cache');
  assert.equal(cacheDir({ READER_CACHE: '/r' }, 'darwin', '/Users/a'), '/r');
});

let server, frames, site;
before(async () => {
  site = website();
  const made = createServer({ root: scratch(), soundfont: { dir: scratch(), get: site.get } });
  ({ server } = made);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  frames = `http://127.0.0.1:${await listenFrames(made)}`;
});
after(() => server.close());

test('the frames serve a note with headers that let the browser keep it, and the frame may ask its own server only', async () => {
  const res = await fetch(`${frames}/soundfont/acoustic_grand_piano-mp3/E4.mp3`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'audio/mpeg');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), NOTE_BYTES);
  assert.equal((await fetch(`${frames}/soundfont/piano-mp3/E9.mp3`)).status, 404);
  const csp = (await fetch(`${frames}/preview.html`)).headers.get('content-security-policy');
  assert.match(csp, /connect-src 'self'(;|$)/);
});
