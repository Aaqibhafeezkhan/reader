// Whether a review's branch is ready for its PR into main. It checks, says what's in
// the way, and once nothing is, writes the PR's body into the day folder as pr.md and
// prints the outward commands: the push, the PR, and the merge with a merge commit,
// which is what lets each issue's "Closes gh-N" close it. It runs none of them.
//   node review-close.mjs <day folder> <worktree>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { boxes, files, open } from '../../lib/asides-open.mjs';
import { config, ghCommand, literal, tilde } from '../../lib/config.mjs';
import { counts, line } from '../../lib/counts.mjs';
import { title } from '../../lib/issues.mjs';

const [dayArg, worktree] = process.argv.slice(2);
if (!dayArg || !worktree) {
  console.error('usage: review-close.mjs <day folder> <worktree>');
  process.exit(2);
}
const c = config();
const day = path.resolve(dayArg);
const git = (...a) => execFileSync('git', ['-C', worktree, ...a], { encoding: 'utf8' }).trim();
const json = (args) => JSON.parse(execFileSync(...ghCommand(args), { encoding: 'utf8' }));
const gh = (...a) => json([...a, '-R', c.repo]);
const problems = [];
const ok = (m) => console.log(`ok    ${m}`);
const check = (good, m, why = '') => {
  if (good) ok(m);
  else problems.push(`${m}${why ? `: ${why}` : ''}`);
};

const dirty = git('status', '--short');
check(!dirty, 'the worktree is clean', dirty);
git('fetch', '-q', 'origin');
check(git('rev-parse', 'main') === git('rev-parse', 'origin/main'), 'main matches origin/main');
check(spawnSync('git', ['-C', worktree, 'merge-base', '--is-ancestor', 'main', 'HEAD']).status === 0, 'the branch has all of main');
// A squash or a rebase leaves the merge commits behind, and their Closes gh-N with them.
// repo view names the repo as its argument; it has no -R.
check(json(['repo', 'view', c.repo, '--json', 'mergeCommitAllowed']).mergeCommitAllowed, `${c.repo} allows merge commits`);

const log = git('log', 'main..HEAD', '--format=%B');
const index = fs.readFileSync(path.join(day, 'review.md'), 'utf8');
// An issue in the index: a box or heading with its gh: link, or an item's file link followed by one.
const listed = new RegExp(String.raw`^(?:- \[[ x]\](?:\[[ x]\]\[[ x]\])?|#+) .*?gh:${literal(c.repo)}#(\d+)`, 'gm');
const issues = [...new Set([...index.matchAll(listed), ...index.matchAll(/\((?:review\/gh-(\d+)\.md|gh-(\d+)\/review\.md)\), gh:/g)].map((m) => m[1] ?? m[2]))];
for (const n of issues) check(new RegExp(`closes gh-${n}\\b`, 'i').test(log), `a merge closes gh-${n}`);

for (const [cmd, ...a] of [['npm', 'test'], ['npm', 'run', 'lint']]) {
  // npm is npm.cmd on Windows, which only a shell runs.
  const run = spawnSync(cmd, a, { cwd: worktree, encoding: 'utf8', shell: process.platform === 'win32' });
  check(run.status === 0, [cmd, ...a].join(' '), (run.stdout + run.stderr).split('\n').slice(-12).join('\n'));
}

// Each item decides whether its issue still says what shipped; boxes() below catches an unpicked one.
// An item is gh-N/review.md; older days kept it as review/gh-N.md.
const items = [
  ...fs.readdirSync(day).filter((d) => /^gh-\d+$/.test(d) && fs.existsSync(path.join(day, d, 'review.md'))).map((d) => `${d}/review.md`),
  ...(fs.existsSync(path.join(day, 'review')) ? fs.readdirSync(path.join(day, 'review')).filter((f) => /^gh-\d+\.md$/.test(f)).map((f) => `review/${f}`) : []),
];
check(items.length > 0 || !/^### gh-\d+/m.test(index.split(/^## Done\b/m)[0]), 'each item to look at has its file', 'none found in gh-N/');
// Its `## Closing` asks whether the issue still describes what shipped (older days: `### Issue or PR`).
const undecided = items.filter((f) => {
  const text = fs.readFileSync(path.join(day, f), 'utf8');
  return !/^###\s+Issue or PR\b/m.test(text) && !/^##\s+Closing\b[\s\S]*still describe what shipped/m.test(text);
});
check(!undecided.length, 'each item has its Closing, asking whether its issue stands', undecided.join(', '));

// The last box, ticked once it's merged: "Then: push, open the PR, merge it." (older days: "fast-forward").
const left = boxes(day).filter((b) => !/Then: (?:push|fast-forward)/.test(b.text));
check(!left.length, 'no boxes left open', left.map((b) => `\n  ${b.at}: ${b.text.slice(0, 90)}`).join(''));
const asides = open(day).filter((a) => !a.at.startsWith('retro.md'));
check(!asides.length, `no asides waiting on ${c.ai}`, asides.map((a) => `\n  ${a.at}: ${a.text.slice(0, 90)}`).join(''));
// files() skips .reader, whose backups have directories named for each file.
const fills = files(day).filter((f) => fs.readFileSync(f, 'utf8').includes('<fill'));
check(!fills.length, 'nothing left as <fill>', fills.map((f) => path.relative(day, f).split(path.sep).join('/')).join(', '));

for (const p of problems) console.log(`FAIL  ${p}`);
if (problems.length) {
  console.log(`${problems.length} in the way`);
  process.exit(1);
}

// The PR: "Batch 2026.11.22", its body the index's first line, its issues and its counts.
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const prTitle = `Batch ${branch.replace(/^review\//, '')}`;
const summary = index.replace(/^---\n[\s\S]*?\n---\n/, '').trim().split('\n')[0];
const tally = line({ ...counts(worktree, { checks: false }), pushed: undefined });
const body = path.join(day, 'pr.md');
fs.writeFileSync(body, `${summary}

${issues.map((n) => `- #${n} ${title(n)}`).join('\n')}

${tally}; tests and lint pass.
Each issue's merge commit says \`Closes gh-N\`, so merge this with a merge commit, not a squash or a rebase, and each closes its issue.
`);

// Quoted for the shell it's pasted in. On Windows, \ is part of a path, not an escape,
// and a " inside is doubled, as PowerShell and cmd both read it.
const WIN = process.platform === 'win32';
const q = (s) => (/^[\w./:@=-]+$/.test(s) ? s : WIN ? `"${s.replace(/"/g, '""')}"` : `"${s.replace(/(["\\$`])/g, '\\$1')}"`);
// A path to paste: a shell expands ~ only outside quotes.
const at = (p) => { const t = tilde(p); return t.startsWith(`~${path.sep}`) ? `~${path.sep}${q(t.slice(2))}` : q(t); };
const [pr] = gh('pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,url');
console.log(`ready. wrote ${tilde(body)}, the PR's body. Each step below is outward: ask before each one.`);
console.log(`  git -C ${at(worktree)} push -u origin ${branch}`);
if (pr) console.log(`  gh pr edit ${pr.number} -R ${c.repo} --body-file ${at(body)}    (it's open: ${pr.url})`);
else console.log(`  gh pr create -R ${c.repo} --base main --head ${branch} --title ${q(prTitle)} --body-file ${at(body)}`);
console.log('Once it\'s approved, a committer merges it with a merge commit, then brings main up to it:');
console.log(`  gh pr merge ${pr ? pr.number : branch} -R ${c.repo} --merge`);
console.log(`  git -C ${at(c.main)} pull --ff-only origin main`);
