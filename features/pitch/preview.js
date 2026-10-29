/**
 * A note (`pitch:[C4]`) plays when its button is pressed, by a click or by
 * Enter or Space: a tone that fades (static/tone.js). Playing it changes
 * nothing in the file, so it plays wherever the page is shown, a slide and
 * a record among them. While it sounds, its button says so (`pitch-playing`).
 * Runs in the preview frame.
 */
(() => {
  const playing = new Map();   // a button, and how many of its tones are sounding

  document.addEventListener('click', (e) => {
    const button = e.target.closest?.('button.pitch[data-hz]');
    if (!button) return;
    const hz = Number(button.dataset.hz);
    playing.set(button, (playing.get(button) || 0) + 1);
    button.classList.add('pitch-playing');
    Tone.play(hz).then(() => {
      const left = playing.get(button) - 1;
      if (left > 0) return playing.set(button, left);
      playing.delete(button);
      button.classList.remove('pitch-playing');
    });
  });
})();
