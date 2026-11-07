/**
 * A deck being worked through: a workbook, a page to a slide, one shown at a
 * time. Under it are Back and Next and a dot for each page, filled once the
 * page is done (see done.js), and a bar of how many are; a long one's dots
 * go in blocks (see dots.js), and a bar too narrow for them goes without.
 */

import { el } from './state.js';
import { renderNow } from './render.js';
import { layout } from './dots.js';
import { mark, tally, drawDone } from './done.js';

const book = {
  pages: null,          // [{ body, line }] while a deck is being worked through
  index: 0,
  path: null,           // the file `index` is a page of
  line: null,           // a line of the file to open on the page of, at the next render
};

/** Is a page of a workbook showing? */
export const paged = () => Boolean(book.pages);

/** Opens on the page `line` of the file is on, when the pages next arrive. */
export function openAt(line) {
  book.line = line;
}

/**
 * Takes a render's pages, if it had any, for the file at `path`. Returns the
 * one to show, or null when the file isn't being worked through as a deck.
 */
export function setPages(pages, path) {
  book.pages = pages ?? null;
  el.pages.hidden = !pages;
  if (!pages) return null;
  if (book.line != null) book.index = Math.max(0, pages.findLastIndex((p) => p.line <= book.line));
  else if (book.path !== path) book.index = 0;
  book.line = null;
  book.path = path;
  book.index = Math.min(book.index, pages.length - 1);
  draw();
  return pages[book.index];
}

export function turnTo(i) {
  if (!book.pages) return;
  const index = Math.min(book.pages.length - 1, Math.max(0, i));
  if (index === book.index) return;
  book.index = index;
  draw();
  // Drawn again from the file, which has whatever was filled in since.
  renderNow({ resetScroll: true });
}

export const turn = (by) => turnTo(book.index + by);

/** Turns to the page that line `line` of the file is on. */
export function turnToLine(line) {
  if (book.pages) turnTo(Math.max(0, book.pages.findLastIndex((p) => p.line <= line)));
}

export function wirePages() {
  el.pageBack.addEventListener('click', () => turn(-1));
  el.pageNext.addEventListener('click', () => turn(1));
  // A window made narrower, or a phone turned, can leave the dots no room.
  new ResizeObserver(fit).observe(el.pages);
}

/**
 * The bar is one line: its dots, if they fit on it beside Back and Next and
 * what's said of the pages, or else none, and "Page 1 of 12" says where the
 * page is, as on a phone. Measured with the dots in, at their own width.
 */
export function fit() {
  el.pages.classList.remove('crowded');
  el.pages.classList.toggle('crowded', el.pageDots.scrollWidth > el.pageDots.clientWidth);
}

function dot({ title, done }, i, index) {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'page-dot';
  dot.classList.toggle('done', Boolean(done));
  dot.classList.toggle('now', i === index);
  dot.title = title;
  dot.setAttribute('aria-label', `Page ${i + 1}: ${title}${done ? ', done' : ''}`);
  if (i === index) dot.setAttribute('aria-current', 'page');
  dot.addEventListener('click', () => turnTo(i));
  return dot;
}

/**
 * A closed block of pages, named by its first and filled as far as its pages
 * are done; it opens on its first.
 */
function block(marks, from, to) {
  const range = `${from + 1}–${to}`;
  const { done, of } = tally(marks.slice(from, to));
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'page-block';
  b.textContent = from + 1;
  b.style.setProperty('--done', `${of ? (100 * done) / of : 0}%`);
  b.classList.toggle('done', of > 0 && done === of);
  const summary = `Pages ${range}${of ? `, ${done} of ${of} done` : ''}`;
  b.title = summary;
  b.setAttribute('aria-label', summary);
  b.addEventListener('click', () => turnTo(from));
  return b;
}

function draw() {
  const { pages, index } = book;
  // A dot or a block clicked is drawn again: the keyboard goes on to the page's own dot.
  const had = el.pageDots.contains(document.activeElement);
  const marks = pages.map((p, i) => mark(p.body, i));
  el.pageDots.replaceChildren(...layout(pages.length, index).map((m) => {
    const li = document.createElement('li');
    li.append('page' in m ? dot(marks[m.page], m.page, index) : block(marks, m.from, m.to));
    return li;
  }));
  if (had) el.pageDots.querySelector('[aria-current="page"]')?.focus();
  el.pageCount.textContent = `Page ${index + 1} of ${pages.length}`;
  drawDone(el.pageDone, marks);
  // Back at the first page, or Next at the last, can't keep the keyboard.
  const at = document.activeElement;
  el.pageBack.disabled = index === 0;
  el.pageNext.disabled = index === pages.length - 1;
  if (at === el.pageBack && el.pageBack.disabled) el.pageNext.focus();
  if (at === el.pageNext && el.pageNext.disabled) el.pageBack.focus();
  fit();
}
