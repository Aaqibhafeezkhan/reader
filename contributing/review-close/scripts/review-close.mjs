// Whether a review's branch is ready to fast-forward onto main. Read-only: it
// checks, and says what's in the way. Pushing is a separate step, after a yes.
//   node review-close.mjs <day folder> <worktree>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { boxes, files, open } from './asides-open.mjs';

const [dayArg, worktree] = process.argv.slice(2);
const day = path.resolve(dayArg);
const git = (...a) => execFileSync('git', ['-C', worktree, ...a], { encoding: 'utf8' }).trim();
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
check(spawnSync('git', ['-C', worktree, 'merge-base', '--is-ancestor', 'main', 'HEAD']).status === 0, 'the branch fast-forwards from main');

const log = git('log', 'main..HEAD', '--format=%B');
const index = fs.readFileSync(path.join(day, 'review.md'), 'utf8');
const issues = [...new Set([...index.matchAll(/^(?:- \[[ x]\](?:\[[ x]\]\[[ x]\])?|#+) .*?gh:jzheaux\/reader#(\d+)/gm), ...index.matchAll(/\((?:review\/gh-(\d+)\.md|gh-(\d+)\/review\.md)\), gh:/g)].map((m) => m[1] ?? m[2]))];
for (const n of issues) check(new RegExp(`closes gh-${n}\\b`, 'i').test(log), `a merge closes gh-${n}`);

for (const [cmd, ...a] of [['npm', 'test'], ['npm', 'run', 'lint']]) {
  const run = spawnSync(cmd, a, { cwd: worktree, encoding: 'utf8' });
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

const left = boxes(day).filter((b) => !/fast-forward/.test(b.text));
check(!left.length, 'no boxes left open', left.map((b) => `\n  ${b.at}: ${b.text.slice(0, 90)}`).join(''));
const asides = open(day).filter((a) => !a.at.startsWith('retro.md'));
check(!asides.length, 'no asides waiting on Claude', asides.map((a) => `\n  ${a.at}: ${a.text.slice(0, 90)}`).join(''));
// files() skips .reader, whose backups have directories named for each file.
const fills = files(day).filter((f) => fs.readFileSync(f, 'utf8').includes('<fill'));
check(!fills.length, 'nothing left as <fill>', fills.map((f) => path.relative(day, f)).join(', '));

for (const p of problems) console.log(`FAIL  ${p}`);
console.log(problems.length ? `${problems.length} in the way` : 'ready: ask before pushing');
process.exit(problems.length ? 1 : 0);
