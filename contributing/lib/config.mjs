// Who's reviewing, which repo, and where the day folders are, for every script here.
// Each setting is the first of: contributing/config.local.json in the main checkout
// (git-ignored, and optional), an environment variable, what git or gh says, a default.
//
//   meetings     READER_MEETINGS     <main checkout>/.meetings
//   repo         READER_REPO         gh repo set-default --view, else jzheaux/reader
//   contributor  READER_CONTRIBUTOR  the first word of git config user.name
//   ai           READER_AI           Claude
//
// READER_CONFIG names a file to read in place of config.local.json, READER_GH a script
// to run with Node in place of gh, and READER_CHECKOUT another main checkout, as the tests do.
//
// The main checkout is the one every worktree shares, so a review's day folders and
// settings are the same whichever worktree a script runs from.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const run = (cmd, args, cwd, env = process.env) => {
  try {
    return execFileSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

// gh, or for tests a script that stands in for it, READER_GH, run with this Node.
export const ghCommand = (args, env = process.env) => (env.READER_GH ? [process.execPath, [env.READER_GH, ...args]] : ['gh', args]);

// `~/x` as the home folder, as a shell would.
export const untilde = (p) => (p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p);

// The main checkout: the folder holding the .git that every worktree shares.
export function mainCheckout(from = HERE) {
  const common = run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], from);
  return common ? path.dirname(common) : path.resolve(HERE, '../..');
}

export function load({ env = process.env, from = HERE } = {}) {
  const main = env.READER_CHECKOUT ? path.resolve(untilde(env.READER_CHECKOUT)) : mainCheckout(from);
  // What git and gh run with: this process's environment, with what was given over it.
  const child = { ...process.env, ...env };
  // READER_CONFIG names another file, or none, as the tests do with a path that isn't there.
  const file = env.READER_CONFIG ? path.resolve(untilde(env.READER_CONFIG)) : path.join(main, 'contributing', 'config.local.json');
  let local = {};
  if (fs.existsSync(file)) {
    try {
      local = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error(`${file}: ${e.message}`, { cause: e });
    }
  }
  const pick = (key, name, ...fallbacks) => {
    if (local[key]) return String(local[key]);
    if (env[name]) return env[name];
    for (const f of fallbacks) {
      const v = f();
      if (v) return v;
    }
    return '';
  };
  // gh prints a sentence, not a repo, when none is set.
  const ghRepo = () => /^[\w.-]+\/[\w.-]+$/.exec(run(...ghCommand(['repo', 'set-default', '--view'], env), main, child))?.[0];
  const gitName = () => run('git', ['config', 'user.name'], main, child).split(/\s+/)[0];
  const out = {
    main,
    meetings: path.resolve(main, untilde(pick('meetings', 'READER_MEETINGS', () => '.meetings'))),
    repo: pick('repo', 'READER_REPO', ghRepo, () => 'jzheaux/reader'),
    contributor: pick('contributor', 'READER_CONTRIBUTOR', gitName),
    ai: pick('ai', 'READER_AI', () => 'Claude'),
  };
  if (!out.contributor) throw new Error('no contributor name: set git config user.name, READER_CONTRIBUTOR, or "contributor" in contributing/config.local.json');
  return out;
}

// The settings, read once.
let loaded;
export const config = () => (loaded ??= load());

// A path for showing in a command to copy: under the home folder as ~/.
export const tilde = (p) => (p.startsWith(os.homedir() + path.sep) ? `~${p.slice(os.homedir().length)}` : p);

// Text for a RegExp that matches s exactly.
export const literal = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// The front matter lines that give reader its two reviewer aliases: `~#` the contributor, `~c` the AI.
export const reviewers = (c) => `reviewer #: ${c.contributor}\nreviewer c: ${c.ai}`;

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(load(), null, 2));
