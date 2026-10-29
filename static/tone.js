/**
 * A tone, made in the browser: a sine wave that fades away, with no sound
 * file to fetch. For whatever in the preview frame makes a sound, a note
 * played (features/pitch) or a timer run out.
 *
 *   Tone.play(hz, { seconds })   a promise, settled when the tone has faded
 *   Tone.wake()                  sound readied, from a click or a key, for later
 *
 * The browser starts sound only on a click or a key, so a tone is played
 * from one, or sound is woken by one for a tone played later (a timer's
 * start, for its zero); the frame's sandbox and its Content-Security-Policy
 * let Web Audio be, as it fetches nothing. Where there's no Web Audio, or the
 * browser won't start it, nothing sounds and the promise still settles.
 * Tones played over each other are each quiet enough not to clip.
 */

window.Tone = (() => {
  const LOUD = 0.25;     // a tone's gain at its start, out of 1
  const ATTACK = 0.015;  // seconds to come up to it, so it starts without a click
  const QUIET = 0.0001;  // a ramp's ends, as the exponential ramp can't reach 0

  let context = null;
  const audio = () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!context && Context) context = new Context();
    return context;
  };

  function wake() {
    let ctx;
    try {
      ctx = audio();
    } catch {
      return null;
    }
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function play(hz, { seconds = 1.8 } = {}) {
    const ctx = wake();
    if (!ctx || !(hz > 0)) return Promise.resolve();
    const at = ctx.currentTime;
    const wave = ctx.createOscillator();
    const fade = ctx.createGain();
    wave.type = 'sine';
    wave.frequency.setValueAtTime(hz, at);
    fade.gain.setValueAtTime(QUIET, at);
    fade.gain.exponentialRampToValueAtTime(LOUD, at + ATTACK);
    fade.gain.exponentialRampToValueAtTime(QUIET, at + seconds);
    wave.connect(fade);
    fade.connect(ctx.destination);
    wave.start(at);
    wave.stop(at + seconds);
    return new Promise((resolve) => {
      wave.onended = () => {
        wave.disconnect();
        fade.disconnect();
        resolve();
      };
    });
  }

  return { play, wake };
})();
