// What the scripts ask git, and the names of a batch's branches and worktrees:
// review/YYYY.MM.DD, named for the review's date, in .claude/worktrees/review-YYYY.MM.DD,
// and each issue on issue/gh-N, in .claude/worktrees/issue-gh-N.
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

// git in a folder: its output, trimmed, or an Error with git's own words.
export function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim() || `git ${args.join(' ')} failed`);
  return r.stdout.trim();
}

// Whether git says yes, as merge-base --is-ancestor and rev-parse --verify do.
export const gitOK = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { stdio: 'ignore' }).status === 0;

export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const reviewBranch = (date) => `review/${date.replaceAll('-', '.')}`;
export const issueBranch = (n) => `issue/gh-${n}`;
// A branch's worktree: its name with the / as a -.
export const worktreeFor = (main, branch) => path.join(main, '.claude', 'worktrees', branch.replace('/', '-'));

// Where each branch is checked out: { 'review/2026.11.22': '/…/review-2026.11.22' }.
export function worktrees(cwd) {
  const out = {};
  let at = null;
  for (const line of git(cwd, 'worktree', 'list', '--porcelain').split('\n')) {
    if (line.startsWith('worktree ')) at = line.slice(9);
    else if (line.startsWith('branch refs/heads/')) out[line.slice(18)] = at;
  }
  return out;
}

// What's changed in a worktree and not committed, as `git status --short` says it.
export const dirt = (cwd) => git(cwd, 'status', '--short');

// The commits on head and not on base, oldest first: { hash, subject, body, merge }.
export function commits(cwd, base, head = 'HEAD') {
  const text = execFileSync('git', ['-C', cwd, 'log', '--reverse', '--format=%H%x00%P%x00%s%x00%B%x01', `${base}..${head}`], { encoding: 'utf8' });
  return text.split('\x01').map((c) => c.replace(/^\n/, '')).filter(Boolean).map((c) => {
    const [hash, parents, subject, body] = c.split('\x00');
    return { hash, subject, body: body.trim(), merge: parents.trim().split(' ').length > 1 };
  });
}
