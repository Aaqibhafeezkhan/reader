import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { repo, run, scratch, settings, tree } from './setup.mjs';

const OK = 'node -e ""';

// An origin, and a clone of it on review/2026.11.22 with gh-21 merged as review-open's
// conventions say, its npm test and lint as given; and the day's folder, all closed.
function ready(t, { test: npmTest = OK, lint = OK } = {}) {
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

  const env = settings(dir);
  const day = tree(path.join(env.READER_MEETINGS, '2026-11-22'), {
    'review.md': [
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
      '- [ ] Then: fast-forward `main`, push.',
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

test('a closed review on a branch that fast-forwards is ready, and nothing is pushed', (t) => {
  const r = ready(t);
  const { status, out } = close(r);
  assert.equal(status, 0, out);
  for (const ok of ['the worktree is clean', 'main matches origin/main', 'the branch fast-forwards from main', 'a merge closes gh-21',
    'npm test', 'npm run lint', 'each item has its Closing, asking whether its issue stands', 'no boxes left open',
    'no asides waiting on Claude', 'nothing left as <fill>']) assert.match(out, new RegExp(`^ok {4}${ok.replace(/[.*+?()[\]]/g, '\\$&')}$`, 'm'));
  assert.match(out, /^ready: ask before pushing$/m);
  assert.equal(r.git(r.work, 'rev-parse', 'origin/main'), r.git(r.work, 'rev-parse', 'main'));
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
