/**
 * Picking a version in one `tabs` or `compare` block picks it in every
 * block that has one of the same name. The names picked are remembered,
 * latest first, so each block shows the one picked most lately of those it
 * has; a block with none of them shows its first. The frame, sandboxed, has
 * no storage, so the page it's in keeps them (static/views.js): it's asked
 * for them as the frame loads, told of each pick, and says when they change.
 * Runs in the preview frame.
 */
(() => {
  let picked = [];

  /** Checks, in each block under `root`, the tab picked most lately. */
  function show(root) {
    if (!picked.length) return;
    for (const block of root.querySelectorAll('.tabs, .compare')) {
      const tabs = [...block.querySelectorAll(':scope > .tab-bar > .tab > input, :scope > .compare-pane > .tab > input')];
      for (const key of picked) {
        const tab = tabs.find((t) => t.value === key);
        if (!tab) continue;
        tab.checked = true;
        break;
      }
    }
  }

  document.addEventListener('change', (e) => {
    const key = e.target.matches?.('input.tab-pick') && e.target.value;
    if (!key) return;
    picked = [key, ...picked.filter((k) => k !== key)];
    show(document);
    window.parent.postMessage({ type: 'pick', key }, '*');
  });
  window.addEventListener('message', (e) => {
    if (!Preview.fromApp(e) || e.data?.type !== 'picked' || !Array.isArray(e.data.keys)) return;
    picked = e.data.keys;
    show(document);
  });
  Preview.register({ restore: (root) => show(root) });
  window.parent.postMessage({ type: 'picks' }, '*');
})();
