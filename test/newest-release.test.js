import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The Docker workflow's check of whether a release is the newest, which
// alone moves the image's :latest and writes its overview on Docker Hub.
const SCRIPT = fileURLToPath(new URL('../.github/scripts/newest-release.sh', import.meta.url));
const WORKFLOW = fileURLToPath(new URL('../.github/workflows/docker.yml', import.meta.url));

// A scratch repository with these tags, standing in for the remote. Its
// commit is made without the user's own git settings (signing, hooks).
function remote(tags) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-releases-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=reader', '-c', 'user.email=reader@example.com',
    '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
  { cwd: dir, stdio: 'pipe', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
  git('init', '-q');
  git('commit', '-q', '--allow-empty', '-m', 'release');
  for (const tag of tags) git('tag', tag);
  return dir;
}

// What the script says of `version`, and what it writes to $GITHUB_OUTPUT.
function check(version, from) {
  const output = path.join(from, 'output');
  fs.writeFileSync(output, '');
  const log = execFileSync(SCRIPT, [version, from], { cwd: from, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output } });
  return { log: log.trim(), output: fs.readFileSync(output, 'utf8') };
}

const TAGS = ['v0.0.1', 'v0.0.2', 'v0.0.9', 'v0.0.10', 'v0.1.0-rc.1', 'docs'];

test('the newest release, by its numbers, is the latest', (t) => {
  const from = remote(TAGS);
  t.after(() => fs.rmSync(from, { recursive: true, force: true }));
  assert.deepEqual(check('0.0.10', from), {
    log: 'v0.0.10 is the newest release: true (newest is v0.0.10)',
    output: 'latest=true\n',
  });
});

test('an older release is not, though it sorts last as text', (t) => {
  const from = remote(TAGS);
  t.after(() => fs.rmSync(from, { recursive: true, force: true }));
  assert.equal(check('0.0.9', from).output, 'latest=false\n');
  assert.equal(check('0.0.2', from).output, 'latest=false\n');
});

test('a pre-release is not a release', (t) => {
  const from = remote(TAGS);
  t.after(() => fs.rmSync(from, { recursive: true, force: true }));
  assert.equal(check('0.1.0-rc.1', from).output, 'latest=false\n');
});

test('the Docker workflow runs the script, from its own commit', () => {
  const workflow = fs.readFileSync(WORKFLOW, 'utf8');
  assert.match(workflow, /sparse-checkout: \.github\/scripts/);
  assert.match(workflow, /run: workflow\/\.github\/scripts\/newest-release\.sh "\$VERSION"/);
});
