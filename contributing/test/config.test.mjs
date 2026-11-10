import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load } from '../lib/config.mjs';
import { FAKE_GH, repo, scratch } from './setup.mjs';

// A checkout whose git says Ada Lovelace, and a gh that answers from `gh`.
function checkout(t, gh = {}) {
  const dir = scratch(t);
  const main = path.join(dir, 'reader');
  repo(main);
  fs.writeFileSync(path.join(dir, 'gh.json'), JSON.stringify({ issues: {}, ...gh }));
  return { dir, main, env: { READER_GH: FAKE_GH, READER_GH_DATA: path.join(dir, 'gh.json') } };
}

test('with nothing set, the names come from git, the repo from gh, and the day folders are in the checkout', (t) => {
  const { main, env } = checkout(t, { default: 'acme/reader' });
  assert.deepEqual(load({ env, from: main }), {
    main,
    meetings: path.join(main, '.meetings'),
    repo: 'acme/reader',
    contributor: 'Ada',
    ai: 'Claude',
  });
});

test('with no default repo in gh, it is jzheaux/reader', (t) => {
  const { main, env } = checkout(t);
  assert.equal(load({ env, from: main }).repo, 'jzheaux/reader');
});

test('a worktree shares its main checkout, and so its day folders', (t) => {
  const { dir, main, env } = checkout(t);
  const tree = path.join(dir, 'tree');
  repo(main)('worktree', 'add', '-q', tree);
  const c = load({ env, from: tree });
  assert.equal(c.main, main);
  assert.equal(c.meetings, path.join(main, '.meetings'));
});

test('an environment variable comes before git and gh', (t) => {
  const { main, env } = checkout(t, { default: 'acme/reader' });
  const c = load({
    env: { ...env, READER_MEETINGS: '~/notes/meetings', READER_REPO: 'other/reader', READER_CONTRIBUTOR: 'Grace', READER_AI: 'Codex' },
    from: main,
  });
  assert.equal(c.meetings, path.join(os.homedir(), 'notes/meetings'));
  assert.deepEqual([c.repo, c.contributor, c.ai], ['other/reader', 'Grace', 'Codex']);
});

test('config.local.json in the main checkout comes before everything, and a relative folder is from the checkout', (t) => {
  const { main, env } = checkout(t);
  fs.mkdirSync(path.join(main, 'contributing'));
  fs.writeFileSync(path.join(main, 'contributing', 'config.local.json'), JSON.stringify({ meetings: 'days', contributor: 'Grace' }));
  const c = load({ env: { ...env, READER_MEETINGS: '/elsewhere', READER_CONTRIBUTOR: 'Linus', READER_AI: 'Codex' }, from: main });
  assert.equal(c.meetings, path.join(main, 'days'));
  assert.equal(c.contributor, 'Grace');
  assert.equal(c.ai, 'Codex', 'what the file leaves out still falls through');
});

test('READER_CONFIG names the file to read in its place', (t) => {
  const { dir, main, env } = checkout(t);
  fs.writeFileSync(path.join(dir, 'mine.json'), JSON.stringify({ ai: 'Gemini' }));
  assert.equal(load({ env: { ...env, READER_CONFIG: path.join(dir, 'mine.json') }, from: main }).ai, 'Gemini');
});

test('a config file that is not JSON says which file', (t) => {
  const { main, env } = checkout(t);
  fs.mkdirSync(path.join(main, 'contributing'));
  fs.writeFileSync(path.join(main, 'contributing', 'config.local.json'), '{ meetings: ');
  assert.throws(() => load({ env, from: main }), /config\.local\.json/);
});

test('with no name anywhere, it says where to set one', (t) => {
  const { main, env } = checkout(t);
  // An empty name in the repo's own git config hides any global one.
  repo(main)('config', 'user.name', '');
  assert.throws(() => load({ env, from: main }), /READER_CONTRIBUTOR/);
});
