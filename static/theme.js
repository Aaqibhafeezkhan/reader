/**
 * Light, dark, or the system's (`prefers-color-scheme`), as the reader
 * chooses in the help, kept in the browser; the system's until they do.
 * Loaded in the <head>, before the stylesheet, so the page is drawn in the
 * right one from the first: `<html data-theme>` is the look this page came
 * to, `light` or `dark`, the one set of colours static/palette.css keys on.
 * A page that says `<html data-default="dark">`, the speaker view, for a
 * darkened room, counts the system's as dark: it's dark unless Light is
 * chosen.
 *
 * The document is drawn as the app's look is, on every page, the speaker
 * view's slides too, as the room sees them: `data-paper` says which, and
 * Theme.dark() whether it's dark. The app sends the preview frames that
 * with each render (app/render.js); an export, printed or saved, stays
 * light.
 *
 *   Theme.chosen()        'light', 'dark' or 'system'
 *   Theme.dark()          whether the app's look came to dark, and the
 *                         document's with it
 *   Theme.choose(c)       chooses, keeps it, and applies it
 *   Theme.onChange(fn)    fn(dark, chosen), when either changes: chosen here
 *                         or in another window, or the system's changing
 */
window.Theme = (() => {
  const KEY = 'reader:theme';
  const CHOICES = ['light', 'dark', 'system'];
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  const heard = [];

  const stored = () => {
    try {
      const c = localStorage.getItem(KEY);
      return CHOICES.includes(c) ? c : 'system';
    } catch {
      return 'system';
    }
  };
  // Where storage can't be had, as long as the page lasts.
  let chosen = stored();

  const dark = () => chosen === 'dark' || (chosen === 'system' && Boolean(system?.matches));

  let was = null;
  function apply() {
    const root = document.documentElement;
    const page = dark() || (chosen === 'system' && root.dataset.default === 'dark');
    root.dataset.theme = page ? 'dark' : 'light';
    root.dataset.paper = dark() ? 'dark' : 'light';
    const now = `${dark()} ${chosen}`;
    if (was !== null && was !== now) heard.forEach((fn) => fn(dark(), chosen));
    was = now;
  }

  function choose(c) {
    if (!CHOICES.includes(c)) return;
    chosen = c;
    try {
      localStorage.setItem(KEY, c);
    } catch {
      // kept, until the page goes
    }
    apply();
  }

  system?.addEventListener?.('change', apply);
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    chosen = stored();
    apply();
  });
  apply();

  return { chosen: () => chosen, dark, choose, onChange: (fn) => heard.push(fn) };
})();
