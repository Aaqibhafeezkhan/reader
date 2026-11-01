/**
 * A video's card (video.js) plays once its thumbnail is pressed, by a click
 * or by Enter or Space: YouTube's player, from youtube-nocookie.com, takes
 * the thumbnail's place, the same size, and starts. Nothing is asked of
 * YouTube's player before that.
 *
 * Playing changes nothing in the file, so it plays wherever the page is
 * shown, a slide and a record among them; a box beside the card is the
 * box's own business. The player carries over a render, known again by its
 * key, which video it is and which card of that video, and is moved into
 * the page drawn anew, still playing, where the browser can move a frame
 * without loading it again (`moveBefore`); elsewhere it's loaded again,
 * stopped. A card that's no longer on the page (a line taken out, another
 * slide) takes its player with it. Runs in the preview frame.
 *
 * Safari starts a video with sound only on a press in the video's own frame,
 * and the card's is in this one, so there the player was black until pressed
 * again: it starts muted instead, playing at once, to be unmuted in the
 * player.
 *
 * In Work and on a slide, where a page is run and not drawn again at each
 * keystroke, the player is there from the start, stopped, and a press on
 * its own play button plays it, with sound, in any browser. Only in a frame
 * with an origin of its own, where it can play: the overview's, the speaker
 * view's and the measuring frame's keep the card, and ask nothing of YouTube.
 * And only where it's at least YouTube's smallest size, 200px wide: below
 * that YouTube draws its compact player, whose middle, play button and all,
 * does nothing when pressed (a card in a grid of three, say). There the card
 * stays until pressed, and its player then starts, as anywhere else.
 */
(() => {
  const ID = /^[\w-]+$/;
  // YouTube's smallest player, in CSS pixels wide.
  const SMALLEST = 200;
  // Too small for a player from the start; 0 is a page not laid out, which can't tell.
  const small = (card) => {
    const width = card.querySelector('.video-play')?.offsetWidth ?? 0;
    return width > 0 && width < SMALLEST;
  };
  // The players, by their card's key.
  const players = new Map();
  const moves = typeof Element.prototype.moveBefore === 'function';
  // Safari, and nothing else that says so: Chrome, Edge and Android's say "Safari" too.
  const safari = () => /Safari\//.test(navigator.userAgent) && !/Chrom(e|ium)|CriOS|FxiOS|EdgiOS|Edg\/|Android/.test(navigator.userAgent);

  const keyOf = (card, root = document) => {
    const same = [...root.querySelectorAll('.video[data-video]')].filter((c) => c.dataset.video === card.dataset.video);
    return `${card.dataset.video}/${same.indexOf(card)}`;
  };

  function player(card, start) {
    const frame = document.createElement('iframe');
    frame.className = 'video-player';
    const asked = start ? `?autoplay=1${safari() ? '&mute=1' : ''}` : '';
    frame.src = `https://www.youtube-nocookie.com/embed/${card.dataset.video}${asked}`;
    frame.title = card.dataset.title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  }

  /** `card`'s thumbnail swapped for `frame`, moved there if it's on the page already. */
  function play(card, frame) {
    const screen = document.createElement('span');
    screen.className = 'video-screen';
    card.querySelector('.video-play').replaceWith(screen);
    if (frame.isConnected && moves) screen.moveBefore(frame, null);
    else screen.append(frame);
  }

  document.addEventListener('click', (e) => {
    const card = e.target.closest?.('.video-play')?.closest('.video[data-video]');
    if (!card || !ID.test(card.dataset.video)) return;
    const frame = player(card, true);
    players.set(keyOf(card), frame);
    play(card, frame);
    frame.focus();
  });

  Preview.register({
    // Out of the page about to be replaced, to be moved into the new one.
    keep: () => {
      if (!moves) return;
      for (const frame of players.values()) {
        if (frame.isConnected) document.documentElement.moveBefore(frame, null);
      }
    },
    restore: (root) => {
      const still = new Set();
      for (const card of root.querySelectorAll('.video[data-video]')) {
        const key = keyOf(card, root);
        const frame = players.get(key);
        if (!frame || !card.querySelector('.video-play')) continue;
        still.add(key);
        if (frame.isConnected && moves) play(card, frame);
        else {
          const again = player(card, false);
          players.set(key, again);
          play(card, again);
        }
      }
      // Run, every card is its player.
      // window.origin, not location's, which a sandboxed frame keeps from its address.
      if (Preview.running && (window.origin ?? location.origin) !== 'null') {
        for (const card of root.querySelectorAll('.video[data-video]')) {
          if (!card.querySelector('.video-play') || !ID.test(card.dataset.video) || small(card)) continue;
          const key = keyOf(card, root);
          const frame = player(card, false);
          players.set(key, frame);
          still.add(key);
          play(card, frame);
        }
      }
      for (const [key, frame] of players) {
        if (still.has(key)) continue;
        frame.remove();
        players.delete(key);
      }
    },
  });
})();
