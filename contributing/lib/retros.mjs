// Reading retros: the Try cards to carry into the next, the cards still owed,
// and which day's retro is the last.
import fs from 'node:fs';
import path from 'node:path';

// A card is its first line and the lines straight under it: its answers, votes and
// outcomes carry on with no blank line, so the first blank line ends it.

// The Try cards not yet tried in a retro, each with what's under it, to carry
// into the next. A Try's [x] means tried, so an agreed but untried one stays open.
export function carried(text) {
  const out = [];
  let block = null;
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      if (block) out.push(block.join('\n').trimEnd());
      block = null;
    } else if (/^(#{1,6} |Try\b|Good\b|Bad\b)/.test(line)) {
      if (block) out.push(block.join('\n').trimEnd());
      block = /^Try( \[ \])?( \([^)]*\))?:/.test(line) ? [line] : null;
    } else if (block) block.push(line);
  }
  if (block) out.push(block.join('\n').trimEnd());
  return out;
}

// Each card whose last `Outcome:` still says it's waiting on me: agreed, but put off.
export function owed(text) {
  const out = [];
  let card = null;
  const end = () => {
    const last = card?.outcomes.at(-1);
    if (last && /waiting on me/i.test(last)) out.push({ card: card.head, outcome: last });
  };
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      end();
      card = null;
    } else if (/^(#{1,6} |Good\b|Bad\b|Try\b)/.test(line)) {
      end();
      card = /^(Good|Bad|Try)\b/.test(line) ? { head: line, outcomes: [] } : null;
    } else if (card) {
      const m = /Outcome:\s*(.*)$/.exec(line);
      if (m) card.outcomes.push(m[1].trim());
    }
  }
  end();
  return out;
}

// The newest day folder with a retro.md, before `before` (a YYYY-MM-DD) if given.
export function lastRetro(root, before) {
  if (!fs.existsSync(root)) return null;
  const day = fs.readdirSync(root)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && (!before || d < before) && fs.existsSync(path.join(root, d, 'retro.md')))
    .sort().pop();
  return day ? path.join(root, day, 'retro.md') : null;
}
