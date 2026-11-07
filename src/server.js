/**
 * HTTP API and static files.
 *
 *   GET  /api/info             content root and name, and reader's version: { label, url, release }
 *   GET  /api/tree             listable files, newest first, each with its date; today's date; and the folders today's file could be started in
 *   GET  /api/start-day?dir=   { from, to, mtime, css, body }: the folder's latest file, drawn whole and open, to clear its answers
 *   POST /api/start-day        { dir, from, mtime, edits } -> { path, from, mtime }: today's file, made from it with `edits` made
 *   GET  /api/copy?path=&today=&clear=   { from, to, mtime, date }: what a copy of it would be called, today's if `today` and it's dated; with `clear`, drawn whole and open as above, { css, body }
 *   POST /api/copy             { path, mtime, edits, today? } -> { path, from, mtime }: and made, with `edits` made
 *   GET  /api/file?path=       { text, mtime }
 *   PUT  /api/file             { path, text, baseMtime, force?, explicit?, worked? }
 *   POST /api/new              { name? }
 *   POST /api/branch           { from, to } -> a copy of a document, as another version
 *   POST /api/promote          { path, base } -> { path, moved: [{ from, to }] }
 *   POST /api/rename           { moves: [{ from, to }] } -> { moved }
 *   POST /api/trash            { path } -> { path, trash }: set aside in .reader/trash/
 *   POST /api/restore          { trash } -> { path }: and back
 *   GET  /api/export?path=     the document as one HTML file, to save
 *   POST /api/export           { path, drawn? } -> the same, with what the preview frame drew set into it
 *   POST /api/render           { text, path? } -> { css, body, title, deck }
 *                              { text, path?, pages: true } -> for a deck, { css, title, deck, pages: [{ body, line }] }
 *   POST /api/slides           { text, path? } -> { css, title, slides: [{ body, notes, notesHtml, line, at, budget, plan, transition }], end }
 *   GET  /content/<path>       raw bytes (PDFs, images a note links to)
 *
 * Local unless told otherwise: the server refuses requests whose Host isn't
 * loopback, or a name it was started with (`allowHosts`), which is what
 * stops DNS rebinding; and mutating requests that aren't JSON (a cross-site form post
 * can't set that content type without a CORS preflight, which we never
 * answer).
 *
 * Nor another site's page: a request it makes says so (Sec-Fetch-Site), and
 * one for the API or a file of the user's is refused (`foreign`), and every
 * response but a note's images, which the preview shows, says it's for this
 * origin only (Cross-Origin-Resource-Policy), for a browser that doesn't say.
 * Else a page anywhere could load a note's .js as a script and read what it set.
 *
 * The preview frames have an origin of their own, apart from the app's, which
 * serves what a frame loads and nothing else: preview.html, its scripts and
 * styles, and the scripts features draw into it (`serveFrame`). At a loopback
 * name it's `frames.localhost` on the app's own port, told apart by Host:
 * another site, so another process and other cookies. Where that name can't be
 * had (Safari asks the system, which doesn't know it; the app opened by a
 * network name), it's a second listener, `frames`, on a port of its own: the
 * same site as the app, so it would be sent the app's cookies. The app must
 * never use cookies. The page finds out which it can have (static/frames.js).
 *
 * Files from the content directory are served sandboxed: an HTML or SVG file
 * there, opened from a link in a note, would otherwise run its scripts as
 * this app and could read and write every file through the API.
 *
 * Each page has a Content-Security-Policy (PAGE_POLICIES): no page runs an
 * inline script, so markup that slipped into a rendered note couldn't either.
 *
 * A save that carries what the page's own inputs wrote (`worked`: a box
 * ticked, a field filled in) is refused, 423, once the page has been a
 * record for a day: past the time its front matter says it's open until
 * (features/open-until). The page shuts itself by the reader's clock; this
 * is only a backstop, a day late, so a server whose clock or zone isn't
 * the reader's (a container that has lost its TZ runs on UTC) errs towards
 * open. A save of what was typed into the file is never refused.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContent, DOC_EXTS, PathError } from './content.js';
import { today } from './dates.js';
import { render } from './render.js';
import { extract, closesAt } from './page.js';
import { slides, pages, isDeck } from './slides.js';
import { exportHtml } from './export.js';
import { version } from './version.js';
import { FEATURES } from '../features/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STATIC_DIR = path.join(HERE, '..', 'static');
// The name each static file has on disk, which a case-insensitive disk would
// otherwise let a request spell any way it likes.
const STATIC_REAL = fs.realpathSync.native(STATIC_DIR);

const MAX_BODY = 20 * 1024 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
  '.markdown': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

// The scripts features draw into the preview frame, in order, and those it
// loads when it needs them, served from their own directories, and nothing
// else from there.
const FEATURES_DIR = fileURLToPath(new URL('../features/', import.meta.url));
const served = (key) => FEATURES.flatMap((f) => [f[key] ?? []].flat())
  .map((file) => [`/features/${path.relative(FEATURES_DIR, file).split(path.sep).join('/')}`, file]);
const FEATURE_SCRIPTS = new Map([...served('preview'), ...served('lazy')]);
const PREVIEW_SCRIPTS = served('preview').map(([src]) => `<script src="${src}"></script>`).join('\n');

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

// The preview frames' name, on the app's port. Chromium and Electron take any
// .localhost name as this machine, without asking DNS.
export const FRAME_HOST = 'frames.localhost';

// What the frames' origin serves of static/ besides preview.html: what it names.
const PREVIEW_HTML = path.join(STATIC_DIR, 'preview.html');
const FRAME_FILES = new Set([...fs.readFileSync(PREVIEW_HTML, 'utf8').matchAll(/\s(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]));

// What each field of a request's body must be, when it's there at all.
const FIELDS = {
  text: 'string', path: 'string', dir: 'string', name: 'string', from: 'string', to: 'string', base: 'string', trash: 'string',
  baseMtime: 'number', mtime: 'number', worked: 'boolean', today: 'boolean',
};

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// How long after a page closes its inputs' writes are still taken.
const GRACE = 24 * 60 * 60 * 1000;

function decode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    throw badRequest('malformed address');
  }
}

// What each page may load. Nothing inline runs anywhere: every script is a
// file of the app's own. The preview may take inline styles, since the
// rendered document brings its own (the theme, a ::: block's colors, an
// image's size), and images from anywhere a note points; it fetches
// nothing, and only the app may frame it, from the frames' own origin
// (`frame-ancestors` and `base-uri` there name the app's). It frames one
// thing itself: YouTube's player, from its no-cookie site, for a video's
// card (features/social). Neither the app nor the speaker view may be framed
// at all; they frame the preview from its origin, and may ask whether its
// name answers (`framing`). The page a document is printed from takes the
// exported file written into it, which brings its styles and images inline
// and runs nothing.
const POLICY = (directives) => Object.entries(directives).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join('; ');
const LOCKED = {
  'default-src': "'none'",
  'base-uri': "'none'",
  'form-action': "'none'",
  'object-src': "'none'",
};
const PAGE_POLICIES = {
  'index.html': {
    ...LOCKED,
    'script-src': "'self'",
    'style-src': "'self'",
    'img-src': "'self' data:",
    'font-src': "'self' data:",
    'connect-src': "'self'",
    'frame-src': "'self'",
    'worker-src': "'self'",
    'frame-ancestors': "'none'",
  },
  'speaker.html': {
    ...LOCKED,
    'script-src': "'self'",
    'style-src': "'self'",
    'img-src': "'self' data:",
    'frame-ancestors': "'none'",
  },
  // At the frames' origin, where `base-uri` (a note's links and images
  // resolve from the app's content directory) and `frame-ancestors` are the
  // app's origins (serveFrame).
  'preview.html': {
    ...LOCKED,
    'script-src': "'self'",
    'style-src': "'self' 'unsafe-inline'",
    'img-src': '* data: blob:',
    'font-src': "'self' data:",
    'frame-src': 'https://www.youtube-nocookie.com',
    'frame-ancestors': "'none'",
  },
  'print.html': {
    ...LOCKED,
    'style-src': "'unsafe-inline'",
    'img-src': 'data:',
    'font-src': 'data:',
    'frame-ancestors': "'self'",
  },
};

// Any other page runs nothing and can't be framed.
const UNLISTED_PAGE = { ...LOCKED, 'frame-ancestors': "'none'" };

// A script in the content directory is served as text, never to be run: no
// page loads one, and any page could otherwise run it and read what it set.
const CONTENT_TYPES = { ...TYPES, '.js': TYPES['.txt'], '.mjs': TYPES['.txt'] };

// Whether a request is another site's to refuse. A link followed from
// anywhere (a message, a bookmark, another device's copy of a line's address)
// is a top-level visit, which that site can't read, and is let through. The
// preview frames are another origin, and sandboxed besides, so what they ask
// of the app is cross-site, or same-site from the frames' port, with no
// Referer to tell it from anyone else's: all they need of it is a note's
// images. What's refused is the rest: the API, and the user's files asked
// for by anything but a visit or an image. The frames' own files are their
// origin's, never the app's.
function foreign(req, route) {
  const meta = (name) => req.headers[`sec-fetch-${name}`];
  if ([undefined, 'none', 'same-origin'].includes(meta('site'))) return false;
  const visit = ['GET', 'HEAD'].includes(req.method) && meta('mode') === 'navigate' && meta('dest') === 'document';
  if (visit) return false;
  if (route.startsWith('/api/')) return true;
  if (route.startsWith('/content/')) return meta('dest') !== 'image';
  return false;
}

// No scripts, no forms, and an opaque origin, for anything opened straight
// from /content/. PDFs are left out: browsers won't show one in a sandbox,
// and a PDF can't reach the API anyway.
const CONTENT_SANDBOX = { 'Content-Security-Policy': 'sandbox' };

/**
 * `now` is the clock a record is judged by. `server` is the app; `frames`,
 * the preview frames' second port, listens once it does (`listenFrames`), and
 * closes with it.
 */
export function createServer({ root, allowHosts = [], now = Date.now, dayStarts = 0 }) {
  const content = createContent(root);
  // Which reader this is, worked out now, while nothing's waiting on it.
  const known = version();
  const hosts = new Set([...LOOPBACK, ...allowHosts.map((h) => h.toLowerCase())]);

  const listener = (handler) => http.createServer(async (req, res) => {
    // For this origin only, unless what's sent is for the preview (`open`).
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    try {
      await handler(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      sendJson(res, { error: err.message, mtime: err.mtime }, status);
    }
  });
  const server = listener(handle);
  const frames = listener((req, res) => {
    if (!hosts.has(nameOf(req))) return send(res, 403, 'forbidden host', 'text/plain');
    return serveFrame(open(res), req, 'port');
  });
  server.on('close', () => frames.close());

  // The frames' port is as far from the app's as the browser sees them as it
  // is here, so both can be published elsewhere together (Docker's -p).
  const apart = () => (frames.address()?.port ?? 0) - server.address().port;

  // Where the preview frames are for a page of the app's at `req`: `name`, at
  // a loopback name only, and `port`.
  function framesFor(req) {
    const host = nameOf(req);
    const port = portOf(req);
    return {
      name: LOOPBACK.has(host) ? `http://${FRAME_HOST}:${port}` : null,
      port: `http://${host}:${port + apart()}`,
    };
  }

  // The app's origins, which alone may frame a preview served at `req`.
  // Not [::1], which a policy can't name: the app sends it on to 127.0.0.1.
  function appFor(req, via) {
    if (via === 'name') return ['127.0.0.1', 'localhost'].map((name) => `http://${name}:${portOf(req)}`);
    return [`http://${nameOf(req)}:${portOf(req) - apart()}`];
  }

  // What a preview frame loads, from the frames' own origin, `via` its name
  // or its port; nothing else is there. Opaque frames load it too, so it goes
  // without CORP.
  function serveFrame(res, req, via) {
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, 'method not allowed', 'text/plain');
    const route = routeOf(req);
    if (route === '/preview.html') {
      const app = appFor(req, via).join(' ');
      const html = fs.readFileSync(PREVIEW_HTML, 'utf8')
        .replace('<!-- scripts -->', PREVIEW_SCRIPTS)
        .replace('<!-- app -->', `<meta name="app" content="${app}">`);
      const policy = { ...PAGE_POLICIES['preview.html'], 'base-uri': app, 'frame-ancestors': app };
      return send(res, 200, html, TYPES['.html'], { 'Content-Security-Policy': POLICY(policy) });
    }
    if (FEATURE_SCRIPTS.has(route)) return sendFile(res, FEATURE_SCRIPTS.get(route));
    if (FRAME_FILES.has(route)) return sendFile(res, path.join(STATIC_DIR, route.slice(1)));
    return send(res, 404, 'not found', 'text/plain');
  }

  // A puzzle's board kept in a file of its own, read from the content root.
  const read = (rel) => content.read(rel).text;

  async function handle(req, res) {
    const host = nameOf(req);
    if (host === FRAME_HOST) return serveFrame(open(res), req, 'name');
    if (!hosts.has(host)) return send(res, 403, 'forbidden host', 'text/plain');

    const url = urlOf(req);
    const route = url.pathname;
    // The same machine, by the one loopback name a policy can't name; by
    // localhost, which is ::1 too, when that's all that's listened on.
    if (host === '[::1]') {
      const to = server.address().address === '::1' ? 'localhost' : '127.0.0.1';
      return send(res, 307, '', 'text/plain', { Location: `http://${to}:${portOf(req)}${route}${url.search}` });
    }
    if (foreign(req, route)) return send(res, 403, 'cross-site request refused', 'text/plain');

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (route === '/api/info') {
        return sendJson(res, { root: content.root, name: path.basename(content.root), version: await known });
      }
      if (route === '/api/tree') {
        const day = today(now, dayStarts);
        return sendJson(res, { files: content.dated(), today: day, starts: content.startable(day) });
      }
      if (route === '/api/start-day') {
        const { text, ...start } = content.startFrom(url.searchParams.get('dir') ?? '', today(now, dayStarts));
        // Drawn from the start of time, so never as a record, past the time
        // it was open until, which shows answers but has nothing to clear them.
        const { css, body } = render(text, { file: start.from, read, lines: true, now: 0 });
        return sendJson(res, { ...start, css, body });
      }
      if (route === '/api/copy') {
        const ask = url.searchParams;
        const { text, ...plan } = content.copyFrom(ask.get('path'), ask.get('today') ? today(now, dayStarts) : null);
        if (!ask.get('clear')) return sendJson(res, plan);
        // Drawn as Start today's draws one, never as a record.
        const { css, body } = render(text, { file: plan.from, read, lines: true, now: 0 });
        return sendJson(res, { ...plan, css, body });
      }
      if (route === '/api/file') return sendJson(res, content.read(url.searchParams.get('path')));
      if (route === '/api/export') return sendExport(res, url.searchParams.get('path') || '');
      if (route.startsWith('/content/')) {
        const rel = decode(route.slice('/content/'.length));
        const { abs } = content.statFile(rel);
        const ext = path.extname(abs).toLowerCase();
        const type = CONTENT_TYPES[ext] || 'application/octet-stream';
        if (type.startsWith('image/')) open(res);
        return send(res, 200, fs.readFileSync(abs), type, ext === '.pdf' ? {} : CONTENT_SANDBOX);
      }
      return serveStatic(res, route);
    }

    if (!['POST', 'PUT'].includes(req.method)) return send(res, 405, 'method not allowed', 'text/plain');
    if (!(req.headers['content-type'] || '').startsWith('application/json')) {
      return send(res, 415, 'expected application/json', 'text/plain');
    }
    const body = await readJson(req);
    for (const [field, type] of Object.entries(FIELDS)) {
      if (body[field] != null && typeof body[field] !== type) throw badRequest(`${field} must be a ${type}`);
    }

    if (route === '/api/render' && req.method === 'POST') {
      // A deck being worked through is drawn a page to a slide.
      if (body.pages && isDeck(body.text)) {
        const { css, title, pages: list } = pages(body.text, { file: body.path, read });
        if (list.length) return sendJson(res, { css, title, pages: list, deck: true });
      }
      return sendJson(res, { ...render(body.text, { file: body.path, read, lines: true }), deck: isDeck(body.text) });
    }
    if (route === '/api/slides' && req.method === 'POST') {
      return sendJson(res, slides(body.text, { file: body.path, read }));
    }
    if (route === '/api/file' && req.method === 'PUT') {
      if (body.worked) {
        const closes = closesAt(extract(body.text ?? '').entries);
        if (closes != null && now() >= closes + GRACE) {
          throw Object.assign(new Error(`${body.path} is a record: what's filled in on its page closed over a day ago`), { status: 423 });
        }
      }
      const result = content.write(body.path, body.text, {
        baseMtime: body.baseMtime,
        force: Boolean(body.force),
        explicit: Boolean(body.explicit),
      });
      return sendJson(res, result);
    }
    if (route === '/api/export' && req.method === 'POST') return sendExport(res, body.path, body.drawn);
    if (route === '/api/new' && req.method === 'POST') {
      return sendJson(res, content.create(body.name));
    }
    if (route === '/api/branch' && req.method === 'POST') return sendJson(res, content.branch(body.from, body.to));
    if (route === '/api/start-day' && req.method === 'POST') {
      return sendJson(res, content.startDay(body.dir ?? '', today(now, dayStarts), body));
    }
    if (route === '/api/copy' && req.method === 'POST') {
      return sendJson(res, content.copy(body.path, { mtime: body.mtime, edits: body.edits ?? [], day: body.today ? today(now, dayStarts) : null }));
    }
    if (route === '/api/promote' && req.method === 'POST') return sendJson(res, content.promote(body.path, body.base));
    if (route === '/api/rename' && req.method === 'POST') return sendJson(res, content.rename(body.moves));
    if (route === '/api/trash' && req.method === 'POST') return sendJson(res, content.trash(body.path));
    if (route === '/api/restore' && req.method === 'POST') return sendJson(res, content.restore(body.trash));
    if (route === '/api/extract' && req.method === 'POST') return sendJson(res, content.extract(body.path, body));
    if (route === '/api/unextract' && req.method === 'POST') return sendJson(res, content.unextract(body.path, body));
    return send(res, 404, 'not found', 'text/plain');
  }

  function sendExport(res, rel, drawn) {
    if (!DOC_EXTS.has(path.extname(String(rel)).toLowerCase())) throw new PathError(`not a document: ${rel}`);
    const { name, html } = exportHtml(content, rel, drawn);
    // Saved, never shown here: it carries a script of its own.
    return send(res, 200, html, TYPES['.html'], {
      ...CONTENT_SANDBOX,
      'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    });
  }

  function serveStatic(res, route) {
    const rel = route === '/' ? 'index.html' : decode(route).replace(/^\/+/, '');
    const abs = path.resolve(STATIC_DIR, rel);
    if (!abs.startsWith(STATIC_DIR + path.sep) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return send(res, 404, 'not found', 'text/plain');
    }
    // Only by its own name: a page's policy is found by name, so /PREVIEW.HTML
    // would otherwise be the preview with no policy, framed by anyone.
    if (path.relative(STATIC_REAL, fs.realpathSync.native(abs)).split(path.sep).join('/') !== rel) {
      return send(res, 404, 'not found', 'text/plain');
    }
    // The frames' own origin's, never the app's.
    if (rel === 'preview.html') return send(res, 404, 'not found', 'text/plain');
    if (rel === 'index.html' || rel === 'speaker.html') {
      const { name, port } = framesFor(res.req);
      const html = fs.readFileSync(abs, 'utf8')
        .replace('<!-- frames -->', `<meta name="frames"${name ? ` data-name="${name}"` : ''} data-port="${port}">`);
      return send(res, 200, html, TYPES['.html'], { 'Content-Security-Policy': POLICY(framing(PAGE_POLICIES[rel], name, port)) });
    }
    const csp = PAGE_POLICIES[rel] ?? (path.extname(rel) === '.html' ? UNLISTED_PAGE : undefined);
    return sendFile(res, abs, csp ? { 'Content-Security-Policy': POLICY(csp) } : {});
  }

  return { server, frames, content };
}

/**
 * Listens `frames` (from createServer) beside `server`, once that listens, at
 * the same address: on `port`, or 0 for any; and, `anyPort`, on any that's
 * free when `port` isn't. Resolves to the port it's on.
 */
export function listenFrames({ server, frames }, port = 0, { anyPort = false } = {}) {
  const { address } = server.address();
  return new Promise((resolve, reject) => {
    const listening = () => {
      frames.off('error', failed);
      resolve(frames.address().port);
    };
    const failed = (err) => {
      if (anyPort && port !== 0 && err.code === 'EADDRINUSE') {
        port = 0;
        frames.listen(0, address);
        return;
      }
      frames.off('listening', listening);
      frames.off('error', failed);
      reject(err);
    };
    frames.once('listening', listening);
    frames.on('error', failed);
    frames.listen(port > 65535 ? 0 : port, address);
  });
}

// The page with its frames: they may come from the frames' origin, by `name`
// or by `port`, and the name may be asked whether it answers.
function framing(policy, name, port) {
  const and = (have, ...more) => [have, ...more].filter(Boolean).join(' ');
  return { ...policy, 'frame-src': and(policy['frame-src'], name, port), 'connect-src': and(policy['connect-src'], name) };
}

// The name a request is addressed to, less its port, and the port.
const nameOf = (req) => (req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
const portOf = (req) => Number((req.headers.host || '').match(/:(\d+)$/)?.[1] ?? 80);

function urlOf(req) {
  try {
    return new URL(req.url, 'http://localhost');
  } catch {
    throw badRequest('malformed address');
  }
}

const routeOf = (req) => urlOf(req).pathname;

// What a frame loads that a browser counts as another origin's: the frames'
// own files, to the opaque frames, and a note's images.
function open(res) {
  res.removeHeader('Cross-Origin-Resource-Policy');
  return res;
}

function send(res, status, body, type, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(res.req?.method === 'HEAD' ? undefined : buf);
}

function sendJson(res, obj, status = 200) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function sendFile(res, abs, headers) {
  const type = TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  send(res, 200, fs.readFileSync(abs), type, headers);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    // A body too large is read to its end and dropped, and then answered
    // with a 413: answering sooner and destroying the request reset the
    // connection while the client was still sending, so it never saw the 413.
    const chunks = [];
    let size = Number(req.headers['content-length']) || 0;
    if (size <= MAX_BODY) size = 0;
    req.on('data', (c) => {
      if (size > MAX_BODY) return;
      size += c.length;
      if (size > MAX_BODY) chunks.length = 0;
      else chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return reject(Object.assign(new Error('request too large'), { status: 413 }));
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch {
        return reject(badRequest('bad json'));
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reject(badRequest('expected a JSON object'));
      resolve(body);
    });
    req.on('error', reject);
  });
}
