/**
 * Which pages of a deck are done, and how many: for Work's dots and its bar,
 * and for the bar a deck shows while it's presented. Read by meaning, from
 * what the features tag on the page (features/source.js's tags), whichever
 * drew it: a thing to be done says whether it is (`data-done`), and a
 * question whether it's answered (`data-answered`).
 */

import { progressBar, progressWords } from '../progress.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * A page's name, from its first heading, and whether it's done: as its
 * opening heading says, if it says whether its section is done; otherwise
 * when everything on it to be done is, and every question is answered, a
 * heading under it that says whether its section is done counting as one
 * of them, for all that's in its section. With none of those there's
 * nothing to do on it, and `done` is null.
 */
export function mark(body, i) {
  const doc = new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html');
  const heading = doc.querySelector(HEADINGS);
  // As a screen reader hears it, an image by its alt, as the deck names a slide (spoken.js).
  const title = (heading && Spoken.short(Spoken.spoken(heading, Infinity))) || `Page ${i + 1}`;
  const says = (h) => h.querySelector(':scope > [data-done]');
  if (heading && says(heading)) return { title, done: says(heading).dataset.done === 'true' };
  const all = [];
  // The level of the section being passed over, its heading counted; 0 for none.
  let inside = 0;
  for (const n of doc.querySelectorAll(`${HEADINGS}, [data-done], [data-answered]`)) {
    if (n.matches(HEADINGS)) {
      const level = Number(n.tagName[1]);
      if (inside && level <= inside) inside = 0;
      if (!inside && says(n)) {
        all.push(says(n).dataset.done);
        inside = level;
      }
    } else if (!inside && !n.closest(HEADINGS)) all.push(n.dataset.done ?? n.dataset.answered);
  }
  if (!all.length) return { title, done: null };
  return { title, done: all.every((v) => v === 'true') };
}

/** Of `marks`, how many pages are done, of those with something to do. */
export function tally(marks) {
  const counted = marks.filter((m) => m.done != null);
  return { done: counted.filter((m) => m.done).length, of: counted.length };
}

/**
 * Draws into `into` a bar of how many of `marks` are done, "7 of 12 done";
 * nothing, when no page has anything to do.
 */
export function drawDone(into, marks) {
  const { done, of } = tally(marks);
  into.hidden = !of;
  if (!of) return into.replaceChildren();
  into.innerHTML = progressBar(done, of, { name: 'Pages done' });
  into.querySelector('.progress-count').textContent = `${progressWords(done, of)} done`;
}
