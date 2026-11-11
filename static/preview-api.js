/**
 * What the preview frame offers the scripts drawn into it: a feature's
 * `preview.js` (served from its directory in features/) and each kind of
 * puzzle. Loaded before them; static/preview.js, loaded after, puts the
 * rendered document in place and calls the hooks.
 *
 *   Preview.edit(edits, { undo, drawn })
 *     Edits to the file go up as lines to replace: lines `from` up to `to`,
 *     which read `before`, become `after` (see edits.js). `undo` asks for
 *     the edit to go on the editor's undo stack; `drawn` says the page
 *     already shows it, so it needn't be rendered again. Edits asked for
 *     while one click or key is handled are held to the end of the turn (a
 *     microtask) and go up together, those with the same options as one
 *     edit and one undo. So features that answer the same click (a step
 *     done, the ingredient it uses up) needn't know of each other. Nor
 *     when they write the same line, each from the line as it was drawn
 *     (a blank in a choice's line filled, and the choice picked by it):
 *     the edits become one, both changes made where they change different
 *     parts of it, the later one's where they don't, and go up with the
 *     options of the first asked. Likewise an edit of a line that an
 *     earlier turn has written since the page was drawn, made from the line
 *     as its feature last knew it, is made on what that turn wrote.
 *
 *   Preview.flush()
 *     Sends the edits held so far now, not at the end of the turn.
 *
 *   Preview.startOver({ from, to })
 *     Clears every answer on the lines `from` up to (not including) `to`,
 *     all that's drawn if not told which, and returns the edits that write
 *     it, as one list, sending nothing: whoever asked says what becomes of
 *     them, as a reset button sends them up as one undo. It's the one
 *     definition of clearing, and needs no click, nor a page that can be
 *     worked. `preview:start-over` is sent to the document with `detail`
 *     `{ within(line), edits }`, and each feature with answers on the page
 *     clears those on lines `within` says, on the page too, and adds the
 *     edits to `edits`, rather than asking for them itself. Features that
 *     write the same line needn't know of each other, as with `edit`.
 *
 *   Preview.register({ keep, restore, drawn })
 *     Each render replaces the page. `keep()` is called just before, to say
 *     what to carry over (a field being typed in, a puzzle being played);
 *     `restore(root, kept)` just after, with what it said. `drawn()` says
 *     what the feature drew on the page, under its name, for a page that
 *     will have nothing to draw it (an export): `{ mermaid: { text: svg } }`.
 *
 *   Preview.wait(promise)
 *     For what's drawn after a render, settling once it's in place (a
 *     diagram): a slide is fitted again then, and a measurement of it
 *     waits for it.
 *
 *   Preview.say(text)
 *     Says `text` to a screen reader, as what a click or a key did (the
 *     step lit, where a puzzle's cursor went, a timer run out). It's said
 *     in the frame's one live region, kept outside <body>, which each render
 *     replaces, and there from the start, so the first thing said is heard
 *     too. The same text said again is still heard.
 *
 *   Preview.address, Preview.setAddress(params)
 *     How the page is set to be seen, as the app's address keeps it, so a
 *     view can be shared or reloaded (`#review.md?by=%23`): an object of
 *     strings, set before each render is drawn, and again, with
 *     `preview:address` sent to the window, when only the address changes.
 *     A feature sets it with `setAddress`, which tells the app and sends
 *     `preview:address` too; it isn't the file, so nothing is written.
 *
 *   Preview.fromApp(e)
 *     Whether a message is the app's: from the page around the frame, at
 *     one of the app's origins, which the server names in the frame's
 *     `<meta name="app">` as its `frame-ancestors` does. What the frame
 *     sends goes to `'*'`: its policy lets nothing but the app frame it.
 *
 *   Preview.deck
 *     Whether a slide is showing, when clicks and keys drive the deck.
 *
 *   Preview.running
 *     Whether the page is being run, in Work or on a slide, rather than
 *     written, in Edit, where it's drawn again at each keystroke. Each
 *     render sets it, before the features put back what they kept.
 *
 *   Preview.workable
 *     Whether the page can be worked here: a blank filled in, a box
 *     ticked, a choice or a date picked, a card marked done, a step lit.
 *     It's the frame's word for what workable() in features/blank.js drew
 *     the page by, and the one every feature reads before it takes a click
 *     or a key. Each render sets it, false on a slide, which the deck keeps
 *     shut; it may be set again while the page is showing, and what's done
 *     after goes by it. While it's false, <html> is marked `unworkable`, so
 *     what can't be worked doesn't look as if it could. When it changes,
 *     `preview:workable` is sent to the window: what's open to be worked
 *     (a blank being typed in, a calendar) closes, and what the keyboard
 *     could reach is taken out of its way, as the server would have drawn
 *     it, by `Preview.shut`.
 *
 *   Preview.shut(el, attrs)
 *     Sets `el`'s attributes to `attrs` while the page can't be worked, one
 *     that's null taken off (`{ tabindex: null, disabled: '' }`), and puts
 *     back what they were once it can be again. The keyboard leaves it.
 *
 *   Preview.closed
 *     Whether the page is a record, past the time it was open until: set
 *     by each render, and when that time comes while it's showing. A
 *     record can't be worked either, and nothing in it is changed, not
 *     even what can be on a slide (a puzzle). While it's true, <html> is
 *     marked `closed`; when it changes, `preview:closed` is sent.
 */
(() => {
  const APP = (document.querySelector('meta[name="app"]')?.content ?? '').split(/\s+/).filter(Boolean);
  const hooks = [];
  const pending = new Set();
  // The edits asked for in this turn, under their options, in the order asked.
  let held = null;
  const flush = () => {
    const sending = held;
    held = null;
    for (const { edits, opts } of joined([...sending?.values() ?? []])) {
      window.parent.postMessage({ type: 'edit', edits: edits.map(rebase), ...opts }, '*');
    }
  };
  // The lines written since the page was drawn, as each was last written.
  const written = new Map();
  /**
   * Edit `e`, if it's of a line written since the page was drawn and reads
   * it otherwise, made on what was written: the change it makes made there
   * too, where that's another part of the line than what was written.
   */
  function onWritten(e) {
    if (!oneLine(e)) return e;
    const now = written.get(e.from);
    const both = now !== undefined && now !== e.before[0] && merge(e.before[0], now, e.after[0]);
    return both ? { ...e, before: [now], after: [both] } : e;
  }
  const oneLine = (e) => e.to === e.from + 1 && e.before.length === 1 && e.after.length === 1;
  /** Edit `e` made on what's been written, as it's going up: what's written from now on. */
  function rebase(e) {
    const out = onWritten(e);
    if (oneLine(out)) written.set(out.from, out.after[0]);
    else if (out.before.length !== out.after.length) written.clear();
    return out;
  }
  const overlap = (a, b) => a.from < b.to && b.from < a.to;
  /** The turn's edits under their options, those touching the lines of an earlier ask's going up with it. */
  function joined(asks) {
    const out = [];
    for (const ask of asks) {
      const into = out.find((o) => o.edits.some((a) => ask.edits.some((b) => overlap(a, b))));
      if (into) into.edits.push(...ask.edits);
      else out.push({ edits: [...ask.edits], opts: ask.opts });
    }
    for (const o of out) o.edits = o.edits.reduce(combine, []);
    return out;
  }
  /** `edits` and `e`, an edit of the same lines from what they read made one with it. */
  function combine(edits, e) {
    const same = (a) => a.from === e.from && a.to === e.to && a.before.join('\n') === e.before.join('\n');
    const i = edits.findIndex(same);
    if (i < 0) return [...edits, e];
    const was = edits[i];
    const both = was.before.length === 1 && was.after.length === 1 && e.after.length === 1
      && merge(e.before[0], was.after[0], e.after[0]);
    return edits.with(i, { ...e, after: both === false ? e.after : [both] });
  }
  /** Where `after` differs from `base`: the stretch of `base` replaced, and with what. */
  function changed(base, after) {
    let start = 0;
    while (start < base.length && start < after.length && base[start] === after[start]) start++;
    let end = base.length;
    let to = after.length;
    while (end > start && to > start && base[end - 1] === after[to - 1]) {
      end--;
      to--;
    }
    return { start, end, text: after.slice(start, to) };
  }
  /** `base` with the changes of both `x` and `y` made, or false where they change the same part. */
  function merge(base, x, y) {
    if (x === y) return x;
    let [a, b] = [changed(base, x), changed(base, y)];
    if (a.start > b.start) [a, b] = [b, a];
    if (a.end > b.start) return false;
    return base.slice(0, a.start) + a.text + base.slice(a.end, b.start) + b.text + base.slice(b.end);
  }
  let workable = true;
  let closed = false;
  // What each element shut had, to put back.
  const stowed = new Map();
  const reopen = () => {
    for (const [el, had] of stowed) {
      for (const [name, value] of Object.entries(had)) {
        if (value == null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
    }
    stowed.clear();
  };
  // What's said, for a screen reader: in a live region outside <body>, the
  // last child of <html>, out of sight (`.vh`, in the document's CSS).
  const heard = document.createElement('div');
  heard.className = 'vh';
  heard.setAttribute('aria-live', 'polite');
  document.documentElement.append(heard);
  window.Preview = {
    say(text) {
      if (!heard.isConnected) document.documentElement.append(heard);
      // The same again is still heard.
      heard.textContent = heard.textContent === text ? `${text}\u00a0` : text;
    },
    fromApp: (e) => e.source === window.parent && APP.includes(e.origin),
    deck: false,
    address: {},
    setAddress(params) {
      this.address = { ...params };
      window.parent.postMessage({ type: 'address', params: this.address }, '*');
      window.dispatchEvent(new Event('preview:address'));
    },
    get workable() {
      return workable;
    },
    set workable(on) {
      const was = workable;
      workable = Boolean(on);
      document.documentElement.classList.toggle('unworkable', !workable);
      if (workable) reopen();
      if (was !== workable) window.dispatchEvent(new Event('preview:workable'));
    },
    shut(el, attrs) {
      if (el.contains(document.activeElement)) document.activeElement.blur();
      const had = stowed.get(el) ?? {};
      for (const [name, value] of Object.entries(attrs)) {
        if (!(name in had)) had[name] = el.getAttribute(name);
        if (value == null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
      stowed.set(el, had);
    },
    get closed() {
      return closed;
    },
    set closed(on) {
      const was = closed;
      closed = Boolean(on);
      document.documentElement.classList.toggle('closed', closed);
      if (closed) this.workable = false;
      if (was !== closed) window.dispatchEvent(new Event('preview:closed'));
    },
    edit(edits, opts = {}) {
      if (!held) {
        held = new Map();
        queueMicrotask(flush);
      }
      const key = JSON.stringify(opts);
      if (held.has(key)) held.get(key).edits.push(...edits);
      else held.set(key, { edits: [...edits], opts });
    },
    flush,
    startOver({ from = 0, to = Infinity } = {}) {
      const within = (line) => line >= from && line < to;
      const edits = [];
      document.dispatchEvent(new CustomEvent('preview:start-over', { detail: { within, edits } }));
      // Each from the line as its feature knew it, so those of a line become one.
      return edits.map(onWritten).reduce(combine, []);
    },
    register(hook) {
      hooks.push(hook);
    },
    wait(promise) {
      const p = Promise.resolve(promise).finally(() => {
        pending.delete(p);
        window.dispatchEvent(new Event('preview:drawn'));
      });
      pending.add(p);
    },
    /** For preview.js: what's still being drawn. */
    pending: () => [...pending],
    /** For preview.js: what every feature drew on the page. */
    drawn: () => Object.assign({}, ...hooks.map((h) => h.drawn?.())),
    /** For preview.js: runs `render` between the hooks' keep and restore. */
    replace(root, render) {
      const kept = hooks.map((h) => h.keep?.());
      written.clear();
      render();
      hooks.forEach((h, i) => h.restore?.(root, kept[i]));
    },
  };
})();
