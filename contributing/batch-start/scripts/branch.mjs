// A batch's git steps, so they come out the same each time. Local only: it never pushes.
//   node branch.mjs review <YYYY-MM-DD>
//       review/YYYY.MM.DD from main, in .claude/worktrees/review-YYYY.MM.DD
//   node branch.mjs issue <N> [--date <YYYY-MM-DD>]
//       issue/gh-N from the review branch, in .claude/worktrees/issue-gh-N,
//       with the review worktree's node_modules linked in, or main's
//   node branch.mjs merge <N> [--date <YYYY-MM-DD>] [--trailer "Co-Authored-By: Name <email>"]...
//       issue/gh-N into the review branch, --no-ff, as "Merge issue/gh-N: <title>",
//       "Closes gh-N", any trailers given, and the sign-off; then its worktree goes,
//       the node_modules link first
// Without --date, the review branch is the only review/ branch there is.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { config, tilde } from '../../lib/config.mjs';
import { title } from '../../lib/issues.mjs';
import { DATE, commits, dirt, git, gitOK, issueBranch, reviewBranch, worktreeFor, worktrees } from '../../lib/git.mjs';

const USAGE = 'usage: branch.mjs review <YYYY-MM-DD> | issue <N> [--date <YYYY-MM-DD>] | merge <N> [--date <YYYY-MM-DD>] [--trailer "<Key>: <value>"]...';
const fail = (m, code = 1) => {
  console.error(m);
  process.exit(code);
};

let parsed;
try {
  parsed = parseArgs({ allowPositionals: true, options: { date: { type: 'string' }, trailer: { type: 'string', multiple: true, default: [] } } });
} catch (e) {
  fail(`${e.message}\n${USAGE}`, 2);
}
const { values: opt, positionals: [cmd, arg] } = parsed;
const main = config().main;
const exists = (branch) => gitOK(main, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`);

// The batch's review branch: the --date's, or the only one there is.
function review() {
  if (opt.date) {
    if (!DATE.test(opt.date)) fail(`--date is YYYY-MM-DD, not ${opt.date}`, 2);
    const b = reviewBranch(opt.date);
    if (!exists(b)) fail(`no branch ${b}: start it with branch.mjs review ${opt.date}`);
    return b;
  }
  const all = git(main, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/review/').split('\n').filter(Boolean);
  if (all.length !== 1) fail(all.length ? `more than one review branch (${all.join(', ')}): say which with --date` : 'no review branch: start one with branch.mjs review <YYYY-MM-DD>');
  return all[0];
}

// A branch in its own worktree, from `from` if it's new; or where it already is.
function checkout(branch, from) {
  const at = worktrees(main)[branch];
  if (at) return console.log(`already there: ${branch} in ${tilde(at)}`);
  const wt = worktreeFor(main, branch);
  if (fs.existsSync(wt)) fail(`${tilde(wt)} is there already, with some other branch: move it, or remove it with git worktree remove`);
  if (exists(branch)) git(main, 'worktree', 'add', '-q', wt, branch);
  else git(main, 'worktree', 'add', '-q', '-b', branch, wt, from);
  console.log(`${branch} in ${tilde(wt)}, from ${from}`);
}

// An issue's worktree borrows node_modules, so its tests run without an install.
// .gitignore's node_modules, with no slash, ignores the link; merge takes it away all the same.
const MODULES = 'node_modules';
function lend(to, ...from) {
  const own = path.join(to, MODULES);
  if (fs.existsSync(own)) return;
  const there = from.filter(Boolean).map((d) => path.join(d, MODULES)).find((d) => fs.existsSync(d));
  if (!there) return console.log(`no ${MODULES} to link: npm install there, or in ${tilde(from.find(Boolean))}`);
  fs.symlinkSync(there, own, 'dir');
  console.log(`linked ${tilde(there)} in`);
}
function unlend(wt) {
  const own = path.join(wt, MODULES);
  if (fs.lstatSync(own, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(own);
}

if (cmd === 'review') {
  if (!DATE.test(arg ?? '')) fail(USAGE, 2);
  // Only what's known locally: a fetch is for review-close.
  if (gitOK(main, 'rev-parse', '--verify', '--quiet', 'origin/main') && !gitOK(main, 'merge-base', '--is-ancestor', 'origin/main', 'main')) {
    console.log('note: main is behind origin/main; pull first, so the batch starts from what everyone has');
  }
  checkout(reviewBranch(arg), 'main');
} else if (cmd === 'issue') {
  if (!/^\d+$/.test(arg ?? '')) fail(USAGE, 2);
  const rb = review();
  checkout(issueBranch(arg), rb);
  const at = worktrees(main);
  lend(at[issueBranch(arg)], at[rb], main);
  console.log(`Commits there end "See gh-${arg}", and are signed off: git commit -s.`);
} else if (cmd === 'merge') {
  if (!/^\d+$/.test(arg ?? '')) fail(USAGE, 2);
  const rb = review();
  const ib = issueBranch(arg);
  if (!exists(ib)) fail(`no branch ${ib}`);
  const at = worktrees(main);
  const into = at[rb];
  if (!into) fail(`${rb} isn't checked out anywhere: branch.mjs review gives it its worktree`);
  if (at[ib]) unlend(at[ib]);
  for (const wt of [into, at[ib]].filter(Boolean)) {
    const d = dirt(wt);
    if (d) fail(`${tilde(wt)} has changes not committed:\n${d}`);
  }
  const work = commits(into, rb, ib).filter((c) => !c.merge);
  if (!work.length) fail(`${ib} has nothing that ${rb} hasn't`);
  const see = new RegExp(`^See gh-${arg}$`, 'm');
  const unseen = work.filter((c) => !see.test(c.body));
  if (unseen.length) fail(`each commit on ${ib} ends "See gh-${arg}", and these don't:\n${unseen.map((c) => `  ${c.hash.slice(0, 7)} ${c.subject}`).join('\n')}`);
  for (const t of opt.trailer) if (!/^[\w-]+: \S/.test(t)) fail(`a trailer is "Key: value", not ${t}`, 2);

  const message = [`Merge ${ib}: ${title(arg)}`, `Closes gh-${arg}`, ...(opt.trailer.length ? [opt.trailer.join('\n')] : [])].join('\n\n');
  try {
    git(into, 'merge', '--no-ff', '--signoff', '-m', message, ib);
  } catch (e) {
    fail(`${e.message}\n\nThe merge stopped in ${tilde(into)}. Resolve it there, then git commit -s, which keeps its message, Closes gh-${arg} and all; or git merge --abort.`);
  }
  console.log(`merged ${ib} into ${rb}: ${git(into, 'rev-parse', '--short', 'HEAD')} ${git(into, 'log', '-1', '--format=%s')}`);
  // Its worktree is done with; the branch stays, as the record of the issue's commits.
  if (at[ib]) {
    git(main, 'worktree', 'remove', at[ib]);
    console.log(`removed ${tilde(at[ib])}; ${ib} stays`);
  }
} else {
  fail(USAGE, 2);
}
