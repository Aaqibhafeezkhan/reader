// Before any work on a batch: for each issue, its milestone, any `good first issue`
// label, and open PRs that mention it. Read-only: removing a label is its own step,
// as it's outward. Also what the last retro left waiting on me: a card whose last
// `Outcome:` says "waiting on me". Exits 1 if an open PR may already cover an issue,
// one is outside the milestone asked for, or the last retro still has something owed.
// With --day, it also writes each issue's wording into <day>/batch.md, a box per
// issue for Josh to tick once the wording's right, and waits on every box; an issue
// already there is left as it is, so his asides stay, and one that joins later is added.
//   node batch-start.mjs <milestone> 221,237,240 --day <YYYY-MM-DD> [--retro <retro.md>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MEETINGS = path.join(os.homedir(), 'Documents/self/io/reader/meetings');

// The newest day folder with a retro.md.
export function lastRetro(root = MEETINGS) {
  if (!fs.existsSync(root)) return null;
  const day = fs.readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && fs.existsSync(path.join(root, d, 'retro.md'))).sort().pop();
  return day ? path.join(root, day, 'retro.md') : null;
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
    if (/^(#{1,6} |Good\b|Bad\b|Try\b)/.test(line)) {
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

// An issue's body, as GitHub markdown, kept as it is but for what reader would
// read as its own: headings go down two levels, so the issue's own section holds
// them, and a line that would be an aside, a card, a field, a vote, a block or a
// page break is escaped. Fences are left alone.
export function asSection(body) {
  let fence = null;
  return body.replace(/\r\n/g, '\n').trim().split('\n').map((line) => {
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) { if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; return line; }
    if (f) { fence = f[1]; return line; }
    const h = /^(#{1,6})([ \t].*)$/.exec(line);
    if (h) return `${'#'.repeat(Math.min(6, h[1].length + 2))}${h[2]}`;
    return /^(?:~|!|@[ \t]|:::|\+\+\+|\+1\b|-{3,}\s*$|(?:Q|A|Good|Bad|Try)(?:[ \t]*\([^)]*\))?:)/.test(line) ? `\\${line}` : line;
  }).join('\n');
}

// batch.md's sections: each issue's number, and whether its wording's box is ticked.
export function wordings(text) {
  return new Map([...text.matchAll(/^## \[([ xX])\] gh-(\d+)\b/gm)].map((m) => [m[2], m[1] !== ' ']));
}

const REPO = 'jzheaux/reader';
const gh = (...a) => JSON.parse(execFileSync('gh', [...a, '-R', REPO], { encoding: 'utf8' }));

// What stands in the way of starting issue n, and what to do first.
export function standing(n, milestone) {
  const issue = gh('issue', 'view', String(n), '--json', 'title,body,labels,milestone,state');
  // GitHub's search for the number is loose, so these are PRs to look at, not proof.
  const prs = gh('pr', 'list', '--state', 'open', '--search', `${n} in:title,body`, '--json', 'number,title,author');
  const label = issue.labels.some((l) => l.name === 'good first issue');
  return {
    n,
    title: issue.title,
    body: issue.body ?? '',
    closed: issue.state !== 'OPEN',
    label,
    prs,
    outside: milestone && issue.milestone?.title !== milestone ? issue.milestone?.title ?? 'none' : null,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const r = args.indexOf('--retro');
  const retro = r < 0 ? lastRetro() : args.splice(r, 2)[1];
  const d = args.indexOf('--day');
  const day = d < 0 ? null : args.splice(d, 2)[1];
  const [milestone, nums = ''] = args;
  if (!milestone || !nums) {
    console.error('usage: batch-start.mjs <milestone> 221,237,240');
    process.exit(2);
  }
  let stop = 0;
  const batch = day && path.join(MEETINGS, day, 'batch.md');
  let text = batch && fs.existsSync(batch) ? fs.readFileSync(batch, 'utf8') : batch && `---
title: Batch ${day}
reviewer #: Josh
reviewer c: Claude
---

The issues in [the review](review.md) of date:${day}[], as worded before the work starts.
Read each, and change its wording on GitHub, or in an aside here, for me to carry there, before ticking its box.
Work starts once every box is ticked.

- [ ] Send to Claude
`;
  const added = [];
  for (const n of nums.split(',').filter(Boolean)) {
    const s = standing(n, milestone);
    if (batch && !wordings(text).has(String(n)) && !s.closed) {
      text = `${text.trimEnd()}\n\n## [ ] gh-${n} ${s.title}\n\ngh:${REPO}#${n}[gh-${n}]\n\n${asSection(s.body) || '(No body.)'}\n`;
      added.push(n);
    }
    const say = [];
    if (s.closed) say.push('closed already');
    if (s.outside) say.push(`in milestone ${s.outside}, not ${milestone}`);
    for (const p of s.prs) say.push(`open PR #${p.number} by ${p.author.login}: ${p.title} (look before starting)`);
    if (s.label) say.push(`labelled good first issue: once no PR covers it, gh issue edit ${n} -R ${REPO} --remove-label "good first issue"`);
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
}
