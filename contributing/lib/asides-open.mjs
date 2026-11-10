// What's waiting for the AI in a review folder: each `~#` aside with no `~c`
// reply under it, and each retro card, answer or vote not the AI's with no
// `A (<ai>):` after it in its block. Shared by send-watch.mjs and review-close.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { config, literal } from './config.mjs';

// Where a line is, as `<path from root>:<line>`, with / between folders on every system.
const where = (root, f, i) => `${path.relative(root, f).split(path.sep).join('/')}:${i + 1}`;

export function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

export function open(root, dir = root, { ai } = config()) {
  const found = [];
  const mine = new RegExp(`\\(${literal(ai)}\\)`);
  const answer = new RegExp(`^A \\(${literal(ai)}\\):`);
  for (const f of files(dir)) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    // What's in a fence is a sample, as in a card that sketches a syntax, not a thing to answer.
    let fence = false;
    const fenced = lines.map((l) => {
      if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return true; }
      return fence;
    });
    // A try file may show an aside as a sample, so only an aside signed by the contributor alone is theirs.
    // `~# [x]` closes its thread, as gh-199 will: it, and their asides before it under the
    // same line, wait on no one. A plain `~#` after it starts a new one.
    const closes = (s) => /^\s*~#\s+\[[xX]\]/.test(s);
    lines.forEach((l, i) => {
      if (fenced[i] || !/^\s*~#(\s|$)/.test(l) || closes(l)) return;
      let answered = false;
      // to the end of its paragraph: an aside can go onto a line of its own (a code sample)
      // Its answer comes straight after it, among the asides under the same line. Past
      // the next line of text, a ~c is about that, and answers something else.
      for (let j = i + 1; j < lines.length && lines[j].trim(); j++) {
        if (/^\s*~c\b/.test(lines[j]) || closes(lines[j])) answered = true;
        else if (!/^\s*~/.test(lines[j]) && !/^\s*(`|\s)/.test(lines[j])) break;
      }
      if (!answered) found.push({ key: `${f}\u0000${l.trim()}`, at: where(root, f, i), text: l.trim() });
    });
    // A card only means something to answer in a retro; a try file may just show one.
    if (path.basename(f) === 'retro.md') lines.forEach((l, i) => {
      if (fenced[i] || !/^(Good|Bad|Try|Q|A|\+1)\b[^:]*:?/.test(l) || mine.test(l)) return;
      if (!/^(Good|Bad|Try|Q|A)( \[[ x]\])?( \([^)]*\))?:|^\+1/.test(l)) return;
      let answered = false;
      for (let j = i + 1; j < lines.length && lines[j].trim(); j++) {
        if (answer.test(lines[j])) answered = true;
      }
      // A closed Good or Bad is finished with, whatever is under it.
      let top = i;
      while (top > 0 && lines[top - 1].trim()) top--;
      if (/^(Good|Bad) \[x\]/.test(lines[top])) answered = true;
      if (!answered) found.push({ key: `${f}\u0000${l.trim()}`, at: where(root, f, i), text: l.trim() });
    });
  }
  return found;
}

// What's waiting on the reviewer in a day folder's review.md files (the index and each
// gh-N/review.md; older days' review/gh-N.md too): each box not
// fully ticked, a staged one (`- [x][ ][ ]`) included, but not the Send box; each
// criterion, `1) [ ]`, not ticked; each `Try:` card not yet tried; and each set of
// choices with none picked.
export function boxes(root, dir = root, { ai } = config()) {
  const found = [];
  const send = new RegExp(`Send to ${literal(ai)}\\b`);
  for (const f of files(dir).filter((p) => path.basename(p) === 'review.md' || path.basename(path.dirname(p)) === 'review')) {
    let fence = false;
    // A run of `- ( )` choices, asides allowed between them, is one question; it waits
    // until one is picked. So does a field of choices, `@ Label: ( ) a ( ) b`.
    let group = null;
    const endGroup = () => {
      if (group && !group.picked) found.push({ at: group.at, text: group.text });
      group = null;
    };
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      if (/^\s*(```|~~~)/.test(l)) { endGroup(); fence = !fence; }
      if (!fence && /^\s*[-*+] \([ xX]\)/.test(l)) {
        if (!group) group = { at: where(root, f, i), text: l.trim(), picked: false };
        if (/^\s*[-*+] \([xX]\)/.test(l)) group.picked = true;
        return;
      }
      if (!fence && /^\s*~/.test(l) && group) return;
      endGroup();
      if (!fence && /^\s*@ [^:]*:\s*\([ xX]\)/.test(l) && !/\([xX]\)/.test(l)) {
        found.push({ at: where(root, f, i), text: l.trim() });
        return;
      }
      if (!fence && (/^\s*(\d+|[a-z])\) \[ \]/.test(l) || /^Try( \[ \])?( \([^)]*\))?:/.test(l))) {
        found.push({ at: where(root, f, i), text: l.trim() });
        return;
      }
      if (fence || !/^\s*[-*+] (\[[ xX]\])+/.test(l) || !/^\s*[-*+] (\[[xX]\])*\[ \]/.test(l)) return;
      if (send.test(l)) return;
      found.push({ at: where(root, f, i), text: l.trim() });
    });
    endGroup();
  }
  return found;
}

// asides-open.mjs <day folder>: both lists, for handing over a round.
export function main(argv) {
  const dir = path.resolve(argv[0] || '.');
  const say = (title, list) => {
    console.log(`${title}: ${list.length}`);
    for (const a of list) console.log(`  ${a.at}: ${a.text.slice(0, 120)}`);
  };
  say(`Waiting on ${config().ai}`, open(dir));
  say('Waiting on you', boxes(dir));
}
