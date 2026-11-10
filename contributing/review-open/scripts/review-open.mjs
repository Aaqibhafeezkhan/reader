// Lays out a day's review folder: review.md as the index, a folder gh-N/ for
// each item to look at, holding its review.md, try files and shots/, and
// retro.md with the last retro's untried Tries carried in. Fills in what a script can know; the rest is <fill>.
// Refuses to overwrite anything.
//   node review-open.mjs <YYYY-MM-DD> --branch review/YYYY.MM.DD --tag 0.0.4 --look 221,237 --done 240,116 [--root <meetings dir>]
import fs from 'node:fs';
import path from 'node:path';
import { config, reviewers, tilde } from '../../lib/config.mjs';
import { link, standing, title } from '../../lib/issues.mjs';
import { carried, lastRetro as lastRetroOf } from '../../lib/retros.mjs';

const c = config();
const REVIEWERS = reviewers(c);
const args = process.argv.slice(2);
const date = args[0];
const opt = (name, or = '') => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? or : args[i + 1];
};
const list = (name) => opt(name).split(',').filter(Boolean);
const root = path.resolve(opt('root', c.meetings));
const branch = opt('branch', `review/${(date ?? '').replaceAll('-', '.')}`);
const worktree = tilde(path.join(c.main, '.claude', 'worktrees', branch.replace('/', '-')));
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  console.error('usage: review-open.mjs <YYYY-MM-DD> --branch <b> --tag <t> --look 1,2 --done 3,4 [--root <dir>]');
  process.exit(2);
}

const looks = list('look').map((n) => ({ n, title: title(n) }));
const dones = list('done').map((n) => ({ n, title: title(n) }));
const day = path.join(root, date);

// A net for what got past batch-start: an item still offered to contributors.
for (const { n } of [...looks, ...dones]) {
  if (standing(n).label) console.warn(`warning: gh-${n} is still labelled good first issue; check for an open PR, then remove it`);
}

function write(rel, text) {
  const abs = path.join(day, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, { flag: 'wx' });
  console.log(`wrote ${abs}`);
}

const index = `---
title: Review ${date}
${REVIEWERS}
tags: ${opt('tag')}
multibox:
  stages: heard, agreed, done
---

<fill: one line on what this batch is.>
Branch \`${branch}\` (worktree \`.claude/worktrees/${branch.replace('/', '-')}\`): <fill: counts of issues, commits, tests, lint, what's pushed>.

- [ ] Send to ${c.ai}

Each item below has a file and a box of its own: tick its **Send to ${c.ai}** when you've written in it, and I'll answer only that file while you carry on with the next.
This box is for anything in this page, or for everything at once.

To try it, run the branch's reader. It restarts itself when reader's code changes, and opens no new tab; I'll say when to reload the page.

\`\`\`sh
node --watch ${worktree}/bin/reader.js ${tilde(day)} --port 8734 --no-browser
\`\`\`

## Please look
progress:[]

<fill: the order to look at them in, and why, as the items are in that order.>

${looks.map(({ n, title: t }) => `### gh-${n} ${t}

- [ ][ ][ ] [Its file](gh-${n}/review.md), ${link(n)}: <fill: one line of where it stands>.
`).join('\n')}
## Done, nothing to look at
progress:[]

${dones.map(({ n, title: t }) => `- [ ] ${link(n)} ${t}. <fill: one line, how it was checked, and that the issue still describes what shipped.>`).join('\n')}

## Found along the way

<fill: bugs found that aren't from this batch, each a \`- [ ]\` with its proposals: fix now or file. Remove this section if there are none.>

## [ ] Before merging
progress:[]

The merge waits on everything above.

<fill: \`- [ ]\` for each thing only you can do about the whole batch, not one item.>

Waiting on me: <fill>.
Waiting on a contributor: <fill>.
Left in ${opt('tag', 'this milestone')} after this: <fill>.

- [ ] Then: fast-forward \`main\`, push.
`;

const item = ({ n, title: t }) => `---
title: gh-${n} ${t}
${REVIEWERS}
---

← [review](../review.md)

- [ ] Send to ${c.ai}

# [ ] Review
progress:[]

## Changes

${link(n)} <fill: what someone sees now, what you decided, and anything beyond the issue; what any supporting piece is for, and what it costs; and any \`Contortion:\`.>

## Tries

Try: <fill: [what it shows](try-<what>.md), a try file or a \`try-<what>/\` folder beside this file, or a [shot](shots/<what>.png) from \`npm run shots\`; one \`Try:\` card for each, with a line under it on what to look for.>

## [ ] Acceptance Criteria
progress:[]

All the following criteria must be accepted for this review to be complete.

1) [ ] Chrome: <fill: how it was checked, or remove>
2) [ ] Safari: <fill>
3) [ ] Firefox: <fill>
4) [ ] :iphone: phone: <fill>
5) [ ] **<fill: an open point, in words>**

   <fill: what it's about. A thing only to make you aware has no question; a settled decision is ticked, with why and what was turned down.>

   Q (${c.ai}): <fill>?
   - ( ) Yes
   - ( ) [@ Something else]

## Closing

<fill: compare gh-${n} with what shipped, and give your reasoning.>

Q (${c.ai}): Does ${link(n)} still describe what shipped?
- ( ) The issue stands
- ( ) The issue stands, with a closing comment on what went beyond it
- ( ) A PR replaces it
- ( ) [@ Something else]
`;

const lastRetro = lastRetroOf(root, date);
const tries = lastRetro ? carried(fs.readFileSync(lastRetro, 'utf8')) : [];
const retro = `---
title: Retro ${date}
${REVIEWERS}
---

How [the review](review.md) of date:${date}[] went.
Add your own cards anywhere, \`+1\` the ones you agree with, and answer a card with \`A (${c.contributor}):\` under it.
I'll answer under yours with \`A (${c.ai}):\`, one discussion at a time.

## Good

## Bad

## Try

${tries.join('\n\n')}
`;

write('review.md', index);
for (const l of looks) {
  write(`gh-${l.n}/review.md`, item(l));
  fs.mkdirSync(path.join(day, `gh-${l.n}`, 'shots'), { recursive: true });
}
write('retro.md', retro);
if (lastRetro) console.log(`carried ${tries.length} untried Tries from ${path.relative(root, lastRetro)}`);
