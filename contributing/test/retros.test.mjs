import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { carried, lastRetro, owed } from '../lib/retros.mjs';
import { run, scratch, settings, tree } from './setup.mjs';

const RETRO = [
  '## Good',
  '',
  'Good (Ada): the watcher.',
  'Outcome: kept, waiting on me.',
  '',
  '## Try',
  '',
  'Try (Claude): run batch-start on each issue that joins.',
  'A (Ada): +1',
  '',
  'Try [x] (Ada): one sentence per line.',
  'A (Claude): Done.',
  '',
  'Try (Ada): the contributing/ move.',
  'Outcome: started, waiting on me.',
  'A (Claude): Then: Outcome: done, aea9556.',
  '',
  'That closes this retro.',
  'Three Tries carry to the next.',
].join('\n');

test('the Tries not yet tried carry, each with the lines straight under it, and no more', () => {
  assert.deepEqual(carried(RETRO), [
    'Try (Claude): run batch-start on each issue that joins.\nA (Ada): +1',
    'Try (Ada): the contributing/ move.\nOutcome: started, waiting on me.\nA (Claude): Then: Outcome: done, aea9556.',
  ]);
});

test('a card is owed while its last Outcome says it is waiting on me', () => {
  assert.deepEqual(owed(RETRO), [{ card: 'Good (Ada): the watcher.', outcome: 'kept, waiting on me.' }]);
  assert.deepEqual(owed('Try (Ada): x\n\nOutcome: waiting on me, said of nothing.\n'), [], 'an Outcome past the card is not its');
});

test('the last retro is the newest day folder with one, before a date if given', (t) => {
  const root = tree(scratch(t), {
    '2026-11-01/retro.md': '',
    '2026-11-08/retro.md': '',
    '2026-11-09/review.md': '',
    'notes/retro.md': '',
  });
  assert.equal(lastRetro(root), path.join(root, '2026-11-08', 'retro.md'));
  assert.equal(lastRetro(root, '2026-11-08'), path.join(root, '2026-11-01', 'retro.md'));
  assert.equal(lastRetro(path.join(root, 'none')), null);
});

test('retro-carry prints the Tries to carry', (t) => {
  const dir = scratch(t);
  tree(dir, { 'retro.md': RETRO });
  const { status, out } = run('retro/scripts/retro-carry.mjs', [path.join(dir, 'retro.md')], settings(dir));
  assert.equal(status, 0, out);
  assert.equal(out, `${carried(RETRO).join('\n\n')}\n`);
  assert.equal(run('retro/scripts/retro-carry.mjs', [], settings(dir)).status, 2);
});
