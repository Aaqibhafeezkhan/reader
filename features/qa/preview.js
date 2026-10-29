/**
 * A card's label (G, B or T) marks its discussion done, or not done again
 * (a Try's, that it's been tried):
 * a click, or Enter or Space on it, writes its line with `[x]` or without
 * (`data-on`, `data-off`); the re-render that follows fades the card.
 * Where the page can't be worked (`Preview.workable`), as on a slide, it
 * takes neither, and when it stops being workable while it's showing, as a
 * page past its time does, it's taken out of the keyboard's way. Runs in
 * the preview frame.
 */
(() => {
  const toggle = (label) => {
    const line = Number(label.dataset.line);
    const done = label.closest('li').classList.contains('qa-done');
    const [before, after] = done ? [label.dataset.on, label.dataset.off] : [label.dataset.off, label.dataset.on];
    if (before !== after) Preview.edit([{ from: line, to: line + 1, before: [before], after: [after] }], { undo: true });
  };
  document.addEventListener('click', (e) => {
    const label = Preview.workable && e.target.closest && e.target.closest('.qa-toggle');
    if (label) toggle(label);
  });
  window.addEventListener('preview:workable', () => {
    if (Preview.workable) return;
    for (const label of document.querySelectorAll('.qa-toggle[tabindex]')) Preview.shut(label, { tabindex: null, title: null, 'aria-disabled': 'true' });
  });
  document.addEventListener('keydown', (e) => {
    const label = Preview.workable && e.target.closest && e.target.closest('.qa-toggle');
    if (!label || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    toggle(label);
  });
})();
