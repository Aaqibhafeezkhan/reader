import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { counts, line } from '../lib/counts.mjs';
import { read, repo, run, scratch, settings, tree } from './setup.mjs';

const GH = { issues: { 21: { title: 'Pages fold' }, 22: { title: 'Tabs move on' } } };

// A checkout whose npm test and lint pass, and the settings that point at it.
function checkout(t, scripts = {}) {
  const dir = scratch(t);
  const env = settings(dir, { gh: GH });
  const main = env.READER_CHECKOUT;
  tree(main, {
    'package.json': JSON.stringify({ scripts: { test: 'node -e "console.log(\'ℹ tests 3\'); console.log(\'ℹ fail 0\')"', lint: 'node -e ""', ...scripts } }),
    // As reader's: node_modules without a slash, so that a link to one is ignored as well.
    '.gitignore': '.claude/\nnode_modules\n',
  });
  const git = repo(main);
  const branch = (...args) => run('batch-start/scripts/branch.mjs', args, env);
  const wt = (name) => path.join(main, '.claude', 'worktrees', name);
  // A commit in a worktree, with the given message.
  const commit = (at, file, message) => {
    fs.writeFileSync(path.join(at, file), `${file}\n`);
    repo(at)('add', '-A');
    repo(at)('commit', '-q', '-s', '-m', message);
  };
  return { dir, env, main, git, branch, wt, commit };
}

test('review starts review/YYYY.MM.DD from main in its own worktree, once', (t) => {
  const { git, branch, wt } = checkout(t);
  const first = branch('review', '2026-11-22');
  assert.equal(first.status, 0, first.out);
  assert.match(first.out, /^review\/2026\.11\.22 in .*review-2026\.11\.22, from main$/m);
  assert.equal(repo(wt('review-2026.11.22'))('rev-parse', '--abbrev-ref', 'HEAD'), 'review/2026.11.22');
  assert.equal(git('rev-parse', 'review/2026.11.22'), git('rev-parse', 'main'));

  const again = branch('review', '2026-11-22');
  assert.equal(again.status, 0);
  assert.match(again.out, /^already there: review\/2026\.11\.22 in /m);
  assert.equal(branch('review', '22/11/2026').status, 2);
});

test('issue starts issue/gh-N from the review branch, in a worktree of its own', (t) => {
  const { git, branch, wt, commit } = checkout(t);
  branch('review', '2026-11-22');
  commit(wt('review-2026.11.22'), 'ahead.txt', 'Something on the review branch already');
  const { status, out } = branch('issue', '21');
  assert.equal(status, 0, out);
  assert.match(out, /^issue\/gh-21 in .*issue-gh-21, from review\/2026\.11\.22$/m);
  assert.match(out, /end "See gh-21"/);
  assert.equal(git('rev-parse', 'issue/gh-21'), git('rev-parse', 'review/2026.11.22'));
  assert.ok(fs.existsSync(path.join(wt('issue-gh-21'), 'ahead.txt')));
});

test('an issue\'s worktree borrows the review worktree\'s node_modules, and merge takes the link away', (t) => {
  const { main, branch, wt, commit } = checkout(t);
  fs.mkdirSync(path.join(main, 'node_modules'));
  branch('review', '2026-11-22');
  fs.mkdirSync(path.join(wt('review-2026.11.22'), 'node_modules'));
  const { status, out } = branch('issue', '21');
  assert.equal(status, 0, out);
  const link = path.join(wt('issue-gh-21'), 'node_modules');
  assert.equal(fs.readlinkSync(link), path.join(wt('review-2026.11.22'), 'node_modules'), 'the review worktree\'s, before main\'s');
  assert.match(out, /^linked .*review-2026\.11\.22[\\/]node_modules in$/m);

  commit(wt('issue-gh-21'), 'fold.js', 'Fold Pages\n\nSee gh-21');
  const merged = branch('merge', '21');
  assert.equal(merged.status, 0, merged.out);
  assert.ok(!fs.existsSync(wt('issue-gh-21')), 'its worktree goes, the link no change to stop it');
  assert.ok(fs.existsSync(path.join(wt('review-2026.11.22'), 'node_modules')), 'what it linked to stays');
});

test('with no node_modules anywhere, issue says to install', (t) => {
  const { branch } = checkout(t);
  branch('review', '2026-11-22');
  const { status, out } = branch('issue', '21');
  assert.equal(status, 0, out);
  assert.match(out, /^no node_modules to link: npm install there, or in /m);
});

test('with more than one review branch, it asks which', (t) => {
  const { branch } = checkout(t);
  branch('review', '2026-11-22');
  branch('review', '2026-11-23');
  const { status, out } = branch('issue', '21');
  assert.equal(status, 1);
  assert.match(out, /more than one review branch \(review\/2026\.11\.22, review\/2026\.11\.23\): say which with --date/);
  assert.equal(branch('issue', '21', '--date', '2026-11-23').status, 0);
  assert.match(branch('issue', '22', '--date', '2026-11-30').out, /no branch review\/2026\.11\.30/);
});

test('merge brings the issue in --no-ff, as "Merge issue/gh-N: <title>", Closes gh-N, the trailers and the sign-off', (t) => {
  const { git, branch, wt, commit } = checkout(t);
  branch('review', '2026-11-22');
  branch('issue', '21');
  commit(wt('issue-gh-21'), 'fold.js', 'Fold Pages\n\nSee gh-21');
  const { status, out } = branch('merge', '21', '--trailer', 'Co-Authored-By: Claude <noreply@anthropic.com>');
  assert.equal(status, 0, out);
  assert.match(out, /^merged issue\/gh-21 into review\/2026\.11\.22: [0-9a-f]+ Merge issue\/gh-21: Pages fold$/m);
  assert.equal(git('log', '-1', '--format=%B', 'review/2026.11.22'),
    'Merge issue/gh-21: Pages fold\n\nCloses gh-21\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nSigned-off-by: Ada Lovelace <ada@example.com>');
  assert.equal(git('log', '-1', '--format=%P', 'review/2026.11.22').split(' ').length, 2, 'a merge commit, never a fast-forward');
  assert.ok(!fs.existsSync(wt('issue-gh-21')), 'its worktree goes');
  assert.ok(git('rev-parse', '--verify', 'issue/gh-21'), 'its branch stays');
});

test('merge refuses a commit without "See gh-N", changes not committed, and nothing to merge', (t) => {
  const { branch, wt, commit } = checkout(t);
  branch('review', '2026-11-22');
  branch('issue', '21');
  assert.match(branch('merge', '21').out, /issue\/gh-21 has nothing that review\/2026\.11\.22 hasn't/);

  commit(wt('issue-gh-21'), 'a.js', 'Fold Pages\n\nSee gh-21');
  commit(wt('issue-gh-21'), 'b.js', 'Forgot the Line');
  const unseen = branch('merge', '21');
  assert.equal(unseen.status, 1);
  assert.match(unseen.out, /each commit on issue\/gh-21 ends "See gh-21", and these don't:\n {2}[0-9a-f]{7} Forgot the Line/);

  fs.writeFileSync(path.join(wt('review-2026.11.22'), 'stray.txt'), 'oops\n');
  assert.match(branch('merge', '21').out, /review-2026\.11\.22 has changes not committed:\n\?\? stray\.txt/);
  assert.equal(branch('merge', '21', '--trailer', 'no colon').status, 1);
});

test('a merge that conflicts stops, with its message kept for the commit that finishes it', (t) => {
  const { branch, wt, commit } = checkout(t);
  branch('review', '2026-11-22');
  branch('issue', '21');
  commit(wt('issue-gh-21'), 'same.txt', 'One Way\n\nSee gh-21');
  fs.writeFileSync(path.join(wt('review-2026.11.22'), 'same.txt'), 'the other way\n');
  repo(wt('review-2026.11.22'))('add', '-A');
  repo(wt('review-2026.11.22'))('commit', '-q', '-m', 'The Other Way');
  const { status, out } = branch('merge', '21');
  assert.equal(status, 1);
  assert.match(out, /The merge stopped in .*review-2026\.11\.22\. Resolve it there, then git commit -s/);
  assert.match(read(repo(wt('review-2026.11.22'))('rev-parse', '--absolute-git-dir'), 'MERGE_MSG'), /^Merge issue\/gh-21: Pages fold\n\nCloses gh-21\n/);
});

test('the counts: issues its merges close, commits by kind, tests, lint and what is pushed', (t) => {
  const { dir, git, branch, wt, commit } = checkout(t);
  branch('review', '2026-11-22');
  branch('issue', '21');
  commit(wt('issue-gh-21'), 'a.js', 'Fold Pages\n\nSee gh-21');
  commit(wt('issue-gh-21'), 'b.js', 'Fold Them Back\n\nSee gh-21');
  branch('merge', '21');
  const review = wt('review-2026.11.22');
  commit(review, 'c.js', 'Fold Faster\n\nPolish gh-21');
  commit(review, 'd.js', 'Say So in the Docs');

  assert.equal(line(counts(review, { checks: false })), '1 issue (gh-21), 4 commits: 2 on the issues, 1 polish, 1 other; nothing pushed');
  assert.equal(line(counts(review)), '1 issue (gh-21), 4 commits: 2 on the issues, 1 polish, 1 other; 3 tests, all passing; lint clean; nothing pushed');

  git('clone', '-q', '--bare', '.', path.join(dir, 'origin.git'));
  git('remote', 'add', 'origin', path.join(dir, 'origin.git'));
  git('fetch', '-q', 'origin');
  assert.match(line(counts(review, { checks: false })), /; pushed$/);
  commit(review, 'e.js', 'One More');
  assert.match(line(counts(review, { checks: false })), /; pushed, 1 ahead$/);
});

test('the counts say when tests or lint fail', (t) => {
  const { branch, wt } = checkout(t, {
    test: 'node -e "console.log(\'ℹ tests 3\'); console.log(\'ℹ fail 1\'); process.exit(1)"',
    lint: 'node -e "console.log(\'✖ 2 problems (2 errors, 0 warnings)\'); process.exit(1)"',
  });
  branch('review', '2026-11-22');
  assert.equal(line(counts(wt('review-2026.11.22'))), 'no issues merged, 0 commits; 3 tests, 1 failing; lint: 2 problems; nothing pushed');
});

test('review-open writes the counts into the index\'s first line when the branch\'s worktree is there', (t) => {
  const { env, branch, wt, commit } = checkout(t);
  branch('review', '2026-11-22');
  branch('issue', '21');
  commit(wt('issue-gh-21'), 'a.js', 'Fold Pages\n\nSee gh-21');
  branch('merge', '21');
  const r = run('review-open/scripts/review-open.mjs', ['2026-11-22', '--look', '21', '--no-checks'], env);
  assert.equal(r.status, 0, r.out);
  assert.match(read(env.READER_MEETINGS, '2026-11-22', 'review.md'),
    /^Branch `review\/2026\.11\.22` \(worktree `\.claude\/worktrees\/review-2026\.11\.22`\): 1 issue \(gh-21\), 1 commit: 1 on the issues; nothing pushed\.$/m);
});
