/**
 * Each code fence gets a Copy button in its bottom-right corner, which
 * copies its code as typed: without its line numbers or its callouts'
 * badges, which are only drawn, and without the `<n>` marks they were
 * written as, which the fence no longer holds. An `output` fence has none;
 * under versions of the code in tabs, each version has its own. The button
 * is the app's copy icon (static/app/icons.js, `copy-file`), named "Copy
 * code"; a tick takes its place for a moment after, and "Copied" is said. Not on a slide; an exported or printed
 * page has no script, and so no button.
 *
 * The frame is another origin than the app's, so the clipboard is written
 * here, in the click, as the frame's `allow` lets it (static/index.html);
 * where there's no clipboard API, away from localhost, the text is copied
 * as a selection is. Runs in the preview frame.
 */
(() => {
  const SAID = 1500;
  // The app's own copy icon, and a tick for once it's done; the frame is
  // another origin, so they're drawn here as the app draws them.
  const svg = (paths) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const COPY = svg('<path d="M8 5.5H3.3a.8.8 0 0 0-.8.8v7a.8.8 0 0 0 .8.8h6.4a.8.8 0 0 0 .8-.8V8zM8 5.5V8h2.5M5.5 5.5V2.8a.8.8 0 0 1 .8-.8H11l2.5 2.5v6.2a.8.8 0 0 1-.8.8h-2.2M11 2v2.5h2.5"/>');
  const DONE = svg('<path d="M3.5 8.5l3 3 6-7"/>');
  const NAME = 'Copy code';

  function dress(root) {
    if (Preview.deck) return;
    for (const code of root.querySelectorAll('pre:not(.output) > code')) {
      const pre = code.parentElement;
      if (pre.querySelector(':scope > .code-copy')) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'code-copy';
      b.setAttribute('aria-label', NAME);
      b.title = NAME;
      b.innerHTML = COPY;
      pre.append(b);
    }
  }

  /** A fence's code as typed: what's written in it, with its last line break off. */
  const codeOf = (pre) => pre.querySelector(':scope > code').textContent.replace(/\n$/, '');

  async function copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const scratch = Object.assign(document.createElement('textarea'), { value: text });
      scratch.style.cssText = 'position: fixed; left: -9999px;';
      document.body.append(scratch);
      scratch.focus({ preventScroll: true });
      scratch.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { /* none to be had */ }
      scratch.remove();
      button.focus({ preventScroll: true });
      return ok;
    }
  }

  document.addEventListener('click', async (e) => {
    const button = e.target.closest?.('button.code-copy');
    if (!button || Preview.deck) return;
    const ok = await copy(codeOf(button.parentElement), button);
    const said = ok ? 'Copied' : 'Couldn\'t copy';
    if (ok) button.innerHTML = DONE;
    button.title = said;
    Preview.say(said);
    clearTimeout(button.copied);
    button.copied = setTimeout(() => { button.innerHTML = COPY; button.title = NAME; }, SAID);
  });

  Preview.register({ restore: (root) => dress(root) });
})();
