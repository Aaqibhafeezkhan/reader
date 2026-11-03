/**
 * The rendered page: the preview frame, kept in step with the editor.
 */

import { el, state, RENDER_DELAY } from './state.js';
import { api, contentUrl } from './api.js';
import { toast } from './status.js';
import { updatePresentable } from './deck.js';
import { scheduleFitCheck } from './fit.js';
import { sendScroll } from './sync.js';
import { setPages } from './pages.js';

// The frame says 'ready' when it loads, but it may have loaded before this
// module ran and that message is gone. So also ask: a 'ping' is answered with
// 'ready' by a frame that's already listening, and lost harmlessly by one
// that isn't (it will announce itself when it loads). Its listeners go once
// it's ready, or when `signal` gives up on a frame that never will be.
export function whenReady(frame, { signal } = {}) {
  return new Promise((resolve) => {
    const done = new AbortController();
    const heard = (e) => {
      if (e.source === frame.contentWindow && e.data?.type === 'ready') {
        done.abort();
        resolve();
      }
    };
    const ping = () => Frames.post(frame, { type: 'ping' });
    signal?.addEventListener('abort', () => done.abort(), { once: true });
    window.addEventListener('message', heard, { signal: done.signal });
    frame.addEventListener('load', ping, { signal: done.signal });
    ping();
  });
}

/**
 * Asks something of a rendered page, in a frame of its own out of sight, for
 * what only the preview frame can do. Draws `page` (`{ css, body }`) for the
 * file at `p`, sends `ask`, and answers with the frame's message of type
 * `answer`; if none comes in `wait` ms, fails with `late`. The frame's gone after.
 */
export async function askHidden({ css, body }, p, { ask, answer, wait, late }) {
  const frame = document.createElement('iframe');
  // Laid out, as the slide-measuring frame is: a diagram's text is measured as it's drawn.
  frame.className = 'measure';
  frame.sandbox = 'allow-scripts';
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  Frames.load(frame);
  let heard;
  let timer;
  const gone = new AbortController();
  try {
    return await new Promise((resolve, reject) => {
      heard = (e) => {
        if (e.source === frame.contentWindow && e.data?.type === answer) resolve(e.data);
      };
      window.addEventListener('message', heard);
      timer = setTimeout(() => reject(new Error(late)), wait);
      document.body.append(frame);
      whenReady(frame, { signal: gone.signal }).then(() => {
        Frames.post(frame, { type: 'render', css, body, base: baseFor(p), resetScroll: true });
        Frames.post(frame, ask);
      });
    });
  } finally {
    clearTimeout(timer);
    window.removeEventListener('message', heard);
    gone.abort();
    frame.remove();
  }
}

let renderTimer = 0;
export function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderNow, RENDER_DELAY);
}

export async function renderNow({ resetScroll = false } = {}) {
  clearTimeout(renderTimer);
  if (state.current?.type !== 'md') return;
  const seq = ++state.renderSeq;
  const path = state.current.path;
  let out;
  try {
    out = await api('POST', '/api/render', { text: el.editor.value, path, pages: state.working });
  } catch (err) {
    return toast(`render: ${err.message}`, true);
  }
  if (seq !== state.renderSeq) return;
  updatePresentable(out.deck);
  scheduleFitCheck(out.deck);
  // A deck being worked through shows the one page it's turned to.
  const page = setPages(out.pages, path);
  await state.previewReady;
  Frames.post(el.preview, {
    type: 'render',
    css: out.css,
    body: page ? page.body : out.body,
    title: out.title,
    base: baseFor(path),
    resetScroll,
    lines: el.editor.value.split('\n').length,
    working: state.working,
    // drawn in the app's theme, unless its own background says otherwise
    dark: Theme.dark(),
  });
  // What's above may have grown or shrunk; put the page back level.
  if (!resetScroll) sendScroll();
}

/** Where a note's relative links and images resolve. */
export function baseFor(path) {
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  return new URL(contentUrl(dir), location.href).href;
}

export function showPreview() {
  el.preview.hidden = false;
  el.pdfView.hidden = true;
  el.empty.hidden = true;
  el.split.classList.remove('pdf-mode');
}

export function showEmpty(msg) {
  el.preview.hidden = true;
  el.pdfView.hidden = true;
  el.empty.hidden = false;
  el.empty.textContent = msg;
  el.editor.disabled = true;
}
