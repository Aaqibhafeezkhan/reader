// What the tests share: scratch folders, files written from a tree, and a script run
// with every setting given, so that nothing on the machine running them leaks in:
// not a config.local.json, not git's user.name, not gh.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CONTRIBUTING = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FAKE_GH = path.join(CONTRIBUTING, 'test', 'fake-gh.mjs');

// A scratch folder, removed when the test ends.
export function scratch(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'contributing-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Writes { 'a/b.md': 'text' } under dir.
export function tree(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

export const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

// The settings every script is run with, over a fake gh answering from `gh`.
export function settings(dir, { gh = { issues: {} }, ...over } = {}) {
  const data = path.join(dir, 'gh.json');
  fs.writeFileSync(data, JSON.stringify(gh));
  return {
    READER_CONFIG: path.join(dir, 'no-config.json'),
    // A checkout of its own, which a test that needs git makes with repo().
    READER_CHECKOUT: path.join(dir, 'reader'),
    READER_MEETINGS: path.join(dir, 'meetings'),
    READER_REPO: 'acme/reader',
    READER_CONTRIBUTOR: 'Ada',
    READER_AI: 'Claude',
    READER_GH: FAKE_GH,
    READER_GH_DATA: data,
    READER_GH_LOG: path.join(dir, 'gh.log'),
    ...over,
  };
}

// Runs a script under contributing/ with those settings: { status, out }.
export function run(script, args, env, opts = {}) {
  const r = spawnSync(process.execPath, [path.join(CONTRIBUTING, script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 20000,
    ...opts,
  });
  return { status: r.status, out: r.stdout + r.stderr };
}

// The gh calls a run made.
export const ghCalls = (env) => (fs.existsSync(env.READER_GH_LOG) ? read(env.READER_GH_LOG).trim().split('\n').map((l) => JSON.parse(l)) : []);

// A git repo at dir, with a commit, for a script that asks git; its git, if it's one already.
export function repo(dir, name = 'Ada Lovelace') {
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (fs.existsSync(path.join(dir, '.git'))) return git;
  fs.mkdirSync(dir, { recursive: true });
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', name);
  git('config', 'user.email', 'ada@example.com');
  git('config', 'commit.gpgsign', 'false');
  if (!fs.existsSync(path.join(dir, 'README.md'))) fs.writeFileSync(path.join(dir, 'README.md'), 'hi\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'Start');
  return git;
}
