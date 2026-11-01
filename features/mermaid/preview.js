/**
 * Mermaid diagrams in the rendered page.
 *
 * Each ```mermaid fence comes from the server as `<div class="mermaid">`
 * holding its code block, and is drawn here from that text: the diagram
 * goes in beside the code, which is then hidden but for a screen reader,
 * the diagram one image named by its `accTitle:`, which the server has
 * read and left on the wrapper as `data-name`. Text that Mermaid can't
 * read shows the code with what was wrong under it.
 *
 * Drawing takes a moment and a render comes with each keystroke, so what
 * each text drew is kept, and a diagram being changed goes on showing what
 * it last drew until the new one is ready. Its error, while the text is
 * half typed, shows under that, faded.
 *
 * A diagram on a dark page, in the dark theme or on a dark background
 * (static/ink.js), is drawn in Mermaid's dark theme, and one on a light
 * page in its neutral one; what each drew is kept by both, so a page
 * turning dark or light draws each again, once.
 *
 * What the page's diagrams drew is also handed back by their text
 * (`Preview.drawn()`), for an export, which has nothing to draw them; its
 * frame is light, so that's the light drawing, but on a dark background.
 */
(() => {
  let loaded = null;

  /** Mermaid, loaded the first time it's wanted. */
  function load() {
    loaded ??= new Promise((done, failed) => {
      const script = document.createElement('script');
      // The frame's own origin, from its location: a bare path would resolve
      // against the frame's <base>, the app's /content/, where it isn't.
      script.src = new URL('/features/mermaid/vendor/mermaid.min.js', location.href).href;
      script.onload = () => {
        done();
      };
      script.onerror = () => failed(new Error('Mermaid could not be loaded'));
      // Outside <body>, which every render replaces.
      document.head.append(script);
    });
    return loaded;
  }

  const drawn = new Map();  // the look and the text -> { svg } or { error }

  // Light, Mermaid's neutral theme. Dark, its dark one, on the document's
  // dark paper and fence, in its ink (src/columns.css).
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(`--gm-${name}`).trim();
  const looks = {
    light: () => ({ theme: 'neutral', themeVariables: {} }),
    dark: () => ({
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: token('paper'),
        primaryColor: token('well'),
        mainBkg: token('well'),
        primaryTextColor: token('ink'),
        textColor: token('ink'),
        primaryBorderColor: token('ink-soft'),
        lineColor: token('ink-soft'),
        edgeLabelBackground: token('paper'),
      },
    }),
  };
  const last = [];          // the svg each diagram on the page last showed, in order
  let ids = 0;
  let queue = Promise.resolve();

  // Mermaid measures text as it draws, so it draws on the page, out of
  // sight. It finds what it drew under <body>, which every render replaces.
  const stage = document.createElement('div');
  stage.style.cssText = 'position: absolute; top: 0; left: -10000px; visibility: hidden;';

  const hosts = (root = document.body) => [...root.querySelectorAll('.mermaid')];
  const dark = () => document.documentElement.classList.contains('gm-dark');
  // what a text drew, drawn as the page is now, dark or light
  const keyOf = (source) => `${dark() ? 'dark' : 'light'}\n${source}`;
  const showing = (key) => hosts().some((host) => keyOf(text(host)) === key);
  // markdown leaves a code block ending in a newline the fence didn't have
  const text = (host) => (host.querySelector('pre code')?.textContent ?? '').replace(/\n$/, '');

  /** Puts what's known of diagram `k`'s text into its host. */
  function show(host, k) {
    host.querySelector('.mermaid-figure')?.remove();
    host.querySelector('.mermaid-error')?.remove();
    const got = drawn.get(keyOf(text(host)));
    const svg = got?.svg ?? last[k];
    if (got?.svg) last[k] = got.svg;
    host.classList.toggle('drawn', Boolean(svg));
    host.classList.toggle('stale', Boolean(got?.error && svg));
    if (svg) {
      const figure = document.createElement('div');
      figure.className = 'mermaid-figure';
      figure.setAttribute('role', 'img');
      // named as the server named it (index.js), as an export names it too
      figure.setAttribute('aria-label', host.dataset.name ?? 'Diagram');
      figure.innerHTML = svg;
      host.append(figure);
    }
    if (got?.error) {
      const error = document.createElement('pre');
      error.className = 'mermaid-error';
      error.textContent = got.error;
      host.append(error);
    }
  }

  /** Draws what `key` names, again if a render replaced the page meanwhile. */
  async function draw(key) {
    try {
      await load();
    } catch (err) {
      return drawn.set(key, { error: err.message });
    }
    const [look, source] = [key.slice(0, key.indexOf('\n')), key.slice(key.indexOf('\n') + 1)];
    while (showing(key)) {
      document.body.append(stage);
      let got;
      try {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, ...looks[look]() });
        got = { svg: (await mermaid.render(`mermaid-${++ids}`, source, stage)).svg };
      } catch (err) {
        got = { error: String(err?.message ?? err).trim() };
      }
      const whole = stage.isConnected;
      stage.remove();
      stage.replaceChildren();
      if (whole) return drawn.set(key, got);
    }
  }

  function hydrate(root) {
    const all = hosts(root);
    last.length = all.length;
    all.forEach((host, k) => show(host, k));
    const wanted = new Set(all.map((host) => keyOf(text(host))));
    for (const key of wanted) {
      if (drawn.has(key)) continue;
      // One at a time, and only what's still on the page by its turn: a
      // keystroke's text is usually gone by the next.
      queue = queue.then(async () => {
        await draw(key);
        hosts().forEach((host, k) => { if (keyOf(text(host)) === key) show(host, k); });
      });
      Preview.wait(queue);
    }
    // What each text drew is kept, for undoing back to it, until there are
    // a few hundred; then only what's on the page.
    if (drawn.size > 300) for (const key of drawn.keys()) if (!wanted.has(key)) drawn.delete(key);
  }

  Preview.register({
    restore: (root) => hydrate(root),
    drawn: () => ({ mermaid: Object.fromEntries(hosts().map((host) => [text(host), drawn.get(keyOf(text(host)))?.svg]).filter(([, svg]) => svg)) }),
  });
})();
