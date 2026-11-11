// Links each skill in contributing/ into the main checkout's .claude/skills/ (Claude Code)
// and .agents/skills/ (Codex and others), both git-ignored, so that an AI working on
// reader finds them. On Windows the links are directory junctions, which need no admin
// rights or Developer Mode. Run from a worktree, it links the main checkout to that
// worktree's skills, so the worktree's copies are the ones in use until it's run again
// from elsewhere.
//   node contributing/link.mjs [--force] [--unlink]
// A folder already there that isn't a link is left alone unless --force, which replaces it.
// --unlink removes the links this made, and nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mainCheckout } from './lib/config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const force = process.argv.includes('--force');
const unlink = process.argv.includes('--unlink');
const main = mainCheckout(HERE);
const skills = fs.readdirSync(HERE).filter((d) => fs.existsSync(path.join(HERE, d, 'SKILL.md')));
const isLink = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
// A link of ours points into some checkout's contributing/<name>.
const ours = (p, name) => isLink(p) && path.basename(fs.readlinkSync(p).replace(/[\\/]+$/, '')) === name
  && path.basename(path.dirname(fs.readlinkSync(p).replace(/[\\/]+$/, ''))) === 'contributing';

let trouble = 0;
for (const into of ['.claude/skills', '.agents/skills']) {
  const dir = path.join(main, into);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of skills) {
    const at = path.join(dir, name);
    const to = path.join(HERE, name);
    const there = isLink(at) || fs.existsSync(at);
    if (unlink) {
      if (ours(at, name)) {
        fs.unlinkSync(at);
        console.log(`unlinked ${path.relative(main, at)}`);
      }
      continue;
    }
    if (there && !isLink(at) && !force) {
      console.log(`left    ${path.relative(main, at)}: a folder, not a link; --force replaces it`);
      trouble++;
      continue;
    }
    if (isLink(at)) fs.unlinkSync(at);
    else if (there) fs.rmSync(at, { recursive: true });
    fs.symlinkSync(to, at, process.platform === 'win32' ? 'junction' : 'dir');
    console.log(`linked  ${path.relative(main, at)} -> ${to}`);
  }
}
process.exit(trouble ? 1 : 0);
