// The Try cards not yet tried in a retro, each with what's under it, to carry
// into the next. A Try's [x] means tried, so an agreed but untried one stays open.
//   node retro-carry.mjs <retro.md>
import fs from 'node:fs';
import { carried } from '../../lib/retros.mjs';

if (!process.argv[2]) {
  console.error('usage: retro-carry.mjs <retro.md>');
  process.exit(2);
}
console.log(carried(fs.readFileSync(process.argv[2], 'utf8')).join('\n\n'));
