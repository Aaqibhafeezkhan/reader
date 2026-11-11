/**
 * Folds a heading's section away, and opens it again (gh-100). Each
 * heading in the text gets a button before it, and a click on its words
 * does the same, though not on a box, a link or a button in it. A section
 * runs to the next heading of the same level or higher, across the page's
 * rows: a row wholly in it goes, its asides with it, and of a row it shares,
 * the blocks in it, and the asides beside the first of them. A heading the
 * page marks (`data-fold="closed"`, a ticked one) opens folded; what's been
 * folded or opened since is kept, by the heading's level and words, while
 * the page is open, over every render, and written nowhere. Going to a place
 * in a folded section, from the outline or by a link in the page, opens the
 * sections around it first (`preview:open-to`, preview.js). Not on a slide.
 * Runs in the preview frame.
 */
(() => {
  // What's been folded (true) or opened (false) by hand, by the heading.
  const chosen = new Map();
  const HEADING = /^H[1-6]$/;
  const level = (h) => Number(h.tagName[1]);
  const keyOf = (h) => `${h.tagName}:${(h.querySelector('.section-title') ?? h).textContent.trim()}`;
  const folded = (h) => chosen.get(keyOf(h)) ?? h.dataset.fold === 'closed';

  // The text's blocks, in order, across its rows.
  const blocks = () => [...document.querySelectorAll('.gm-doc > .gm-pair > .gm-speaker > *')];

  function draw() {
    const all = blocks();
    const off = !document.querySelector('.gm-doc') || Preview.deck;
    // The levels of the folded headings whose sections are being walked.
    const open = [];
    for (const b of all) {
      const heading = HEADING.test(b.tagName);
      if (heading) while (open.length && open.at(-1) >= level(b)) open.pop();
      b.classList.toggle('fold-hidden', !off && open.length > 0);
      if (!heading || off) continue;
      dress(b);
      const shut = folded(b);
      b.classList.toggle('folded', shut);
      b.querySelector(':scope > .fold-toggle').setAttribute('aria-expanded', String(!shut));
      if (shut) open.push(level(b));
    }
    // A row with none of its text showing goes, asides and all; one with
    // its first block folded away keeps no asides about it.
    for (const pair of document.querySelectorAll('.gm-doc > .gm-pair')) {
      const said = [...pair.querySelectorAll(':scope > .gm-speaker > *')];
      const gone = said.length > 0 && said.every((b) => b.classList.contains('fold-hidden'));
      pair.classList.toggle('fold-hidden', gone);
      const asides = pair.querySelector(':scope > .gm-asides');
      asides?.classList.toggle('fold-hidden', !gone && Boolean(said[0]?.classList.contains('fold-hidden')));
    }
  }

  /** A heading's button, named for what it does to which section. */
  function dress(h) {
    h.classList.add('fold-heading');
    if (h.querySelector(':scope > .fold-toggle')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fold-toggle';
    b.setAttribute('aria-label', `Fold: ${(h.querySelector('.section-title') ?? h).textContent.trim()}`);
    h.prepend(b);
  }

  function toggle(h) {
    chosen.set(keyOf(h), !folded(h));
    draw();
    Preview.say(folded(h) ? 'Folded' : 'Opened');
  }

  document.addEventListener('click', (e) => {
    const button = e.target.closest?.('.fold-toggle');
    const h = button?.parentElement ?? e.target.closest?.('.fold-heading');
    if (!h || Preview.deck) return;
    // A box, a link or a button in the heading is its own.
    if (!button && e.target.closest('a, button, input, label, .field')) return;
    toggle(h);
  });

  // Going to a block in a folded section opens the sections around it: by
  // its line, as the outline and Go to say it, or by an element, as a link
  // in the page does.
  window.addEventListener('preview:open-to', (e) => {
    const all = blocks();
    const { line, target } = e.detail ?? {};
    let at = target ? all.findIndex((b) => b.contains(target)) : -1;
    if (at < 0 && line != null) at = all.findLastIndex((b) => b.dataset.line != null && Number(b.dataset.line) <= line);
    if (at < 0 || !all[at].classList.contains('fold-hidden')) return;
    // Each heading above it whose section it's in, nearest first.
    let within = level(all[at]) || 7;
    for (let k = at - 1; k >= 0; k--) {
      const h = all[k];
      if (!HEADING.test(h.tagName) || level(h) >= within) continue;
      within = level(h);
      if (folded(h)) chosen.set(keyOf(h), false);
    }
    draw();
  });

  Preview.register({ restore: draw });
})();
