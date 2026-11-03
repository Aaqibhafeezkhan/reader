/**
 * A form field (`@ Label: value`, a line of blank for each colon): a click
 * on its label, its blank, or beside them opens the blank for typing, the
 * text wrapping onto more lines as it needs them, as does the keyboard
 * reaching the blank. Enter, or clicking away, writes the value into the
 * file; Esc puts it back as it was, both leaving the keyboard on the blank,
 * where Enter opens it again; Tab and Shift-Tab write it and move to the
 * next field or the one before. A field of choices writes its line as it
 * reads with the one picked. A field in a sentence (`[@ what goes here:
 * answer]`) writes its answer into its place on the line, moving along the
 * others after it. A field that holds a number (`number:`) takes only a
 * number, and writes it back as `number:12[]`. A field given an answer, a value or a choice, says so
 * (`preview:answered`) to what it's in. Starting over (`preview:start-over`)
 * empties the fields on its lines: a blank, a choice picked, and a date or
 * a number, which stays the kind it is. Where the page can't be worked
 * (`Preview.workable`), as on a slide, no blank opens and no choice is
 * picked; and when it stops being workable while it's showing, as a page
 * past its time does, a blank being typed in is written and closed, and
 * the blanks and choices are taken out of the keyboard's way. Runs in the preview frame.
 */
(() => {
  /** Says `field` has been answered, for what it's in to count it (a choice it's part of is picked). */
  const answered = (field) => field.dispatchEvent(new Event('preview:answered', { bubbles: true }));

  let editing = null;
  let resting = null;   // a blank the keyboard is put back on, not to open again

  const fieldLabel = (f) => f.querySelector('.field-label')?.textContent ?? '';
  const fieldAt = (line, label, start) => [...document.querySelectorAll('.field')]
    .find((f) => f.dataset.line === String(line) && fieldLabel(f) === label && f.dataset.start === start);
  /** Where `field` is, to find it again after a re-render. */
  const placeOf = (field) => ({ line: field.dataset.line, label: fieldLabel(field), at: field.dataset.start });

  // What can be typed on the way to a number, and what's one.
  const NUMBERING = /^-?\d*\.?\d*$/;
  const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
  const numeric = (field) => field.dataset.kind === 'number';

  /** `field`'s line as written with `value` in it, the fields beside it told where they are now. */
  function written(field, value) {
    if (numeric(field)) return `${field.dataset.head} number:${value}[]`;
    if (field.dataset.start === undefined) return value ? `${field.dataset.head} ${value}` : field.dataset.head;
    const was = field.dataset.text;
    const start = Number(field.dataset.start);
    const end = Number(field.dataset.end);
    const piece = value ? `${field.dataset.head}: ${value}]` : `${field.dataset.head}]`;
    const now = was.slice(0, start) + piece + was.slice(end);
    const moved = piece.length - (end - start);
    for (const f of document.querySelectorAll(`.field[data-line="${field.dataset.line}"][data-start]`)) {
      const at = Number(f.dataset.start);
      if (f === field) f.dataset.end = String(start + piece.length);
      else if (at > start) {
        f.dataset.start = String(at + moved);
        f.dataset.end = String(Number(f.dataset.end) + moved);
      }
      f.dataset.text = now;
    }
    return now;
  }

  /** `field`'s line with none of its choices picked, the page told so. */
  function unpicked(field) {
    for (const i of field.querySelectorAll('.field-choice > input')) i.checked = false;
    const head = field.dataset.head;
    const now = head + field.dataset.text.slice(head.length).replace(/\([xX]\)/g, '( )');
    field.dataset.text = now;
    field.dataset.answered = 'false';
    return now;
  }

  // A field's date is drawn by the date feature, and its calendar's: the
  // field knows it only as written. One with no day in it is empty already.
  const DATED = /^date:\d/;

  /** `field`'s line with nothing in it, the page told so. */
  function emptied(field) {
    const { kind, text, head } = field.dataset;
    if (field.dataset.choices !== undefined) return unpicked(field);
    if (kind === 'date') {
      if (DATED.test(text.slice(head.length).trim())) field.dataset.text = `${head} date:[]`;
      return field.dataset.text;
    }
    const slot = field.querySelector('.field-value');
    if (!slot?.dataset.value) return text;
    const now = written(field, '');
    field.dataset.text = now;
    slot.textContent = '';
    slot.dataset.value = '';
    return now;
  }

  function openField(field, { value, start, end } = {}) {
    const slot = field.querySelector('.field-value');
    if (!slot || slot.querySelector('textarea')) return;
    editing?.close(true);
    const before = slot.dataset.value ?? '';
    const input = document.createElement('textarea');
    input.value = value ?? before;
    input.rows = 1;
    input.setAttribute('aria-label', slot.getAttribute('aria-label') ?? fieldLabel(field));
    if (slot.dataset.hint) input.placeholder = slot.dataset.hint;
    input.spellcheck = false;
    // Only a number, as it's typed: what else is typed or pasted is undone.
    if (numeric(field)) {
      input.inputMode = 'decimal';
      let kept = NUMBERING.test(input.value) ? input.value : '';
      input.addEventListener('input', () => {
        const v = input.value.trim();
        if (NUMBERING.test(v)) kept = v;
        else input.value = kept;
      });
    }
    slot.replaceChildren(input);
    const fit = () => {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
    };
    fit();
    input.addEventListener('input', fit);
    input.focus();
    input.setSelectionRange(start ?? input.value.length, end ?? input.value.length);

    let done = false;
    const close = (commit, { stay = false } = {}) => {
      if (done) return;
      done = true;
      if (editing?.input === input) editing = null;
      let after = commit ? input.value.replace(/\s+/g, ' ').trim() : before;
      // In a sentence, a `]` would end the field early: brackets go round.
      if (field.dataset.start !== undefined) after = after.replace(/\[/g, '(').replace(/\]/g, ')');
      // Not yet a number (`-`, `1.`): as it was, or the number it's on the way to.
      if (numeric(field) && after && !NUMBER.test(after)) after = NUMBER.test(after.replace(/\.$/, '')) ? after.replace(/\.$/, '') : before;
      slot.textContent = after;
      slot.dataset.value = after;
      if (stay && slot.tabIndex >= 0) {
        resting = slot;
        slot.focus();
      }
      if (after !== before) {
        // The line as written, with the new value after its colons.
        const line = Number(field.dataset.line);
        const was = field.dataset.text;
        const now = written(field, after);
        field.dataset.text = now;
        Preview.edit([{ from: line, to: line + 1, before: [was], after: [now] }]);
        if (after) answered(field);
      }
    };
    // A re-render is about to replace the field: let it go quietly and say
    // how to open it again.
    const keep = () => {
      done = true;
      editing = null;
      return { ...placeOf(field), value: input.value, start: input.selectionStart, end: input.selectionEnd };
    };
    editing = { field, input, close, keep };

    input.addEventListener('keydown', (e) => {
      if (!['Enter', 'Escape', 'Tab'].includes(e.key) || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      // A field drawn by another feature, a date, has no blank to move to.
      const all = [...document.querySelectorAll('.field:not([data-choices])')].filter((f) => f.querySelector('.field-value'));
      const next = e.key === 'Tab' && all[all.indexOf(field) + (e.shiftKey ? -1 : 1)];
      close(e.key !== 'Escape', { stay: !next });
      if (next) openField(next);
    });
    input.addEventListener('blur', () => close(true));
  }

  // A choice where the page can't be worked: a click on it, which Space and
  // its label's are too, is called off before it picks, and so are the
  // keys that move along the choices.
  const shut = (t) => !Preview.workable && t.matches?.('.field-choice > input');
  document.addEventListener('click', (e) => {
    if (shut(e.target)) e.preventDefault();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (shut(e.target) && [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  });

  document.addEventListener('change', (e) => {
    const field = e.target.matches?.('.field-choice > input') && e.target.closest('.field');
    if (!field) return;
    const line = Number(field.dataset.line);
    const was = field.dataset.text;
    const now = e.target.dataset.on;
    field.dataset.text = now;
    field.dataset.answered = 'true';
    if (now !== was) {
      Preview.edit([{ from: line, to: line + 1, before: [was], after: [now] }], { undo: true });
      answered(field);
    }
  });

  // A choice let go of (tasks/preview.js): the choices picked in it are
  // let go too, so only the choice picked has an answer. What's typed in
  // a blank in it stays: it's more to lose, and costs nothing to keep.
  document.addEventListener('preview:unpicked', (e) => {
    for (const field of e.target.querySelectorAll('.field[data-choices]')) {
      if (![...field.querySelectorAll('.field-choice > input')].some((i) => i.checked)) continue;
      const line = Number(field.dataset.line);
      const was = field.dataset.text;
      const now = unpicked(field);
      if (now !== was) Preview.edit([{ from: line, to: line + 1, before: [was], after: [now] }], { undo: true });
    }
  }, true);

  // Starting over: every field on the lines is emptied, those of a line in
  // one edit, since each is made from what the last one wrote. What's being
  // typed in one is let go of with the rest.
  document.addEventListener('preview:start-over', ({ detail: { within, edits } }) => {
    if (editing && within(Number(editing.field.dataset.line))) editing.close(false);
    const lines = new Map();
    for (const field of document.querySelectorAll('.field')) {
      const line = Number(field.dataset.line);
      if (!within(line)) continue;
      const was = field.dataset.text;
      const now = emptied(field);
      if (now !== was) lines.set(line, { was: lines.get(line)?.was ?? was, now });
    }
    for (const [line, { was, now }] of lines) edits.push({ from: line, to: line + 1, before: [was], after: [now] });
  });

  document.addEventListener('focusin', (e) => {
    const slot = e.target.matches?.('.field-value') && e.target;
    if (!slot || slot === resting) return;
    const f = Preview.workable && slot.closest('.field:not([data-choices])');
    if (f) openField(f);
  });
  document.addEventListener('focusout', (e) => { if (e.target === resting) resting = null; });
  // Enter opens again the blank the keyboard was left on.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target !== resting || !Preview.workable) return;
    e.preventDefault();
    resting = null;
    openField(e.target.closest('.field'));
  });

  document.addEventListener('click', (e) => {
    const f = Preview.workable && e.target.closest && e.target.closest('.field:not([data-choices])');
    if (f && !(e.target instanceof HTMLTextAreaElement)) openField(f);
  });

  // Shut while it's showing: what's been typed is kept, as clicking away
  // keeps it, and the page is left as the server draws one that's shut.
  window.addEventListener('preview:workable', () => {
    if (Preview.workable) return;
    editing?.close(true);
    resting = null;
    for (const slot of document.querySelectorAll('.field-value[tabindex]')) {
      Preview.shut(slot, { tabindex: null, role: null, 'aria-label': null, 'aria-placeholder': null });
    }
    for (const choice of document.querySelectorAll('.field-choice > input')) Preview.shut(choice, { disabled: '' });
  });

  // A field being filled in stays open through a re-render, with what's
  // been typed so far; one just written keeps the keyboard, as written
  // ones bring a render.
  Preview.register({
    keep: () => editing?.keep()
      ?? (resting && document.activeElement === resting ? { ...placeOf(resting.closest('.field')), resting: true } : undefined),
    restore: (root, filling) => {
      if (!filling || !Preview.workable) return;
      const field = fieldAt(filling.line, filling.label, filling.at);
      if (!field) return;
      if (!filling.resting) return openField(field, filling);
      resting = field.querySelector('.field-value');
      resting?.focus({ preventScroll: true });
    },
  });
})();
