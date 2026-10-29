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
 * A page's name, from its first heading, and whether it's done: by its
 * opening heading's own box if it has one; otherwise when everything on it
 * to be done is, and every question is answered. With none of those there's
 * nothing to do on it, and `done` is null.
 */
export function mark(body, i) {
  const doc = new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html');
  const heading = doc.querySelector(HEADINGS);
  const title = heading?.textContent.trim() || `Page ${i + 1}`;
  const own = heading?.querySelector(':scope > [data-done]');
  if (own) return { title, done: own.dataset.done === 'true' };
  const things = [...doc.querySelectorAll('[data-done]')].map((t) => t.dataset.done);
  const questions = [...doc.querySelectorAll('[data-answered]')].map((q) => q.dataset.answered);
  const all = [...things, ...questions];
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
