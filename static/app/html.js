/**
 * A page's HTML, read here in the app (gh-272).
 *
 * The app's policy allows no inline style (`style-src 'self'`), and every
 * browser's parser, WebKit's above all, refuses each `style="…"` it meets in
 * HTML read in the app, each refusal an error in the console, though the
 * page itself, in its frame, is drawn with them. So each tag's `style` is
 * renamed `data-style` before it's read (`readPage`), and named `style`
 * again in what's written back out for a frame to draw (`writePage`).
 *
 * Only tags are touched: the renderer escapes a `<` in the text
 * (markdown-it's `html: false`), and a quote in an attribute's value is
 * `&quot;`, so ` style="` can only start an attribute of a tag. Nothing on
 * a page is written `data-style` by a feature, so none is mistaken for one.
 */

// A tag, its attributes' values each in double quotes, as the renderer
// writes them and as `innerHTML` writes them back.
const TAG = /<[a-z][^>"]*(?:"[^"]*"[^>"]*)*>/gi;
const rename = (html, from, to) => html.replace(TAG, (tag) => tag.replace(new RegExp(`(\\s)${from}="`, 'g'), `$1${to}="`));

/** `body` with each tag's `style` renamed `data-style`, as it's read in the app. */
export const unstyled = (body) => rename(body, 'style', 'data-style');

/** `body`, a page's HTML, read as a document of its own, without its inline styles. */
export function readPage(body) {
  return new DOMParser().parseFromString(`<body>${unstyled(body)}</body>`, 'text/html');
}

/** What `doc`, read by `readPage`, holds now, as HTML with its inline styles back, for a frame to draw. */
export function writePage(doc) {
  return rename(doc.body.innerHTML, 'data-style', 'style');
}
