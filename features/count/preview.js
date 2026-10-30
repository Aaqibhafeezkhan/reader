/**
 * A multiplier's button sets every count in its section to what it reads
 * at that multiple (`data-by`), and says so, tinting them. Which is picked
 * is kept by the page around the frame (static/views.js), by the
 * multiplier's document and section, so it holds as the file is edited
 * and when it's next opened. Runs in the preview frame.
 */
(() => {
  let views = {};
  const keyOf = (multiplier) => `multiplier:${multiplier.dataset.key}`;

  /** The multiple picked for `multiplier`, if it's one of its buttons. */
  const picked = (multiplier) => {
    const by = views[keyOf(multiplier)];
    return [...multiplier.querySelectorAll('.multiply')].some((b) => b.dataset.by === by) ? by : '1';
  };

  function show(root) {
    for (const multiplier of root.querySelectorAll('.multiplier')) {
      const by = picked(multiplier);
      for (const b of multiplier.querySelectorAll('.multiply')) b.setAttribute('aria-pressed', String(b.dataset.by === by));
      for (const count of root.querySelectorAll(`.count[data-multiplier="${multiplier.dataset.multiplier}"]`)) {
        const as = JSON.parse(count.dataset.by);
        count.dataset.typed ??= count.textContent;
        count.textContent = by === '1' ? count.dataset.typed : as[by] ?? count.dataset.typed;
        count.classList.toggle('scaled', by !== '1');
        if (by === '1') count.removeAttribute('title');
        else count.title = `${count.dataset.typed} as written`;
      }
    }
  }

  document.addEventListener('click', (e) => {
    const button = e.target.closest?.('.multiply');
    if (!button) return;
    const key = keyOf(button.closest('.multiplier'));
    const value = button.dataset.by === '1' ? null : button.dataset.by;
    if (value == null) delete views[key];
    else views[key] = value;
    show(document);
    window.parent.postMessage({ type: 'view', key, value }, '*');
  });
  window.addEventListener('message', (e) => {
    if (!Preview.fromApp(e) || e.data?.type !== 'viewed' || typeof e.data.views !== 'object') return;
    views = e.data.views ?? {};
    show(document);
  });
  Preview.register({ restore: (root) => show(root) });
  window.parent.postMessage({ type: 'views' }, '*');
})();
