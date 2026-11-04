/**
 * Where a preview frame loads from, for the app and the speaker view, as
 * `window.Frames`. The frames have an origin of their own, apart from the
 * app's (src/server.js), which the page is told in its `<meta name="frames">`:
 * at a loopback name, `frames.localhost` on the app's port (`data-name`),
 * another site; and a second port (`data-port`). Chromium and Electron take
 * any .localhost name as this machine, but Safari asks the system, which
 * doesn't know it, and a frame there would be blank. So the name is tried
 * once, and where it doesn't answer the frames are the second port. The answer
 * is kept for the tab's session, so only its first page waits on it.
 *
 * A frame in the page marked `data-preview` is pointed there as the page
 * loads; one made later goes through `Frames.load(frame)`. Until then a
 * frame is blank, and it says it's ready only once it's the preview.
 * `Frames.post(frame, message)` sends one a message, at its own origin, and
 * `Frames.slide(...)` is the message that draws a slide in one.
 */
window.Frames = (() => {
  const KEY = 'reader:frames';
  const at = document.querySelector('meta[name="frames"]')?.dataset ?? {};
  const ORIGIN = { name: at.name, port: at.port };
  // Either way it's known in a few milliseconds, there or not; this is in case it hangs.
  const WAIT = 1500;

  function kept() {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  function keep(via) {
    try {
      sessionStorage.setItem(KEY, via);
    } catch {
      // Asked again on the next page, then.
    }
  }

  // The answer to the request is never read (it can't be): only that one came back at all.
  async function ask() {
    if (!ORIGIN.name) return 'port';
    const gone = new AbortController();
    const late = setTimeout(() => gone.abort(), WAIT);
    try {
      await fetch(`${ORIGIN.name}/preview.html`,
        { method: 'HEAD', mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: gone.signal });
      return 'name';
    } catch {
      return 'port';
    } finally {
      clearTimeout(late);
    }
  }

  const was = kept();
  const via = ORIGIN[was] ? Promise.resolve(was) : ask().then((v) => (keep(v), v));
  const src = via.then((v) => `${ORIGIN[v]}/preview.html`);

  /** Points `frame` at the preview, once it's known where that is. */
  const load = (frame) => src.then((url) => { frame.src = url; });

  /**
   * Sends `frame` (an <iframe>) `message`, to be had only by a page at the
   * origin it was pointed at. A frame sandboxed without allow-same-origin has
   * an opaque origin, "null", which no target can name, so it's sent to `'*'`;
   * what such a frame is sent is only ever the page being shown.
   */
  function post(frame, message) {
    const opaque = !(frame.getAttribute('sandbox') ?? 'allow-same-origin').split(/\s+/).includes('allow-same-origin');
    const src = frame.getAttribute('src');
    frame.contentWindow?.postMessage(message, opaque ? '*' : src ? new URL(src, location.href).origin : '/');
  }

  /**
   * The message that draws a slide in a frame, wherever it's drawn: `body`,
   * with `reveal` of its steps showing, as `deck` (its `css`, `base` and
   * `scale`) has it, in the theme. `more` is what's only this frame's.
   */
  function slide(deck, body, reveal, more) {
    return {
      type: 'render', css: deck.css, body, base: deck.base, resetScroll: true,
      deck: true, reveal, dark: Theme.dark(), scale: deck.scale, ...more,
    };
  }

  const marked = () => document.querySelectorAll('iframe[data-preview]').forEach(load);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', marked, { once: true });
  else marked();

  return { load, post, slide, src };
})();
