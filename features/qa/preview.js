/**
 * A card's label (G, B or T) marks its discussion done, or not done again
 * (a Try's, that it's been tried):
 * a click, or Enter or Space on it, writes its line with `[x]` or without
 * (`data-on`, `data-off`); the re-render that follows fades the card.
 * An answer's choice, picked, writes its line with only it picked
 * (`data-on`), from the line as last written here (`data-text`), and says
 * the answer is answered (`preview:answered`); something answered in a
 * choice, a blank in its words filled in, picks it, its edit going up with
 * the blank's as one (static/preview-api.js). Starting over
 * (`preview:start-over`) lets go of the choice picked (`data-off`).
 * Where the page can't be worked (`Preview.workable`), as on a slide, a
 * label takes neither a click nor a key, and no choice is picked; when it
 * stops being workable while it's showing, as a page past its time does,
 * they're taken out of the keyboard's way. Runs in the preview frame.
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
    for (const box of document.querySelectorAll('.qa-choice input.qa-box')) Preview.shut(box, { disabled: '' });
  });
  document.addEventListener('keydown', (e) => {
    const label = Preview.workable && e.target.closest && e.target.closest('.qa-toggle');
    if (!label || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    toggle(label);
  });

  const CHOICE = '.qa-choice input.qa-box';
  const pick = (box) => {
    const row = box.closest('.qa-choices');
    const line = Number(row.dataset.line);
    const was = row.dataset.text;
    const now = box.dataset.on;
    row.dataset.text = now;
    // A choice whose words are a blank still to write in is picked, but
    // not yet an answer: the keyboard goes to its blank.
    const unwritten = box.closest('.qa-choice')?.querySelector('[data-unwritten]');
    row.dataset.answered = String(!unwritten);
    unwritten?.focus();
    if (now === was) return;
    // Not one to undo when the keyboard's gone to a blank, as that would close it.
    Preview.edit([{ from: line, to: line + 1, before: [was], after: [now] }], { undo: !unwritten });
    row.dispatchEvent(new Event('preview:answered', { bubbles: true }));
  };
  document.addEventListener('change', (e) => {
    if (e.target.matches?.(CHOICE)) pick(e.target);
  });
  document.addEventListener('preview:answered', (e) => {
    const box = Preview.workable && e.target.closest?.('.qa-choice')?.querySelector(CHOICE);
    if (!box || box === e.target) return;
    if (box.checked) {
      box.closest('.qa-choices').dataset.answered = String(!box.closest('.qa-choice').querySelector('[data-unwritten]'));
      return;
    }
    box.checked = true;
    pick(box);
  });
  document.addEventListener('preview:start-over', ({ detail: { within, edits } }) => {
    for (const row of document.querySelectorAll('.qa-choices')) {
      const line = Number(row.dataset.line);
      if (!within(line) || row.dataset.text === row.dataset.off) continue;
      edits.push({ from: line, to: line + 1, before: [row.dataset.text], after: [row.dataset.off] });
      row.dataset.text = row.dataset.off;
      row.dataset.answered = 'false';
      for (const box of row.querySelectorAll(CHOICE)) box.checked = false;
    }
  });
  // Where the page can't be worked, a click on a choice, which Space and
  // its words' are too, is called off before it picks, and so are the keys
  // that move along the choices.
  const shut = (t) => !Preview.workable && t.matches?.(CHOICE);
  document.addEventListener('click', (e) => {
    if (shut(e.target)) e.preventDefault();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (shut(e.target) && [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  });
})();
