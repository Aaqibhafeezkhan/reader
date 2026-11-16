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
 * In the staff's lower right, as code's Copy is, Play plays it on a piano,
 * abcjs's, the note being played marked on the staff as it goes, and turns
 * to Pause; pressed again, it pauses there, and Play carries on. Once it's
 * begun, Back to the start goes there beside it: playing, it plays on from
 * the start; paused, it waits there. At its end, it's as it was before it
 * was played. It plays on a slide and in Work too. The piano's notes come from reader's server
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

  // The tune playing or paused, if one is: its text, what plays and marks
  // it, whether it's paused, and whether it's been sent back to its start.
  let playing = null;

  // The app's icons are another origin's, so they're drawn here, as code's Copy is.
  const svg = (paths) => `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">${paths}</svg>`;
  const PLAY = svg('<path d="M5 3.2v9.6l7.6-4.8z"/>');
  const PAUSE = svg('<path d="M4.3 3.3h2.6v9.4H4.3zM9.1 3.3h2.6v9.4H9.1z"/>');
  const START = svg('<path d="M3.6 3.3h1.8v9.4H3.6zM12.6 3.3v9.4L6 8z"/>');

  const nameOf = (host) => host.dataset.name ?? 'the tune';
  const mineIs = (host) => playing && playing.source === text(host);

  /** Each tune's buttons as things stand: Play or Pause, and Back to the start once it's begun. */
  function show() {
    for (const host of hosts()) {
      const play = host.querySelector('.music-play');
      const start = host.querySelector('.music-start');
      if (!play) continue;
      const on = mineIs(host) && !playing.paused;
      const word = on ? 'Pause' : 'Play';
      play.innerHTML = on ? PAUSE : PLAY;
      play.setAttribute('aria-label', `${word} ${nameOf(host)}`);
      play.title = word;
      start.hidden = !mineIs(host);
    }
  }

  const unmark = () => {
    for (const n of document.querySelectorAll('.music-now')) n.classList.remove('music-now');
  };

  /** Stops what's playing, or paused, and puts it back as it was before it was played. */
  function stop() {
    if (!playing) return;
    const { synth, timer } = playing;
    playing = null;
    try { timer?.stop(); } catch { /* already stopped */ }
    try { synth?.stop(); } catch { /* already stopped */ }
    unmark();
    show();
  }

  const say = (host, words) => {
    const said = host.querySelector('.music-said');
    if (said) said.textContent = words;
  };

  /** Plays the tune `host` draws, `tune` as abcjs read it, from its start, marking each note as it sounds. */
  async function play(host, tune) {
    stop();
    const source = text(host);
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context || !ABCJS.synth.supportsAudio()) return say(host, 'This browser can\'t play it.');
    // Made in the press itself, which is what lets it sound.
    const audioContext = new Context();
    const synth = new ABCJS.synth.CreateSynth();
    const mine = { source, synth, timer: null, paused: false, atStart: false };
    playing = mine;
    show();
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
        unmark();
        if (!ev) {
          if (playing === mine) stop();
          return undefined;
        }
        for (const group of ev.elements ?? []) for (const n of group) n.classList.add('music-now');
        return undefined;
      },
    });
    mine.timer = timer;
    if (mine.paused) {
      mine.atStart = true;
      return undefined;
    }
    synth.start();
    timer.start();
    return undefined;
  }

  /** Play, or Pause, or carry on from where it was paused. */
  function toggle(host, tune) {
    if (!mineIs(host)) return play(host, tune);
    const mine = playing;
    if (!mine.timer) {
      // Still getting its notes: paused, it waits there once it has them.
      mine.paused = !mine.paused;
    } else if (mine.paused) {
      mine.paused = false;
      mine.synth.resume();
      mine.timer.start(mine.atStart ? 0 : undefined);
      mine.atStart = false;
    } else {
      mine.paused = true;
      mine.synth.pause();
      mine.timer.pause();
    }
    show();
    return undefined;
  }

  /** Back to the start: playing, it plays on from there; paused, it waits there. */
  function restart(host) {
    if (!mineIs(host) || !playing.timer) return;
    const { synth, timer, paused } = playing;
    synth.stop();
    timer.stop();
    unmark();
    if (paused) {
      playing.atStart = true;
      return;
    }
    synth.start();
    timer.start(0);
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
    const said = document.createElement('span');
    said.className = 'music-said';
    said.setAttribute('role', 'status');
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'music-start';
    start.innerHTML = START;
    start.setAttribute('aria-label', `Back to the start of ${nameOf(host)}`);
    start.title = 'Back to the start';
    start.addEventListener('click', () => restart(host));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'music-play';
    button.addEventListener('click', () => toggle(host, tune));
    bar.append(said, start, button);
    staff.after(bar);
    show();
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
