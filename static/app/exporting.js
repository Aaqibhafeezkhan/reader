/**
 * Exporting: a document saved as one HTML file (src/export.js), or printed
 * from one.
 *
 * That file draws nothing, so what the preview would draw (a diagram) is
 * drawn here first, in a frame of its own out of sight, and sent with the
 * request for the server to set into the page.
 */

import { api, exportUrl } from './api.js';
import { whenReady, baseFor } from './render.js';
import { asPrinted, fill, sheet } from './sheets.js';

const DRAW_TIMEOUT = 30000;

/** Saves the document at `p`, as it is on disk, as an HTML file. */
export async function exportDocument(p) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await exported(p));
  a.download = `${p.slice(p.lastIndexOf('/') + 1).replace(/\.[^.]*$/, '')}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/**
 * Prints the document at `p`, as it is on disk: the HTML file it would be
 * saved as, which prints a deck a page to a sheet, numbered, each page
 * sized to fill its sheet (sheets.js). It's written into a frame of its
 * own, out of sight, whose page runs no scripts.
 */
export async function printDocument(p) {
  const html = await (await exported(p)).text();
  const frame = document.createElement('iframe');
  frame.sandbox = 'allow-same-origin allow-modals';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  frame.className = 'print-frame';
  const done = () => frame.remove();
  try {
    await new Promise((resolve) => {
      frame.addEventListener('load', resolve, { once: true });
      frame.src = '/print.html';
      document.body.append(frame);
    });
    const win = frame.contentWindow;
    const doc = win.document;
    doc.open();
    doc.write(asPrinted(html));
    doc.close();
    await Promise.all([...doc.images].map((img) => img.decode().catch(() => {})));
    await doc.fonts.ready;
    // The sheet's size, as the page's is when it's printed, for what's
    // sized by the window.
    const { width, height } = sheet(doc);
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    fill(doc);
    win.addEventListener('afterprint', () => setTimeout(done), { once: true });
    win.print();
  } catch (err) {
    done();
    throw err;
  }
}

/** The document at `p`, as it is on disk, as the HTML file it's exported as. */
async function exported(p) {
  const drawn = await drawnFor(p);
  const res = await fetch(exportUrl(p), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: p, drawn }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status} ${res.statusText}`);
  return res.blob();
}

/**
 * What the preview frame draws of the document at `p`, as it is on disk.
 * Also what `reader export` asks a headless browser for (src/browser.js).
 */
export async function drawnFor(p) {
  const { text } = await api('GET', `/api/file?path=${encodeURIComponent(p)}`);
  return draw(await api('POST', '/api/render', { text, path: p }), p);
}

/** What the preview frame draws of a rendered page, by feature. */
async function draw({ css, body }, p) {
  const frame = document.createElement('iframe');
  // Laid out, as the slide-measuring frame is: a diagram's text is measured as it's drawn.
  frame.className = 'measure';
  frame.sandbox = 'allow-scripts';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  Frames.load(frame);
  let heard;
  const gone = new AbortController();
  try {
    return await new Promise((resolve, reject) => {
      heard = (e) => {
        if (e.source === frame.contentWindow && e.data?.type === 'drawn') resolve(e.data.drawn);
      };
      window.addEventListener('message', heard);
      setTimeout(() => reject(new Error('its diagrams took too long to draw')), DRAW_TIMEOUT);
      document.body.append(frame);
      whenReady(frame, { signal: gone.signal }).then(() => {
        Frames.post(frame, { type: 'render', css, body, base: baseFor(p), resetScroll: true });
        Frames.post(frame, { type: 'drawn' });
      });
    });
  } finally {
    window.removeEventListener('message', heard);
    gone.abort();
    frame.remove();
  }
}
