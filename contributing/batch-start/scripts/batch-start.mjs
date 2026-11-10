// Before any work on a batch: for each issue, its milestone, any `good first issue`
// label, and open PRs that mention it. Read-only: removing a label is its own step,
// as it's outward. Also what the last retro left waiting on the AI: a card whose last
// `Outcome:` says "waiting on me". Exits 1 if an open PR may already cover an issue,
// one is outside the milestone asked for, or the last retro still has something owed.
// With --day, it also writes each issue's wording into <day>/batch.md, a box per
// issue for the contributor to tick once the wording's right, and waits on every box;
// an issue already there is left as it is, so their asides stay, and one that joins
// later is added.
//   node batch-start.mjs <milestone> 221,237,240 --day <YYYY-MM-DD> [--retro <retro.md>]
import fs from 'node:fs';
import path from 'node:path';
import { config, reviewers } from '../../lib/config.mjs';
import { asSection, standing } from '../../lib/issues.mjs';
import { lastRetro, owed } from '../../lib/retros.mjs';

// batch.md's sections: each issue's number, and whether its wording's box is ticked.
function wordings(text) {
  return new Map([...text.matchAll(/^## \[([ xX])\] gh-(\d+)\b/gm)].map((m) => [m[2], m[1] !== ' ']));
}

const c = config();
const MEETINGS = c.meetings;
const args = process.argv.slice(2);
const r = args.indexOf('--retro');
const retro = r < 0 ? lastRetro(MEETINGS) : args.splice(r, 2)[1];
const d = args.indexOf('--day');
const day = d < 0 ? null : args.splice(d, 2)[1];
const [milestone, nums = ''] = args;
if (!milestone || !nums) {
  console.error('usage: batch-start.mjs <milestone> 221,237,240 --day <YYYY-MM-DD> [--retro <retro.md>]');
  process.exit(2);
}
let stop = 0;
const batch = day && path.join(MEETINGS, day, 'batch.md');
let text = batch && fs.existsSync(batch) ? fs.readFileSync(batch, 'utf8') : batch && `---
title: Batch ${day}
${reviewers(c)}
---

The issues in [the review](review.md) of date:${day}[], as worded before the work starts.
Read each, and change its wording on GitHub, or in an aside here, for me to carry there, before ticking its box.
Work starts once every box is ticked.

- [ ] Send to ${c.ai}
`;
const added = [];
for (const n of nums.split(',').filter(Boolean)) {
  const s = standing(n, milestone);
  if (batch && !wordings(text).has(String(n)) && !s.closed) {
    text = `${text.trimEnd()}\n\n## [ ] gh-${n} ${s.title}\n\ngh:${c.repo}#${n}[gh-${n}]\n\n${asSection(s.body) || '(No body.)'}\n`;
    added.push(n);
  }
  const say = [];
  if (s.closed) say.push('closed already');
  if (s.outside) say.push(`in milestone ${s.outside}, not ${milestone}`);
  for (const p of s.prs) say.push(`open PR #${p.number} by ${p.author.login}: ${p.title} (look before starting)`);
  if (s.label) say.push(`labelled good first issue: once no PR covers it, gh issue edit ${n} -R ${c.repo} --remove-label "good first issue"`);
  if (s.closed || s.outside || s.prs.length) stop++;
  console.log(`${say.length ? 'LOOK' : 'ok  '}  gh-${n} ${s.title}${say.map((m) => `\n        ${m}`).join('')}`);
}
if (batch) {
  fs.mkdirSync(path.dirname(batch), { recursive: true });
  fs.writeFileSync(batch, text);
  if (added.length) console.log(`ok    ${path.relative(MEETINGS, batch)}: added ${added.map((n) => `gh-${n}`).join(', ')}`);
  for (const [n, ticked] of wordings(text)) if (!ticked && nums.split(',').includes(n)) {
    console.log(`WORD  gh-${n}: its wording isn't ticked in ${path.relative(MEETINGS, batch)}`);
    stop++;
  }
} else {
  console.log('LOOK  no --day, so no batch.md: the wording isn\'t checked');
  stop++;
}
const left = retro ? owed(fs.readFileSync(retro, 'utf8')) : [];
for (const o of left) console.log(`OWED  ${path.relative(MEETINGS, retro)}: ${o.card.slice(0, 90)}\n        Outcome: ${o.outcome}`);
if (left.length) {
  stop += left.length;
  console.log('        Do it before the batch, or file it as an issue, then add a later Outcome: to that card saying which.');
} else if (retro) console.log(`ok    nothing waiting on me in ${path.relative(MEETINGS, retro)}`);
console.log(stop ? `${stop} to look at before starting` : 'ready to start');
process.exit(stop ? 1 : 0);
