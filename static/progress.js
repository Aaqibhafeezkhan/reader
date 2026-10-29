/**
 * How far along something is, drawn as a bar and said in words: "3 of 11".
 * For the page's `progress:` (features/progress) and for whatever else
 * counts what's done, alike.
 */

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** `done` of `of`, in words. */
export const progressWords = (done, of) => `${done} of ${of}`;

/**
 * A bar `done` of `of` full, with the count beside it: a native progress
 * bar, so it's read as one, named `name` (what's counted, "pages"), and
 * shown in the system's colours where colours are forced. `attrs` are more
 * attributes for its span. With nothing to count, it's empty.
 */
export function progressBar(done, of, { name = 'Progress', attrs = '' } = {}) {
  const max = of > 0 ? of : 1;
  const value = Math.min(Math.max(done, 0), max);
  return `<span class="progress"${attrs}><progress value="${value}" max="${max}" aria-label="${escape(name)}"></progress>`
    + ` <span class="progress-count">${escape(progressWords(done, of))}</span></span>`;
}
