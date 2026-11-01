/**
 * Puzzles in the rendered page.
 *
 * A fence whose info string names a puzzle (```sudoku) comes from the server
 * wrapped as `<div class="puzzle" data-kind="sudoku" data-puzzle="k">`, its
 * text still inside as a code block, and is drawn here from that text. The
 * text is the whole of the puzzle's state: a move redraws the puzzle and posts
 * the new text up, and the editor writes it back into the fence, so progress
 * saves like typing and reads as plain text anywhere else.
 *
 * A puzzle whose board is kept in a file (```maze mazes/one.maze) comes with
 * that file's text in `data-source`. A kind sees the file's text and then the
 * fence's, as if they were one; it keeps the file's part as it was, and only
 * the fence's part is posted up, so the file is never written to.
 *
 * Click a puzzle (or Tab to it) to play; while it has focus it takes the
 * keys. Esc hands them back, the puzzle keeping the focus, and Enter takes
 * them again. A screen reader hears it as an application, named by its
 * kind, and hears where each key leaves it. In a record, a page past the
 * time it was open until (`Preview.closed`), a puzzle is drawn as it was
 * left, and takes no keys or clicks, nor the keyboard.
 *
 * A move goes up as an edit to the lines inside the fence, which the server
 * names as `data-from` and `data-to` (see edits.js), each line starting with
 * `data-prefix` for a puzzle in a quote or a list.
 *
 * What each puzzle drew is also handed back (`Preview.drawn()`), for an
 * export, which has nothing to draw them: by its kind and text, the board
 * as it stands, and the styles every board takes.
 *
 * Each kind lives in kinds/<kind>.js and registers itself here with
 * `mount(host, text, ui, post)`: draw the puzzle into `host` from `text`
 * (false if the text can't be read), keep what the reader was doing in `ui`,
 * and call `post(before, after)` with the fence's text after each move. It
 * draws through `frame`, saying what it's called and where a key leaves it.
 * Alongside, without the page, it gives `parse(text)` (its state, or null),
 * `format(state)` (the text again), `solved(state)` and the `rules` a move
 * follows, which kinds.test.js checks.
 */
(() => {
  const KINDS = {};

  // What the reader was doing in each puzzle -- where the cursor was, whether
  // pencil marks were on -- kept across re-renders, which replace the page.
  const memory = new Map();
  // Each board drawn, by its kind and text, and the styles they take.
  const keys = new WeakMap();
  // What each board says after a key, for a screen reader (Preview.say).
  const tells = new WeakMap();
  let styles = '';

  function register(kind, impl, css = '') {
    KINDS[kind] = impl;
    if (css) addStyle(css);
  }

  /** Draws every puzzle under `root`; puzzle `focus`, if given, takes focus. */
  function hydrate(root, focus = null) {
    for (const host of root.querySelectorAll('.puzzle[data-kind]')) {
      const kind = KINDS[host.dataset.kind];
      if (!kind) continue;
      const index = Number(host.dataset.puzzle);
      // markdown leaves a code block ending in a newline the fence didn't have
      const own = (host.querySelector('code')?.textContent ?? '').replace(/\n$/, '');
      if (host.dataset.sourceError != null) {
        unreadable(host, host.dataset.sourceError);
        continue;
      }
      const source = host.dataset.source;
      const lead = source == null ? '' : `${source}\n`;
      const text = source == null ? own : `${lead}${own}`;
      if (!memory.has(index)) memory.set(index, {});
      // The fence's lines, kept up to date as moves change how many there
      // are, since the page isn't rendered again after a move.
      const from = Number(host.dataset.from);
      let to = Number(host.dataset.to);
      const prefix = host.dataset.prefix ?? '';
      const fenced = (t) => lines(t).map((l) => prefix + l);
      const send = (before, after) => {
        if (Preview.closed) return;
        const edit = { from, to, before: fenced(before), after: fenced(after) };
        to = from + edit.after.length;
        Preview.edit([edit], { drawn: true });
      };
      const post = (before, after) => {
        if (!lead) return send(before, after);
        const fence = (t) => (t === source ? '' : t.startsWith(lead) ? t.slice(lead.length) : null);
        if (fence(before) !== null && fence(after) !== null) send(fence(before), fence(after));
        else console.warn(`puzzle ${index}: a move changed the board kept in its file; not saved`);
      };
      if (!kind.mount(host, text, memory.get(index), post)) {
        unreadable(host, source == null ? '' : 'its board file');
        continue;
      }
      keys.set(host, `${host.dataset.kind}\n${text}`);
      // Ahead of the kind's own, which a record's puzzle doesn't hear.
      for (const type of ['keydown', 'pointerdown', 'pointermove', 'pointerup', 'click', 'dblclick']) {
        host.addEventListener(type, (e) => { if (Preview.closed) e.stopImmediatePropagation(); }, true);
      }
      playable(host);
      // After the kind's own keys: a key it took is heard.
      host.addEventListener('keydown', (e) => { if (e.defaultPrevented) tells.get(host)?.(); });
      host.addEventListener('focusout', (e) => { if (!host.contains(e.relatedTarget)) host.classList.remove('puzzle-resting'); });
      host.addEventListener('pointerdown', () => host.classList.remove('puzzle-resting'));
      if (index === focus) host.focus({ preventScroll: true });
    }
  }

  const lines = (s) => (s === '' ? [] : s.split('\n'));

  /** A puzzle drawn is one Tab reaches, to play, unless the page is a record. */
  function playable(host) {
    if (Preview.closed) {
      if (host.contains(document.activeElement)) document.activeElement.blur();
      host.removeAttribute('tabindex');
      host.removeAttribute('role');
    } else {
      host.tabIndex = 0;
      host.setAttribute('role', 'application');
    }
  }
  window.addEventListener('preview:closed', () => {
    for (const host of document.querySelectorAll('.puzzle[data-kind]')) if (keys.has(host)) playable(host);
  });

  function unreadable(host, why) {
    host.classList.add('puzzle-unreadable');
    if (!why) return;
    const note = document.createElement('p');
    note.className = 'puzzle-error';
    note.textContent = `Couldn't read ${why}`;
    host.prepend(note);
  }

  /**
   * Keys a focused puzzle keeps from the page: all but shortcuts and Tab,
   * and none once Esc has handed them back (`rest`), till Enter.
   */
  function owns(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab') return false;
    const host = e.currentTarget;
    if (!host?.classList?.contains('puzzle-resting')) return true;
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      host.classList.remove('puzzle-resting');
    }
    return false;
  }

  /** Hands the keys back to the page, keeping the focus on the puzzle. */
  function rest(host) {
    host.classList.add('puzzle-resting');
  }

  /**
   * Puts `board` in `host` with a status bar under it and a list of `keys`
   * ([key, what it does] pairs) that `?` shows, the puzzle called `name`.
   * After each key it takes, a screen reader hears `where()` and the bar.
   * Returns the bar and the list.
   */
  function frame(host, board, keys, { name, where = () => '' } = {}) {
    if (name) {
      host.setAttribute('aria-label', name);
      board.setAttribute('role', 'img');
      board.setAttribute('aria-label', `${name} board`);
    }
    const bar = document.createElement('div');
    bar.className = 'puzzle-bar';
    const help = document.createElement('dl');
    help.className = 'puzzle-help';
    for (const [k, what] of keys) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = what;
      help.append(dt, dd);
    }
    host.replaceChildren(board, bar, help);
    // Read after each key: where it left the puzzle, and how it stands.
    tells.set(host, () => {
      if (!host.contains(document.activeElement)) return;
      if (host.classList.contains('puzzle-resting')) return Preview.say('Keys handed back. Enter to play');
      const status = bar.textContent.replace(/(^| · )\? for keys$/, '');
      Preview.say([where(), status].filter(Boolean).join('. '));
    });
    return { bar, help };
  }

  function addStyle(css) {
    styles += css;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
  }

  addStyle(`
.puzzle { margin: 1rem 0; outline: none; break-inside: avoid; }
.puzzle:focus-visible { outline: 2px solid var(--gm-accent); outline-offset: 4px; }
.puzzle.puzzle-resting:focus { outline: 2px dashed var(--gm-ink-soft); outline-offset: 4px; }
.puzzle-bar {
  font-family: var(--gm-sans); font-size: 0.8rem; color: var(--gm-ink-soft);
  margin-top: 0.4rem; min-height: 1.2em; visibility: hidden;
}
.puzzle:focus-within .puzzle-bar, .puzzle.solved .puzzle-bar { visibility: visible; }
.puzzle.solved .puzzle-bar { color: var(--gm-ok); font-weight: 600; font-size: 0.95rem; }
.puzzle-help {
  display: grid; grid-template-columns: max-content 1fr; gap: 0.15rem 0.8rem;
  font-family: var(--gm-sans); font-size: 0.8rem; margin: 0.4rem 0 0;
}
.puzzle-help[hidden] { display: none; }
.puzzle-help dt { font-weight: 600; }
.puzzle-help dd { margin: 0; color: var(--gm-ink-soft); }
.puzzle-unreadable pre { border-left: 3px solid var(--gm-error); }
.puzzle-error { font-family: var(--gm-sans); font-size: 0.8rem; color: var(--gm-error); margin: 0 0 0.3rem; }
@media print { .puzzle-bar, .puzzle-help { display: none; } }
`);

  // A puzzle being played keeps the keyboard through a re-render.
  Preview.register({
    keep: () => {
      const playing = document.hasFocus() && document.activeElement?.closest?.('.puzzle');
      return playing ? Number(playing.dataset.puzzle) : null;
    },
    restore: (root, playing) => hydrate(root, playing),
    drawn: () => {
      const boards = {};
      for (const host of document.querySelectorAll('.puzzle[data-kind]')) {
        if (!keys.has(host)) continue;
        boards[keys.get(host)] = [...host.children].filter((e) => !e.matches('.puzzle-bar, .puzzle-help')).map((e) => e.outerHTML).join('');
      }
      return { puzzles: { css: styles, boards } };
    },
  });

  window.Puzzles = { register, hydrate, owns, rest, frame };
})();
