/**
 * Which reader this is: package.json's version, and its release notes; or,
 * run from a git checkout that isn't at that version's tag, the commit it's
 * at. Installed any other way (npm, an image), it's taken to be the release.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = 'https://github.com/jzheaux/reader';

/** `{ label, url }`: `v0.0.2` and its release, or `v0.0.2+abc1234` and its commit. */
export function describe(version, head) {
  const tag = `v${version}`;
  if (!head || head.tags.includes(tag)) return { label: tag, url: `${REPO}/releases/tag/${tag}` };
  return { label: `${tag}+${head.commit.slice(0, 7)}`, url: `${REPO}/commit/${head.commit}` };
}

/** The commit a checkout is at and its tags, from `git log`'s `%H%n%D`; null for anything else. */
export function parseHead(out) {
  const [commit, refs = ''] = out.split('\n');
  if (!/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(commit)) return null;
  const tags = refs.split(', ').filter((r) => r.startsWith('tag: ')).map((r) => r.slice('tag: '.length));
  return { commit, tags };
}

// Only reader's own checkout, not a repository it's installed inside of; and
// quietly nothing if git isn't there or takes too long. Asked without waiting
// for it, so that the server answers everything else while git works.
function head() {
  if (!fs.existsSync(new URL('../.git', import.meta.url))) return Promise.resolve(null);
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return new Promise((resolve) => {
    execFile('git', ['-C', ROOT, 'log', '-1', '--no-show-signature', '--format=%H%n%D'], {
      cwd: ROOT, encoding: 'utf8', timeout: 2000, env,
    }, (err, out) => resolve(err ? null : parseHead(out.trim())));
  });
}

let known;
/** This reader's `{ label, url }`, to wait for: worked out once, from the first ask, which is the server's start. */
export function version() {
  if (!known) {
    const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    known = head().then((h) => describe(version, h));
  }
  return known;
}
