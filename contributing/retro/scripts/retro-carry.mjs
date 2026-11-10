// The Try cards not yet tried in a retro, each with what's under it, to carry
// into the next. A Try's [x] means tried, so an agreed but untried one stays open.
//   node retro-carry.mjs <retro.md>
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function carried(text) {
  const out = [];
  let block = null;
  for (const line of text.split('\n')) {
    if (/^(#{1,6} |Try\b|Good\b|Bad\b)/.test(line)) {
      if (block) out.push(block.join('\n').trimEnd());
      block = /^Try( \[ \])?( \([^)]*\))?:/.test(line) ? [line] : null;
    } else if (block) block.push(line);
  }
  if (block) out.push(block.join('\n').trimEnd());
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(carried(fs.readFileSync(process.argv[2], 'utf8')).join('\n\n'));
}
