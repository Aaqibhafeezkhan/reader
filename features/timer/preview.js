/**
 * A timer (`timer:[2m]`) counts down once Start is pressed, by a click or
 * by Enter or Space; Pause holds it and Resume goes on, and Reset sets it
 * back. At zero it stops, says "Time's up" on the page and once to a
 * screen reader, and sounds three short tones (static/tone.js). Its time
 * isn't read out as it goes.
 *
 * Running one changes nothing in the file, so it runs wherever the page is
 * shown, a slide and a record among them, and holds across renders, known
 * again by its key (index.js). Leaving the page or the slide it's on
 * doesn't stop it: it runs on, sounds at zero, and is where it's got to on
 * coming back. Runs in the preview frame.
 */
(() => {
  // Each timer that's been started, by its key: `ends` while it runs,
  // `left` (ms) while it's paused, `up` once it's run out.
  const timers = new Map();
  let ticking = 0;

  // A timer run out, for a screen reader, said outside <body>, which a
  // render replaces; there before it has anything to say, to be heard.
  const said = document.createElement('div');
  said.className = 'timer-said';
  said.setAttribute('aria-live', 'polite');
  const say = (text) => {
    // The same again is still heard.
    said.textContent = said.textContent === text ? `${text}\u00a0` : text;
  };

  const two = (n) => String(n).padStart(2, '0');
  const clock = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
  };
  const left = (t) => (t.up ? 0 : t.ends != null ? Math.max(0, t.ends - Date.now()) : t.left);

  /** One timer on the page as its state stands. */
  function draw(el) {
    const t = timers.get(el.dataset.key);
    const seconds = Number(el.dataset.seconds);
    const state = !t ? 'idle' : t.up ? 'done' : t.ends != null ? 'running' : 'paused';
    el.querySelector('.timer-time').textContent = clock(t ? Math.ceil(left(t) / 1000) : seconds);
    el.querySelector('.timer-go').textContent = { idle: 'Start', running: 'Pause', paused: 'Resume', done: 'Start' }[state];
    el.querySelector('.timer-reset').hidden = state === 'idle';
    for (const s of ['running', 'paused', 'done']) el.classList.toggle(`timer-${s}`, state === s);
    let up = el.querySelector('.timer-up');
    if (state === 'done' && !up) {
      up = document.createElement('span');
      up.className = 'timer-up';
      up.textContent = 'Time\u2019s up';
      el.querySelector('.timer-time').after(up);
    } else if (state !== 'done') up?.remove();
  }

  const drawAll = (root = document) => {
    for (const el of root.querySelectorAll('.timer[data-key]')) draw(el);
  };

  // The clock on the page moves while one runs; when it runs out is kept
  // by a timeout of its own, which the browser holds to more closely in a
  // tab out of sight.
  function tick() {
    const running = [...timers.values()].some((t) => t.ends != null);
    if (running && !ticking) ticking = setInterval(() => drawAll(), 250);
    if (!running && ticking) {
      clearInterval(ticking);
      ticking = 0;
    }
    drawAll();
  }

  function run(key, name, ms) {
    const t = { ends: Date.now() + ms, name };
    t.timeout = setTimeout(() => runOut(key, t), ms);
    timers.set(key, t);
  }

  function runOut(key, t) {
    if (timers.get(key) !== t) return;
    timers.set(key, { up: true, name: t.name });
    tick();
    say(`${t.name}: time\u2019s up`);
    for (const ms of [0, 450, 900]) setTimeout(() => Tone.play(880, { seconds: 0.4 }), ms);
  }

  function stop(key) {
    clearTimeout(timers.get(key)?.timeout);
    timers.delete(key);
  }

  document.addEventListener('click', (e) => {
    const button = e.target.closest?.('.timer[data-key] button');
    if (!button) return;
    const el = button.closest('.timer');
    const { key } = el.dataset;
    const t = timers.get(key);
    if (button.classList.contains('timer-reset')) {
      stop(key);
      tick();
      // The button pressed is gone now, there being nothing to set back.
      el.querySelector('.timer-go').focus();
      return;
    }
    if (!said.isConnected) document.documentElement.append(said);
    // Sound can only start on a click or a key, so it's woken now, for zero.
    Tone.wake();
    if (t && t.ends != null) {
      clearTimeout(t.timeout);
      timers.set(key, { left: Math.max(0, t.ends - Date.now()), name: t.name });
    } else {
      const ms = t && !t.up ? t.left : Number(el.dataset.seconds) * 1000;
      stop(key);
      run(key, el.getAttribute('aria-label'), ms);
    }
    tick();
  });

  Preview.register({ restore: (root) => drawAll(root) });
})();
