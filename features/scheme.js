/**
 * Links written `scheme:path[label]` -- `scripture:[Isaiah 2:1-5]`,
 * `search:[commensality]` -- as an inline rule.
 *
 * Like markdown-it's own linkify, the rule looks at each `:`, and checks
 * that the scheme was written just before it, as a word of its own (not
 * after a letter, a digit or a backslash). Code is never seen, so is never
 * linked. What follows the colon is a path, which may be empty, then a
 * label in brackets; `link(path, label)` makes them a link, or returns null
 * to leave the text as typed.
 *
 *   schemeLinks(md, {
 *     name: 'scripture',
 *     scheme: 'scripture',
 *     path: /[\w/.:-]* /,
 *     link: (path, label) => ({ href, label, attrs?, after? }) | null,
 *     show: (found, alt) => html | null,
 *   })
 *
 * The label is markdown, as in any link. `attrs` are more attributes for the
 * link, ahead of its `href`; `after` is HTML to end the link with, after its
 * label.
 *
 * The same short link is also a URL, as markdown writes one, with what goes
 * before the brackets as its path: `[plowshares](scripture:isaiah/2/1-5)`
 * links where `scripture:isaiah/2/1-5[plowshares]` does, its words standing
 * for the brackets. And as markdown's `![alt](photo.jpg)` shows what it links
 * to, so does `![alt](yt:v/…)`, when the scheme has a `show`: what it draws
 * for what `link` found, in the place of the image. A scheme with nothing to
 * show (no `show`, or one that returns null) leaves the link, so nothing
 * breaks; elsewhere, the alt text reads as it's written.
 */

const BEFORE = /[\w\\]/;

/**
 * The rule underneath: `scheme:path[label]` found at its colon, and
 * `make(state, path, label, at)` called to push its tokens (or to return
 * false, leaving the text as typed; in silent mode it only answers whether
 * it would). `at` is where the scheme starts in `state.src`, and `end`
 * where the closing bracket ends.
 */
export function schemeRule(md, { name, scheme, path, make }) {
  const after = new RegExp(`^(${path.source})\\[([^\\]\\n]*)\\]`);
  md.inline.ruler.before('linkify', name, (state, silent) => {
    const colon = state.pos;
    if (state.src.charCodeAt(colon) !== 0x3A /* : */) return false;
    const start = colon - scheme.length;
    if (start < 0 || state.src.slice(start, colon) !== scheme) return false;
    if (start > 0 && BEFORE.test(state.src[start - 1])) return false;
    if (!state.pending.endsWith(scheme)) return false;
    const m = after.exec(state.src.slice(colon + 1, state.posMax));
    if (!m) return false;
    const end = colon + 1 + m[0].length;
    if (silent) {
      if (!make(null, m[1], m[2], { start, end })) return false;
    } else {
      const pending = state.pending;
      state.pending = pending.slice(0, -scheme.length);
      if (!make(state, m[1], m[2], { start, end })) {
        state.pending = pending;
        return false;
      }
    }
    state.pos = end;
    return true;
  });
}

export function schemeLinks(md, { name, scheme, path, link, show }) {
  knowScheme(md, scheme, { path: new RegExp(`^(?:${path.source})$`), link, show });
  schemeRule(md, {
    name,
    scheme,
    path,
    make: (state, where, text) => {
      const found = link(where, text);
      if (!found || !state) return Boolean(found);
      const open = state.push('link_open', 'a', 1);
      open.attrs = [...(found.attrs || []), ['href', state.md.normalizeLink(found.href)]];
      // The label is markdown, its brackets and backslashes as typed.
      const label = [];
      state.md.inline.parse(found.label.replace(/[[\]\\]/g, '\\$&'), state.md, state.env, label);
      // Nested in the link, as a link's own label would be. markdown-it keeps
      // a note on each token, in step with them, to pair up emphasis.
      for (const t of label) t.level += state.level;
      state.tokens.push(...label);
      state.tokens_meta.push(...label.map(() => null));
      if (found.after) state.push('html_inline', '', 0).content = found.after;
      state.push('link_close', 'a', -1);
      return true;
    },
  });
}

/** The schemes each renderer knows: `scheme -> { path, link, show }`. */
const KNOWN = new WeakMap();

function knowScheme(md, scheme, entry) {
  if (!KNOWN.has(md)) {
    KNOWN.set(md, new Map());
    // Right after the inline rules, so every feature after it sees the
    // links as they'll be drawn, not the short links they were written as.
    md.core.ruler.after('inline', 'scheme_urls', (state) => {
      for (const t of state.tokens) {
        if (t.type === 'inline' && t.children) t.children = resolve(md, state.Token, t.children);
      }
    });
  }
  KNOWN.get(md).set(scheme, entry);
}

/** What `url` links to, `{ found, known }`, if it's a short link `md` knows. */
function lookUp(md, url, words) {
  const colon = url.indexOf(':');
  const known = colon > 0 && KNOWN.get(md).get(url.slice(0, colon));
  if (!known) return null;
  // The URL as markdown-it normalized it, percent-encoded, read back.
  let where = url.slice(colon + 1);
  try { where = decodeURI(where); } catch { /* as it is */ }
  if (!known.path.test(where)) return null;
  const found = known.link(where, words);
  return found && { found, known };
}

/** The words of some inline tokens, as text. */
const words = (tokens) => tokens.map((t) => {
  if (t.type === 'image') return t.content;
  return t.type === 'text' || t.type === 'code_inline' ? t.content : '';
}).join('');

/** An inline token list, its short-link URLs resolved. */
function resolve(md, Token, tokens) {
  const html = (content, level) => Object.assign(new Token('html_inline', '', 0), { content, level });
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'link_open') {
      const close = closing(tokens, i);
      const hit = lookUp(md, t.attrGet('href') ?? '', words(tokens.slice(i + 1, close)));
      if (hit?.found.attrs || hit?.found.after) {
        // The link's own words, with what the scheme adds to them.
        const { found } = hit;
        t.attrs = [...(found.attrs || []), ...t.attrs.filter(([name]) => name !== 'href'), ['href', md.normalizeLink(found.href)]];
        out.push(...tokens.slice(i, close));
        if (found.after) out.push(html(found.after, t.level + 1));
        i = close - 1;
        continue;
      }
      if (hit) t.attrSet('href', md.normalizeLink(hit.found.href));
      out.push(t);
    } else if (t.type === 'image') {
      const hit = lookUp(md, t.attrGet('src') ?? '', t.content);
      if (!hit) { out.push(t); continue; }
      const { found, known } = hit;
      const shown = known.show?.(found, t.content);
      if (shown) { out.push(html(shown, t.level)); continue; }
      // Nothing to show: the link, its words the alt text, or the scheme's.
      const open = new Token('link_open', 'a', 1);
      const title = t.attrGet('title');
      open.attrs = [...(found.attrs || []), ['href', md.normalizeLink(found.href)], ...(title ? [['title', title]] : [])];
      open.level = t.level;
      const label = t.children?.length ? t.children : [Object.assign(new Token('text', '', 0), { content: found.label })];
      for (const w of label) w.level += t.level + 1;
      const close = new Token('link_close', 'a', -1);
      close.level = t.level;
      out.push(open, ...label, ...(found.after ? [html(found.after, t.level + 1)] : []), close);
    } else {
      out.push(t);
    }
  }
  return out;
}

/** Where the link opened at `at` closes. */
function closing(tokens, at) {
  let depth = 0;
  for (let i = at; i < tokens.length; i++) {
    if (tokens[i].type === 'link_open') depth++;
    else if (tokens[i].type === 'link_close' && --depth === 0) return i;
  }
  return tokens.length;
}
