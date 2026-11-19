import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rewrite } from '../scripts/asides-rewrite.mjs';
import { render } from '../src/render.js';

const KEYED = '---\nreviewer #: Josh\nreviewer c: Claude\n---\n\n';
const SCRIPT = fileURLToPath(new URL('../scripts/asides-rewrite.mjs', import.meta.url));

test('a line that carried an aside or a reply on gets its mark, its words as they were read (gh-305)', () => {
  const { text, changed } = rewrite(`${KEYED}- [ ] Smaller buttons\n  ~# Should these match Copy?\n  ~~c Yes, at 24 pixels.\n    They'd sit in the lower right.\n\nA line.\n~#[line] About it,\n  indented.\n`);
  assert.equal(text, `${KEYED}- [ ] Smaller buttons\n  ~# Should these match Copy?\n  ~~c Yes, at 24 pixels.\n  ~~c They'd sit in the lower right.\n\nA line.\n~#[line] About it,\n~# indented.\n`);
  assert.deepEqual(changed, [8, 12]);
  const [reply] = render(text).body.match(/<div class="gm-reply[\s\S]*?<\/div>/);
  assert.match(reply, /Yes, at 24 pixels\.\nThey’d sit in the lower right\./);
});

test('after a blank, a plain line carried an aside on, up to a block\'s start; under a line, only an indented one did', () => {
  assert.equal(rewrite('a\n\n~ thought\nlazy line\n- a bullet\n').text, 'a\n\n~ thought\n~ lazy line\n- a bullet\n');
  assert.equal(rewrite('a\n\n~ thought\nQ: A question.\n').text, 'a\n\n~ thought\nQ: A question.\n', 'an exchange\'s line was a list\'s item by then');
  assert.equal(rewrite('a line\n~ first\n  second\nmore of the paragraph\n').text, 'a line\n~ first\n~ second\nmore of the paragraph\n');
});

test('front matter, comments and code are left alone, and a second rewrite changes nothing', () => {
  const src = `${KEYED}<!--\n~# not an aside\n  nor this\n-->\n\n\`\`\`\n~ code\n  too\n\`\`\`\n\nText.\n~# Yes,\n  and on.\n`;
  const once = rewrite(src);
  assert.deepEqual(once.changed, [17]);
  assert.match(once.text, /<!--\n~# not an aside\n {2}nor this\n-->/);
  assert.match(once.text, /```\n~ code\n {2}too\n```/);
  assert.deepEqual(rewrite(once.text).changed, []);
});

test('the script rewrites a folder\'s .md files, or with --check lists the lines and exits 1', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asides-rewrite-'));
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'sub', 'a.md'), 'A line.\n~ one\n  two\n');
  fs.writeFileSync(path.join(dir, 'b.txt'), 'A line.\n~ one\n  two\n');
  let status = 0;
  try {
    execFileSync(process.execPath, [SCRIPT, dir, '--check'], { encoding: 'utf8' });
  } catch (e) {
    status = e.status;
    assert.match(e.stdout, /sub[/\\]a\.md:3: ~ two/);
  }
  assert.equal(status, 1);
  assert.equal(fs.readFileSync(path.join(dir, 'sub', 'a.md'), 'utf8'), 'A line.\n~ one\n  two\n', '--check writes nothing');
  execFileSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
  assert.equal(fs.readFileSync(path.join(dir, 'sub', 'a.md'), 'utf8'), 'A line.\n~ one\n~ two\n');
  assert.equal(fs.readFileSync(path.join(dir, 'b.txt'), 'utf8'), 'A line.\n~ one\n  two\n', 'only .md files');
  assert.equal(execFileSync(process.execPath, [SCRIPT, dir, '--check'], { encoding: 'utf8' }), '');
  fs.rmSync(dir, { recursive: true });
});
