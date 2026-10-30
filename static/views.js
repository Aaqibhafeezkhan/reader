/**
 * How the reader has a document set to be seen, for the preview frames,
 * which, sandboxed, have no storage of their own. Two lists are kept, the
 * latest first and the oldest let go:
 *
 *   picks  the versions picked in `tabs` and `compare` blocks (features/tabs)
 *   views  by key, a recipe's multiplier, say (features/count)
 *
 * A frame asks for a list as it loads (`picks`, `views`) and tells of each
 * one set (`pick`; `view`, a null value forgetting it); every frame of the
 * page is then told the list (`picked`, `viewed`), and through storage,
 * every other window of the app's.
 */
(() => {
  const frames = () => [...document.querySelectorAll('iframe')];

  /**
   * One list, kept in storage at `key`: `ask` and `set` are the messages a
   * frame sends, `told` what it's sent back, and `put` the list with what
   * `set` says in it.
   */
  function keep({ key, most, ask, set, told, put }) {
    // Where storage can't be had, as long as the page lasts.
    let kept = [];
    const list = () => {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? kept;
      } catch {
        return kept;
      }
    };
    const tell = (frame) => Frames.post(frame, told(list()));

    window.addEventListener('message', (e) => {
      const from = frames().find((f) => f.contentWindow === e.source);
      if (!from) return;
      if (e.data?.type === ask) tell(from);
      else if (e.data?.type === set && typeof e.data.key === 'string') {
        kept = put(list(), e.data).slice(0, most);
        try {
          localStorage.setItem(key, JSON.stringify(kept));
        } catch {
          // kept, until the page goes
        }
        frames().forEach(tell);
      }
    });
    window.addEventListener('storage', (e) => {
      if (e.key === key) frames().forEach(tell);
    });
    // A frame that asked before this was listening.
    frames().forEach(tell);
  }

  keep({
    key: 'reader:tabs', most: 50, ask: 'picks', set: 'pick',
    told: (keys) => ({ type: 'picked', keys }),
    put: (keys, { key }) => [key, ...keys.filter((k) => k !== key)],
  });
  keep({
    key: 'reader:views', most: 200, ask: 'views', set: 'view',
    told: (views) => ({ type: 'viewed', views: Object.fromEntries(views) }),
    put: (views, { key, value }) => [...(value == null ? [] : [[key, value]]), ...views.filter(([k]) => k !== key)],
  });
})();
