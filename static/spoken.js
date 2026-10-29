/**
 * A slide as a screen reader hears it: an image by its alt, a field by its
 * label and value, nothing hidden from it, and no more than a sentence or
 * two of a long one (a table, a column). The stage says what a step showed
 * with it (preview.js), and the deck names a slide by its title with it, in
 * the overview, so the two say a slide alike; this is what they share, as
 * `window.Spoken`.
 */
(() => {
  const LONG = 200;
  const BLOCK = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|BR|DD|DIV|DL|DT|FIGCAPTION|FIGURE|FOOTER|H[1-6]|HEADER|HR|LI|OL|P|PRE|SECTION|TABLE|TD|TH|TR|UL)$/;

  /** A slide's title, in `doc`: the heading the server set apart, or an opening one that isn't a step. */
  function title(doc) {
    const h = doc.querySelector('.slide-title') || doc.querySelector('.gm-doc :is(h1, h2, h3, h4, h5, h6)');
    return h && !h.closest('[data-step]') ? short(spoken(h, Infinity)) : '';
  }

  /** The text of `node` as it's heard, steps after the `k`th left out. */
  function spoken(node, k) {
    if (node.nodeType === Node.TEXT_NODE) return node.data;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.hidden || node.getAttribute('aria-hidden') === 'true' || Number(node.dataset.step) > k) return '';
    if (node.tagName === 'IMG') return node.alt || '';
    if (node.matches('.field')) return field(node, k);
    // A caption that only repeats its image's alt is said once.
    if (node.tagName === 'FIGCAPTION' && node.textContent.trim() === node.parentElement.querySelector('img')?.alt.trim()) return '';
    const text = [...node.childNodes].map((n) => spoken(n, k)).join('');
    return BLOCK.test(node.tagName) ? ` ${text} ` : text;
  }

  /** A field as its label and what's in it: `Name: Josh`, `Thoughts: blank`, `Hours: blank, e.g. 7.5`. */
  function field(node, k) {
    const label = node.querySelector(':scope > .field-label');
    const value = node.querySelector(':scope > .field-value');
    let said = value ? spoken(value, k).trim() : '';
    // An empty definition says so only through the stylesheet.
    // An empty field says what goes there, if it's hinted (features/blank.js).
    if (!said) said = node.matches('.def-blank') ? 'not yet defined' : ['blank', value?.dataset.hint].filter(Boolean).join(', ');
    return label ? ` ${spoken(label, k).trim()}: ${said} ` : ` ${said} `;
  }

  /** `text` in one line, cut to a sentence or two if it's long. */
  function short(text) {
    const line = text.replace(/\s+/g, ' ').trim();
    if (line.length <= LONG) return line;
    const cut = line.slice(0, LONG);
    const sentence = cut.match(/^.*[.!?](?=\s)/)?.[0];
    return sentence && sentence.length > LONG / 4 ? sentence : `${cut.replace(/\s+\S*$/, '')}…`;
  }

  window.Spoken = { title, spoken, short };
})();
