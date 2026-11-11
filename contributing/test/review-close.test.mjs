import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ghCalls, read, repo, run, scratch, settings, tree } from './setup.mjs';

const OK = 'node -e ""';

// An origin, and a clone of it on review/2026.11.22 with gh-21 merged as review-open's
// conventions say, its npm test and lint as given; and the day's folder, all closed.
function ready(t, { test: npmTest = OK, lint = OK, gh = {} } = {}) {
  const dir = scratch(t);
  const src = path.join(dir, 'src');
  tree(src, { 'package.json': JSON.stringify({ scripts: { test: npmTest, lint } }) });
  repo(src);
  const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(dir, 'clone', '-q', '--bare', src, 'origin.git');
  git(dir, 'clone', '-q', 'origin.git', 'work');
  const work = path.join(dir, 'work');
  for (const [k, v] of [['user.name', 'Ada Lovelace'], ['user.email', 'ada@example.com'], ['commit.gpgsign', 'false']]) git(work, 'config', k, v);
  git(work, 'checkout', '-q', '-b', 'review/2026.11.22');
  git(work, 'checkout', '-q', '-b', 'issue/gh-21');
  fs.writeFileSync(path.join(work, 'fold.js'), '// folds\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'Fold Pages\n\nSee gh-21');
  git(work, 'checkout', '-q', 'review/2026.11.22');
  git(work, 'merge', '-q', '--no-ff', 'issue/gh-21', '-m', 'Merge issue/gh-21: Pages fold\n\nCloses gh-21');

  const env = settings(dir, { gh: { issues: { 21: { title: 'Pages fold' } }, ...gh } });
  const day = tree(path.join(env.READER_MEETINGS, '2026-11-22'), {
    'review.md': [
      '---',
      'title: Review 2026-11-22',
      '---',
      '',
      'Pages fold, and nothing else.',
      'Branch `review/2026.11.22`: 1 issue (gh-21).',
      '',
      '- [ ] Send to Claude',
      '',
      '## Please look',
      '',
      '### gh-21 Pages fold',
      '',
      '- [x][x][x] [Its file](gh-21/review.md), gh:acme/reader#21[gh-21]: done.',
      '',
      '## [x] Before merging',
      '',
      '- [ ] Then: push, open the PR, merge it.',
    ].join('\n'),
    'gh-21/review.md': [
      '# [x] Review',
      '',
      '## Closing',
      '',
      'Q (Claude): Does gh:acme/reader#21[gh-21] still describe what shipped?',
      '- (x) The issue stands',
      '- ( ) A PR replaces it',
    ].join('\n'),
    'retro.md': 'Good (Ada): an open retro card does not hold up the merge.\n',
  });
  return { env, day, work, git };
}

const close = ({ env, day, work }) => run('review-close/scripts/review-close.mjs', [day, work], env);

test('the steps it prints can be pasted: a path under home starts ~/, outside any quotes', (t) => {
  const r = ready(t);
  const home = path.dirname(r.env.READER_MEETINGS);
  const { status, out } = close({ ...r, env: { ...r.env, HOME: home, USERPROFILE: home } });
  assert.equal(status, 0, out);
  assert.match(out, /^ {2}git -C ~[\\/]\S+ push -u origin /m);
  assert.match(out, /--body-file ~[\\/]\S*pr\.md"?$/m);
  assert.doesNotMatch(out, /"~/);
});

test('a closed review is ready: it writes the PR\'s body and prints the outward steps, running none of them', (t) => {
  const r = ready(t);
  const { status, out } = close(r);
  assert.equal(status, 0, out);
  for (const ok of ['the worktree is clean', 'main matches origin/main', 'the branch has all of main', 'acme/reader allows merge commits', 'a merge closes gh-21',
    'npm test', 'npm run lint', 'each item has its Closing, asking whether its issue stands', 'no boxes left open',
    'no asides waiting on Claude', 'nothing left as <fill>']) assert.match(out, new RegExp(`^ok {4}${ok.replace(/[.*+?()[\]]/g, '\\$&')}$`, 'm'));
  assert.match(out, /^ready\. wrote .*pr\.md, the PR's body\. Each step below is outward: ask before each one\.$/m);
  assert.match(out, /^ {2}git -C .*work"? push -u origin review\/2026\.11\.22$/m);
  assert.match(out, /^ {2}gh pr create -R acme\/reader --base main --head review\/2026\.11\.22 --title "Batch 2026\.11\.22" --body-file .*pr\.md"?$/m);
  assert.match(out, /^ {2}gh pr merge review\/2026\.11\.22 -R acme\/reader --merge$/m);
  assert.equal(read(r.day, 'pr.md'), [
    'Pages fold, and nothing else.',
    '',
    '- #21 Pages fold',
    '',
    '1 issue (gh-21), 1 commit: 1 on the issues; tests and lint pass.',
    'Each issue\'s merge commit says `Closes gh-N`, so merge this with a merge commit, not a squash or a rebase, and each closes its issue.',
    '',
  ].join('\n'));

  assert.equal(r.git(r.work, 'ls-remote', 'origin', 'review/2026.11.22'), '', 'nothing pushed');
  const calls = ghCalls(r.env).map((a) => a.slice(0, 2).join(' '));
  assert.deepEqual([...new Set(calls)].sort(), ['issue view', 'pr list', 'repo view'], 'gh only read');
});

test('with its PR already open, it says to update the body in place of opening another', (t) => {
  const r = ready(t, { gh: { prs: [{ number: 300, title: 'Batch 2026.11.22', head: 'review/2026.11.22', url: 'https://github.com/acme/reader/pull/300' }] } });
  const { status, out } = close(r);
  assert.equal(status, 0, out);
  assert.match(out, /^ {2}gh pr edit 300 -R acme\/reader --body-file .*pr\.md"? {4}\(it's open: https:\/\/github\.com\/acme\/reader\/pull\/300\)$/m);
  assert.doesNotMatch(out, /gh pr create/);
  assert.match(out, /^ {2}gh pr merge 300 -R acme\/reader --merge$/m);
});

test('a repo that allows no merge commits is in the way, as a squash would drop each Closes gh-N', (t) => {
  const r = ready(t, { gh: { mergeCommitAllowed: false } });
  const { status, out } = close(r);
  assert.equal(status, 1);
  assert.match(out, /^FAIL {2}acme\/reader allows merge commits$/m);
  assert.ok(!fs.existsSync(path.join(r.day, 'pr.md')), 'no body until it\'s ready');
});

test('it lists everything in the way', (t) => {
  const r = ready(t, { lint: 'node -e "console.log(\'two problems\'); process.exit(1)"' });
  fs.appendFileSync(path.join(r.day, 'review.md'), '\n### gh-22 Tabs move on\n\n- [x][ ][ ] gh:acme/reader#22[gh-22]: <fill>.\n\nA line.\n~# still a question\n');
  fs.writeFileSync(path.join(r.work, 'stray.txt'), 'oops\n');
  const { status, out } = close(r);
  assert.equal(status, 1);
  assert.match(out, /^FAIL {2}the worktree is clean: \?\? stray\.txt$/m);
  assert.match(out, /^FAIL {2}a merge closes gh-22$/m);
  assert.match(out, /^FAIL {2}npm run lint: [\s\S]*two problems/m);
  assert.match(out, /^FAIL {2}no boxes left open: \n {2}review\.md:\d+: - \[x\]\[ \]\[ \] gh:acme\/reader#22/m);
  assert.match(out, /^FAIL {2}no asides waiting on Claude: \n {2}review\.md:\d+: ~# still a question$/m);
  assert.match(out, /^FAIL {2}nothing left as <fill>: review\.md$/m);
  assert.match(out, /^6 in the way$/m);
  assert.doesNotMatch(out, /retro\.md/, 'the retro waits for after the merge');
});

test('an item with no Closing to decide its issue is in the way', (t) => {
  const r = ready(t);
  fs.writeFileSync(path.join(r.day, 'gh-21', 'review.md'), '# [x] Review\n');
  assert.match(close(r).out, /^FAIL {2}each item has its Closing, asking whether its issue stands: gh-21\/review\.md$/m);
});

test('without a day folder and a worktree it says how to run it', (t) => {
  const dir = scratch(t);
  const { status, out } = run('review-close/scripts/review-close.mjs', [], settings(dir));
  assert.equal(status, 2);
  assert.match(out, /^usage: review-close\.mjs/);
});
