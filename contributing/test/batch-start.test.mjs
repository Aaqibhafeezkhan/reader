import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '../../src/render.js';
import { asSection } from '../lib/issues.mjs';
import { ghCalls, read, run, scratch, settings, tree } from './setup.mjs';

const GH = {
  issues: {
    10: { title: 'Ready to go', body: '## Steps\n\n~ not an aside\nQ: not a card\n\n```md\n## kept in its fence\n```', milestone: '0.0.5' },
    11: { title: 'Offered to newcomers', milestone: '0.0.5', labels: ['good first issue'] },
    12: { title: 'Someone has a PR', milestone: '0.0.5' },
    13: { title: 'Belongs later', milestone: '0.0.6' },
    14: { title: 'Already done', milestone: '0.0.5', state: 'CLOSED' },
  },
  prs: [{ number: 99, title: 'Fix gh-12', author: 'grace' }],
};

const batchStart = (env, ...args) => run('batch-start/scripts/batch-start.mjs', args, env);

test('an issue body becomes a section: its headings go down two, and what reader would read as its own is escaped', () => {
  assert.equal(asSection(GH.issues[10].body), '#### Steps\n\n\\~ not an aside\n\\Q: not a card\n\n```md\n## kept in its fence\n```');
});

test('it says what stands in the way of each issue, and stops on it', (t) => {
  const dir = scratch(t);
  const env = settings(dir, { gh: GH });
  const { status, out } = batchStart(env, '0.0.5', '10,11,12,13,14');
  assert.equal(status, 1);
  assert.match(out, /^ok {4}gh-10 Ready to go$/m);
  assert.match(out, /^LOOK {2}gh-11 Offered to newcomers\n {8}labelled good first issue: once no PR covers it, gh issue edit 11 -R acme\/reader --remove-label "good first issue"$/m);
  assert.match(out, /^LOOK {2}gh-12 Someone has a PR\n {8}open PR #99 by grace: Fix gh-12 \(look before starting\)$/m);
  assert.match(out, /^LOOK {2}gh-13 Belongs later\n {8}in milestone 0\.0\.6, not 0\.0\.5$/m);
  assert.match(out, /^LOOK {2}gh-14 Already done\n {8}closed already$/m);
  assert.match(out, /^LOOK {2}no --day, so no batch\.md: the wording isn't checked$/m);
  assert.ok(ghCalls(env).every((a) => a.at(-2) === '-R' && a.at(-1) === 'acme/reader'), 'every call names the configured repo');
});

test('with --day it writes each issue\'s wording into batch.md, which reader renders as a box per issue', (t) => {
  const dir = scratch(t);
  const env = settings(dir, { gh: GH, READER_CONTRIBUTOR: 'Grace', READER_AI: 'Codex' });
  const { status, out } = batchStart(env, '0.0.5', '10,14', '--day', '2026-11-22');
  assert.equal(status, 1);
  assert.match(out, /^ok {4}2026-11-22\/batch\.md: added gh-10$/m);
  assert.match(out, /^WORD {2}gh-10: its wording isn't ticked in 2026-11-22\/batch\.md$/m);
  const text = read(env.READER_MEETINGS, '2026-11-22', 'batch.md');
  assert.match(text, /^reviewer #: Grace\nreviewer c: Codex\n/m);
  assert.match(text, /^- \[ \] Send to Codex$/m);
  assert.match(text, /^## \[ \] gh-10 Ready to go\n\ngh:acme\/reader#10\[gh-10\]\n\n#### Steps/m);
  assert.doesNotMatch(text, /gh-14/, 'a closed issue is left out');

  const { body, title } = render(text);
  assert.equal(title, 'Batch 2026-11-22');
  assert.match(body, /aria-label="Send to Codex"/);
  assert.match(body, /<span class="section-title"[^>]*>gh-10 Ready to go<\/span><button type="button" class="section-done"/);
  assert.match(body, /href="https:\/\/github\.com\/acme\/reader\/issues\/10"/);
  assert.doesNotMatch(body, /gm-aside|qa-card/, 'the body\'s look-alikes stay text');
});

test('an issue already in batch.md is left as it is, a ticked one stops nothing, and one that joins later goes at the end', (t) => {
  const dir = scratch(t);
  const env = settings(dir, { gh: GH });
  batchStart(env, '0.0.5', '10', '--day', '2026-11-22');
  const file = path.join(env.READER_MEETINGS, '2026-11-22', 'batch.md');
  fs.writeFileSync(file, read(file).replace('## [ ] gh-10', '## [x] gh-10').replace('#### Steps', '#### Steps\n~# reworded on GitHub'));

  assert.deepEqual(batchStart(env, '0.0.5', '10', '--day', '2026-11-22'), { status: 0, out: 'ok    gh-10 Ready to go\nready to start\n' });
  const { out } = batchStart(env, '0.0.5', '12', '--day', '2026-11-22');
  assert.match(out, /added gh-12/);
  const text = read(file);
  assert.match(text, /~# reworded on GitHub/);
  assert.ok(text.indexOf('gh-10 Ready') < text.indexOf('gh-12 Someone'));
});

test('it lists what the last retro still owes, until a later Outcome says it\'s done', (t) => {
  const dir = scratch(t);
  const env = settings(dir, { gh: GH });
  const retro = path.join(env.READER_MEETINGS, '2026-11-09', 'retro.md');
  tree(path.dirname(retro), { 'retro.md': 'Bad (Ada): Firefox.\nOutcome: Firefox, waiting on me.\n' });
  const owes = batchStart(env, '0.0.5', '10');
  assert.match(owes.out, /^OWED {2}2026-11-09\/retro\.md: Bad \(Ada\): Firefox\.\n {8}Outcome: Firefox, waiting on me\.$/m);

  fs.appendFileSync(retro, 'A (Claude): Fixed.\nOutcome: done, abc1234.\n');
  assert.match(batchStart(env, '0.0.5', '10').out, /^ok {4}nothing waiting on me in 2026-11-09\/retro\.md$/m);
});

test('without a milestone and issues it says how to run it', (t) => {
  const dir = scratch(t);
  const { status, out } = batchStart(settings(dir), '0.0.5');
  assert.equal(status, 2);
  assert.match(out, /^usage: batch-start\.mjs/);
});
