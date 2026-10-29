/**
 * A bar that counts the boxes of its section counts them again when one
 * says it's done or isn't (`preview:done`), by the lines it counted when
 * it was drawn (`data-lines`): the bar fills, and its count says so, before
 * the page is drawn again from the file. Runs in the preview frame.
 */
(() => {
  document.addEventListener('preview:done', () => {
    for (const bar of document.querySelectorAll('.progress[data-lines]')) {
      const lines = bar.dataset.lines.split(' ').filter(Boolean);
      const done = lines.filter((n) => document.querySelector(`[data-done][data-line="${n}"]`)?.dataset.done === 'true').length;
      const meter = bar.querySelector('progress');
      meter.value = Math.min(done, meter.max);
      bar.querySelector('.progress-count').textContent = `${done} of ${lines.length}`;
    }
  });
})();
