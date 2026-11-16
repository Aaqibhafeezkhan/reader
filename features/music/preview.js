/**
 * Tunes in the rendered page, drawn and played with abcjs.
 *
 * Each ```music fence comes from the server as `<div class="music">`
 * holding its code block, and is drawn here from that text: its staff goes
 * in beside the code, which is then hidden but for a screen reader, the
 * staff one image named by its title, key, time and bars, which the server
 * has read and left on the wrapper as `data-name`. ABC that abcjs can't
 * read shows the code with what was wrong under it, and what could be
 * drawn of it, faded.
 *
 * Above the staff, Play plays it on a piano, abcjs's, the note being played
 * marked on the staff as it goes; pressed again, it stops. It plays on a
 * slide and in Work too. The piano's notes come from reader's server
 * (src/soundfont.js), which fetches each the first time it's played: one
 * that can't be had, offline, says the tune needs the network.
 *
 * What the page's tunes drew is handed back by their text
 * (`Preview.drawn()`), for an export, which has nothing to draw or play
 * them, so it shows the staff with no button.
 */
(() => {
  let loaded = null;

  /** abcjs, loaded the first time it's wanted. */
  function load() {
    loaded ??= new Promise((done, failed) => {
      const script = document.createElement('script');
      // The frame's own origin, from its location: a bare path would resolve
      // against the frame's <base>, the app's /content/, where it isn't.
      script.src = new URL('/features/music/vendor/abcjs-basic-min.js', location.href).href;
      script.onload = () => done();
      script.onerror = () => failed(new Error('abcjs could not be loaded'));
      // Outside <body>, which every render replaces.
      document.head.append(script);
    });
    return loaded;
  }

  const SOUNDS = () => new URL('/soundfont/', location.href).href;
  const hosts = (root = document.body) => [...root.querySelectorAll('.music')];
  // markdown leaves a code block ending in a newline the fence didn't have
  const text = (host) => (host.querySelector('pre:not(.music-error) code')?.textContent ?? '').replace(/\n$/, '');
  const words = (html) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent;
  };

  // The tune playing, if one is: its text, and what plays and marks it.
  let playing = null;

  function stop() {
    if (!playing) return;
    const { synth, timer } = playing;
    playing = null;
    try { timer?.stop(); } catch { /* already stopped */ }
    try { synth?.stop(); } catch { /* already stopped */ }
    for (const n of document.querySelectorAll('.music-now')) n.classList.remove('music-now');
    for (const b of document.querySelectorAll('.music-play[aria-pressed="true"]')) press(b, false);
  }

  function press(button, on) {
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? 'Stop' : 'Play';
  }

  const say = (host, words) => {
    const said = host.querySelector('.music-said');
    if (said) said.textContent = words;
  };

  /** Plays the tune `host` draws, `tune` as abcjs read it, marking each note as it sounds. */
  async function play(host, tune, button) {
    stop();
    const source = text(host);
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context || !ABCJS.synth.supportsAudio()) return say(host, 'This browser can\'t play it.');
    // Made in the press itself, which is what lets it sound.
    const audioContext = new Context();
    const synth = new ABCJS.synth.CreateSynth();
    const mine = { source, synth, timer: null };
    playing = mine;
    press(button, true);
    say(host, 'Getting its notes…');
    try {
      await synth.init({ audioContext, visualObj: tune, options: { soundFontUrl: SOUNDS() } });
      await synth.prime();
    } catch {
      if (playing === mine) stop();
      return say(host, 'It needs the network the first time its notes are played.');
    }
    if (playing !== mine) return undefined;
    say(host, '');
    const timer = new ABCJS.TimingCallbacks(tune, {
      eventCallback: (ev) => {
        for (const n of document.querySelectorAll('.music-now')) n.classList.remove('music-now');
        if (!ev) {
          if (playing === mine) stop();
          return undefined;
        }
        for (const group of ev.elements ?? []) for (const n of group) n.classList.add('music-now');
        return undefined;
      },
    });
    mine.timer = timer;
    synth.start();
    timer.start();
    return undefined;
  }

  /** Draws `host` from its text, with Play above the staff, or its text and what's wrong. */
  function draw(host) {
    host.querySelector('.music-bar')?.remove();
    host.querySelector('.music-staff')?.remove();
    host.querySelector('.music-error')?.remove();
    const staff = document.createElement('div');
    staff.className = 'music-staff';
    staff.setAttribute('role', 'img');
    // named as the server named it (index.js), as an export names it too
    staff.setAttribute('aria-label', host.dataset.name ?? 'Tune');
    host.append(staff);
    let tune;
    try {
      [tune] = ABCJS.renderAbc(staff, text(host), { add_classes: true, responsive: 'resize', foregroundColor: 'currentColor' });
    } catch (err) {
      tune = { warnings: [String(err?.message ?? err)] };
    }
    const drawn = Boolean(staff.querySelector('svg')) && Boolean(tune?.lines?.length);
    const warned = Boolean(tune?.warnings?.length);
    if (!drawn) staff.remove();
    // A tune with something wrong in it shows its text too, what's wrong under
    // it, and what could be drawn of it, faded.
    host.classList.toggle('drawn', drawn && !warned);
    host.classList.toggle('warned', drawn && warned);
    if (warned || !drawn) {
      const error = document.createElement('pre');
      error.className = 'music-error';
      // The first few, as one mistake is often said again for each character after it.
      const said = [...new Set((tune?.warnings?.length ? tune.warnings : ['No tune to draw: a tune needs its notes after a K: line.']).map(words))];
      error.textContent = [...said.slice(0, 5), ...(said.length > 5 ? [`and ${said.length - 5} more`] : [])].join('\n');
      host.append(error);
    }
    if (!drawn) return;
    const bar = document.createElement('div');
    bar.className = 'music-bar';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'music-play';
    button.setAttribute('aria-label', `Play ${host.dataset.name ?? 'the tune'}`);
    press(button, playing?.source === text(host));
    button.addEventListener('click', () => (button.getAttribute('aria-pressed') === 'true' ? stop() : play(host, tune, button)));
    const said = document.createElement('span');
    said.className = 'music-said';
    said.setAttribute('role', 'status');
    bar.append(button, said);
    host.insertBefore(bar, staff);
  }

  function hydrate(root) {
    const all = hosts(root);
    // A tune no longer on the page stops.
    if (playing && !all.some((host) => text(host) === playing.source)) stop();
    if (!all.length) return;
    Preview.wait(load().then(() => all.forEach(draw), (err) => {
      for (const host of all) {
        const error = document.createElement('pre');
        error.className = 'music-error';
        error.textContent = err.message;
        host.append(error);
      }
    }));
  }

  Preview.register({
    restore: (root) => hydrate(root),
    drawn: () => ({
      music: Object.fromEntries(hosts().map((host) => [text(host), host.querySelector('.music-staff svg')?.outerHTML]).filter(([, svg]) => svg)),
    }),
  });
})();
