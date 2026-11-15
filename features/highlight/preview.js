/**
 * Each code fence gets a Copy button in its bottom-right corner, which
 * copies its code as typed: without its line numbers or its callouts'
 * badges, which are only drawn, and without the `<n>` marks they were
 * written as, which the fence no longer holds. An `output` fence has none;
 * under versions of the code in tabs, each version has its own. The button
 * says "Copied" for a moment after. Not on a slide; an exported or printed
 * page has no script, and so no button.
 *
 * The frame is another origin than the app's, so the clipboard is written
 * here, in the click, as the frame's `allow` lets it (static/index.html);
 * where there's no clipboard API, away from localhost, the text is copied
 * as a selection is. Runs in the preview frame.
 */
(() => {
  const SAID = 1500;

  function dress(root) {
    if (Preview.deck) return;
    for (const code of root.querySelectorAll('pre:not(.output) > code')) {
      const pre = code.parentElement;
      if (pre.querySelector(':scope > .code-copy')) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'code-copy';
      b.textContent = 'Copy';
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
    button.textContent = said;
    Preview.say(said);
    clearTimeout(button.copied);
    button.copied = setTimeout(() => { button.textContent = 'Copy'; }, SAID);
  });

  Preview.register({ restore: (root) => dress(root) });
})();
