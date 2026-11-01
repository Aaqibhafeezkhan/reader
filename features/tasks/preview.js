/**
 * A task's checkbox rewrites its `[ ]`, and a radio button its list's
 * `( )`s, as one edit; the re-render that follows is what makes the change
 * stick. Each box knows its line checked and unchecked (`data-on`,
 * `data-off`), and a box with stages its line at each (`data-lines`): a
 * click fills the next stage, or empties a full box, and a shift-click
 * goes back one. A reset button clears every box on its lines, and a log
 * button beside it adds a heading for today, with the multiple picked. Another
 * feature can have a box done by sending it, or its list item, a
 * `preview:complete`: a plain box is ticked, a staged one filled all the way.
 * A box says whether it's done (`data-done`), and when that changes on the
 * page, sends `preview:done`, for whatever counts what's done; a list of
 * choices says whether one's picked (`data-answered`). A choice is picked,
 * too, when something inside it is answered (`preview:answered`), as a
 * blank in its line filled in, or a field under it.
 * A heading's box is a Done button (`.section-done`): pressed, it writes
 * the heading's `[x]` (`data-own`), and it's pressed while its section is
 * done, by that or by everything to be done in it being done
 * (`data-full`), counted again here as they're done and undone, a section
 * with a box under it as one of them. It sends `preview:done` too.
 * Where the page can't be worked (`Preview.workable`), as on a slide, none
 * of them takes a click or a key; when it stops being workable while it's
 * showing, as a page past its time does, they're shut as the server would
 * have drawn them. Runs in the preview frame.
 */
(() => {
  const boxLine = (b, on) => {
    const line = Number(b.dataset.line);
    // `defaultChecked` is what the file said when the page was drawn.
    return { from: line, to: line + 1, before: [b.defaultChecked ? b.dataset.on : b.dataset.off], after: [on ? b.dataset.on : b.dataset.off] };
  };
  const stageLine = (b, to) => {
    const line = Number(b.dataset.line);
    const lines = JSON.parse(b.dataset.lines);
    return { from: line, to: line + 1, before: [lines[Number(b.dataset.stage)]], after: [lines[to]] };
  };
  /** Whether box `b` is done, said where anything counting it can read it. */
  const markDone = (b, done) => {
    if (b.dataset.done === String(done)) return;
    b.dataset.done = String(done);
    b.dispatchEvent(new Event('preview:done', { bubbles: true }));
  };
  /** Until the next render, the page is what the file says. */
  const setStage = (b, to) => {
    b.dataset.stage = String(to);
    [...b.children].forEach((pip, k) => pip.classList.toggle('on', k < to));
    const n = b.children.length;
    b.setAttribute('aria-checked', to === n ? 'true' : to ? 'mixed' : 'false');
    markDone(b, to === n);
  };

  const HEADINGS = 'h1, h2, h3, h4, h5, h6';
  const levelOf = (h) => Number(h.tagName[1]);
  /**
   * Whether each section with a Done button is done, said again from what's
   * on the page now, innermost first, as the server says it
   * (tasks/index.js): what's to be done in it and the questions in it,
   * each a part, and a section with a button under it one part, what's in
   * it being its. Not what's in the margin, nor the masthead.
   */
  const settleSections = () => {
    const order = [...document.querySelectorAll(`${HEADINGS}, [data-done], [data-answered]`)]
      .filter((n) => !n.closest('.gm-asides, .gm-masthead') && (n.matches(HEADINGS) || !n.closest(HEADINGS)));
    for (let i = order.length - 1; i >= 0; i--) {
      const button = order[i].matches(HEADINGS) && order[i].querySelector(':scope > .section-done');
      if (!button) continue;
      const level = levelOf(order[i]);
      const parts = [];
      for (let j = i + 1, inside = 0; j < order.length; j++) {
        const n = order[j];
        if (n.matches(HEADINGS)) {
          const at = levelOf(n);
          if (at <= level) break;
          if (inside && at <= inside) inside = 0;
          const sub = !inside && n.querySelector(':scope > .section-done');
          if (sub) {
            parts.push(sub.dataset.done);
            inside = at;
          }
        } else if (!inside) parts.push(n.dataset.done ?? n.dataset.answered);
      }
      const full = parts.length > 0 && parts.every((v) => v === 'true');
      button.dataset.full = String(full);
      if (full) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
      const done = full || button.dataset.own === 'true';
      button.setAttribute('aria-pressed', String(done));
      markDone(button, done);
    }
  };
  // Once a turn, after whatever changed on the page has said so.
  let settling = false;
  const settle = () => {
    if (settling || !document.querySelector('.section-done')) return;
    settling = true;
    queueMicrotask(() => {
      settleSections();
      settling = false;
    });
  };
  for (const type of ['change', 'preview:done', 'preview:answered']) document.addEventListener(type, settle);

  // A box or a choice where the page can't be worked: a click on it, which
  // Space is too, is called off before it ticks, and so are the keys that
  // move a choice. A field's choices are the field's (fields/preview.js).
  const shut = (t) => !Preview.workable && t.matches?.('input.task-box, input.choice-box') && !t.closest('.field');
  document.addEventListener('click', (e) => {
    if (shut(e.target)) e.preventDefault();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (shut(e.target) && [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  });

  window.addEventListener('preview:workable', () => {
    if (Preview.workable) return;
    for (const b of document.querySelectorAll('input.task-box, input.choice-box, button.stage-box')) if (!b.closest('.field')) Preview.shut(b, { disabled: '' });
    for (const b of document.querySelectorAll('.section-done')) Preview.shut(b, { disabled: '' });
    for (const b of document.querySelectorAll('.task-reset, .task-log')) Preview.shut(b, { hidden: '' });
  });

  /** Box `box` written as it now reads, and the rest of its choices with it. */
  const answer = (box) => {
    const group = box.type === 'radio'
      ? [...document.querySelectorAll('input.choice-box')].filter((b) => b.name === box.name)
      : [box];
    const edits = group.map((b) => boxLine(b, b === box ? box.checked : false))
      .filter((x) => x.before[0] !== x.after[0]);
    // The choices no longer picked, to tell what's in them (preview:unpicked).
    const unpicked = group.filter((b) => b !== box && b.defaultChecked);
    for (const b of group) b.defaultChecked = b.checked;
    if (box.type === 'checkbox') markDone(box, box.checked);
    else box.closest('[data-answered]')?.setAttribute('data-answered', 'true');
    if (edits.length) Preview.edit(edits, { undo: true });
    // What was answered inside a choice no longer picked is let go of, in the same turn's edit.
    for (const b of unpicked) b.closest('li')?.dispatchEvent(new Event('preview:unpicked'));
  };

  document.addEventListener('change', (e) => {
    const box = e.target;
    // A field's choices share a line, and the field writes it (fields/preview.js).
    if (!box.matches || !box.matches('input.task-box, input.choice-box') || box.closest('.field')) return;
    answer(box);
  });

  // Something answered inside a choice, a blank in its line or a field
  // under it, picks the choice; its line goes up with the answer's, as one
  // edit (preview-api.js). Picking another later tells the one let go
  // (preview:unpicked), for what's answered in it to be let go too.
  document.addEventListener('preview:answered', (e) => {
    if (!Preview.workable) return;
    for (let item = e.target.closest?.('li'); item; item = item.parentElement?.closest('li')) {
      const box = item.querySelector(':scope > input.choice-box, :scope > p > input.choice-box');
      if (!box) continue;
      if (!box.defaultChecked) {
        box.checked = true;
        answer(box);
      }
      return;
    }
  });

  // Asked of a box, or of the list item it begins: done, if it isn't. Its
  // edit goes up with the rest of the turn's, as one undo (preview-api.js).
  document.addEventListener('preview:complete', (e) => {
    const at = e.target;
    const own = (sel) => (at.matches?.(sel) ? at : at.querySelector?.(`:scope > ${sel}, :scope > p > ${sel}`));
    const staged = own('.stage-box');
    const plain = own('input.task-box');
    if (staged) {
      const n = staged.children.length;
      if (Number(staged.dataset.stage) === n) return;
      Preview.edit([stageLine(staged, n)], { undo: true });
      setStage(staged, n);
    } else if (plain && !plain.defaultChecked && !plain.closest('.field')) {
      Preview.edit([boxLine(plain, true)], { undo: true });
      plain.checked = plain.defaultChecked = true;
      markDone(plain, true);
    }
  });

  document.addEventListener('click', (e) => {
    if (!Preview.workable) return;
    const section = e.target.closest?.('.section-done');
    if (section) {
      // Done by what's in it, it's undone by undoing one of them.
      if (section.getAttribute('aria-disabled') === 'true') return;
      const line = Number(section.dataset.line);
      const own = section.dataset.own === 'true';
      const as = (on) => (on ? section.dataset.on : section.dataset.off);
      Preview.edit([{ from: line, to: line + 1, before: [as(own)], after: [as(!own)] }], { undo: true });
      section.dataset.own = String(!own);
      settle();
      return;
    }
    const box = e.target.closest?.('.stage-box');
    if (box) {
      const stage = Number(box.dataset.stage);
      const n = box.children.length;
      const to = e.shiftKey ? Math.max(0, stage - 1) : stage === n ? 0 : stage + 1;
      if (to === stage) return;
      Preview.edit([stageLine(box, to)], { undo: true });
      setStage(box, to);
      return;
    }
    const log = e.target.closest?.('.task-log');
    if (log) {
      const at = Number(log.dataset.at);
      const d = new Date();
      const today = [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
      const multiplier = log.dataset.multiplier && document.querySelector(`.multiplier[data-multiplier="${log.dataset.multiplier}"]`);
      const by = multiplier?.querySelector('.multiply[aria-pressed="true"]:not([data-by="1"])')?.textContent;
      const heading = `${'#'.repeat(Number(log.dataset.level))} date:${today}[]${by ? ` · ${by}` : ''}`;
      Preview.edit([{ from: at, to: at, before: [], after: ['', heading] }], { undo: true });
      return;
    }
    const reset = e.target.closest?.('.task-reset');
    if (!reset) return;
    const from = Number(reset.dataset.from);
    const to = reset.dataset.to ? Number(reset.dataset.to) : Infinity;
    const within = (b) => Number(b.dataset.line) >= from && Number(b.dataset.line) < to && !b.closest('.field');
    const edits = [];
    for (const b of document.querySelectorAll('input.task-box, input.choice-box')) {
      if (within(b) && b.defaultChecked) {
        edits.push(boxLine(b, false));
        b.checked = b.defaultChecked = false;
        if (b.type === 'checkbox') markDone(b, false);
        else b.closest('[data-answered]')?.setAttribute('data-answered', 'false');
      }
    }
    for (const b of document.querySelectorAll('.stage-box')) {
      if (within(b) && Number(b.dataset.stage)) {
        edits.push(stageLine(b, 0));
        setStage(b, 0);
      }
    }
    for (const b of document.querySelectorAll('.section-done')) {
      if (within(b) && b.dataset.own === 'true') {
        const line = Number(b.dataset.line);
        edits.push({ from: line, to: line + 1, before: [b.dataset.on], after: [b.dataset.off] });
        b.dataset.own = 'false';
      }
    }
    if (edits.length) Preview.edit(edits, { undo: true });
    settle();
  });
})();
