// Where a review branch stands, for the first lines of its index: the issues its merges
// close, its commits by kind, its tests and lint, and what of it is pushed.
import { spawnSync } from 'node:child_process';
import { commits, git, gitOK } from './git.mjs';

// npm is npm.cmd on Windows, which only a shell runs.
const npm = (cwd, ...args) => spawnSync('npm', args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });

// node --test's own count, `ℹ tests 12` (or `# tests 12` from the tap reporter).
const tally = (out, what) => Number(new RegExp(`^(?:ℹ|#) ${what} (\\d+)$`, 'm').exec(out)?.[1] ?? NaN);

export function counts(worktree, { base = 'main', checks = true } = {}) {
  const branch = git(worktree, 'rev-parse', '--abbrev-ref', 'HEAD');
  const all = commits(worktree, base);
  const issues = [...new Set(all.filter((c) => c.merge).flatMap((c) => [...c.body.matchAll(/^Closes gh-(\d+)$/gm)].map((m) => Number(m[1]))))];
  const kinds = { see: 0, polish: 0, other: 0 };
  for (const c of all.filter((c) => !c.merge)) kinds[/^See gh-\d+$/m.test(c.body) ? 'see' : /^Polish gh-\d+$/m.test(c.body) ? 'polish' : 'other']++;
  const out = { branch, issues, commits: all.filter((c) => !c.merge).length, kinds };

  if (checks) {
    const t = npm(worktree, 'test');
    out.tests = { ok: t.status === 0, total: tally(t.stdout, 'tests'), failing: tally(t.stdout, 'fail') };
    const l = npm(worktree, 'run', 'lint');
    out.lint = { ok: l.status === 0, problems: Number(/(\d+) problems?/.exec(l.stdout + l.stderr)?.[1] ?? NaN) };
  }

  const remote = `origin/${branch}`;
  if (!gitOK(worktree, 'rev-parse', '--verify', '--quiet', remote)) out.pushed = null;
  else {
    const [ahead, behind] = git(worktree, 'rev-list', '--left-right', '--count', `HEAD...${remote}`).split(/\s+/).map(Number);
    out.pushed = { ahead, behind };
  }
  return out;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// As a line of the index: "2 issues (gh-21, gh-22), 5 commits: 3 on them, 1 polish, 1 other; …".
export function line(c) {
  const parts = [];
  parts.push(c.issues.length ? `${plural(c.issues.length, 'issue')} (${c.issues.map((n) => `gh-${n}`).join(', ')})` : 'no issues merged');
  const kinds = [[c.kinds.see, 'on the issues'], [c.kinds.polish, 'polish'], [c.kinds.other, 'other']].filter(([n]) => n).map(([n, k]) => `${n} ${k}`);
  parts[0] += `, ${plural(c.commits, 'commit')}${kinds.length ? `: ${kinds.join(', ')}` : ''}`;
  if (c.tests) {
    const n = Number.isNaN(c.tests.total) ? 'tests' : plural(c.tests.total, 'test');
    parts.push(c.tests.ok ? `${n}, all passing` : Number.isNaN(c.tests.failing) ? `${n}, failing` : `${n}, ${c.tests.failing} failing`);
  }
  if (c.lint) parts.push(c.lint.ok ? 'lint clean' : Number.isNaN(c.lint.problems) ? 'lint failing' : `lint: ${plural(c.lint.problems, 'problem')}`);
  parts.push(!c.pushed ? 'nothing pushed'
    : !c.pushed.ahead && !c.pushed.behind ? 'pushed'
      : `pushed, ${[c.pushed.ahead && `${c.pushed.ahead} ahead`, c.pushed.behind && `${c.pushed.behind} behind`].filter(Boolean).join(' and ')}`);
  return parts.join('; ');
}
