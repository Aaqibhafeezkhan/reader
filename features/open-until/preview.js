/**
 * A page open until a time (`open-until:`) is judged here by the reader's
 * own clock, which is the one the time is written in: each render, and
 * then once a minute, which keeps the notice saying how far away the time
 * is. When it comes, the page shuts while it's showing (`Preview.closed`),
 * and the notice says it can't be edited any longer, as the server would
 * have drawn it. A page the server drew shut stays shut. Runs in the
 * preview frame, ahead of every other feature's script, so the page is
 * judged before they put back what they kept.
 */
(() => {
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  let timer = 0;

  /** `2026-10-28 04:00` in ms by this clock; a day alone, the start of the next. */
  function closingTime(until) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(until || '');
    if (!m) return NaN;
    const d = new Date(0);
    d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (m[4] == null ? 1 : 0));
    d.setHours(Number(m[4] ?? 0), Number(m[5] ?? 0), 0, 0);
    return d.getTime();
  }

  /** "47 Minutes Away", "Two Days Away": as much as is left, rounded down. */
  function away(left) {
    if (left < MINUTE) return 'Less Than a Minute Away';
    const [n, unit] = left < HOUR ? [left / MINUTE, 'Minute'] : left < DAY ? [left / HOUR, 'Hour'] : [left / DAY, 'Day'];
    const k = Math.floor(n);
    return `${k < WORDS.length ? WORDS[k] : k} ${unit}${k === 1 ? '' : 's'} Away`;
  }

  /** The notice once the time has passed, as the server draws it. */
  function shut(n) {
    if (n.classList.contains('open-until-closed')) return;
    n.classList.add('open-until-closed');
    n.setAttribute('role', 'note');
    n.tabIndex = 0;
    n.setAttribute('aria-label', `No Longer Editable. ${n.dataset.closed}`);
    n.textContent = 'No Longer Editable';
  }

  function judge() {
    clearTimeout(timer);
    const notices = [...document.querySelectorAll('.open-until[data-until]')];
    if (!notices.length) {
      Preview.closed = false;
      return;
    }
    const left = closingTime(notices[0].dataset.until) - Date.now();
    const closed = notices.some((n) => n.classList.contains('open-until-closed')) || !(left > 0);
    if (closed) {
      notices.forEach(shut);
      Preview.closed = true;
      return;
    }
    Preview.closed = false;
    for (const n of notices) {
      const said = n.querySelector('.open-until-away');
      if (said) said.textContent = `, ${away(left)}`;
    }
    // Again just as the next minute of what's left has run out, the last
    // of them at the time itself.
    timer = setTimeout(judge, (left % MINUTE || MINUTE) + 1);
  }

  Preview.register({ restore: judge });
})();
