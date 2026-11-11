// Where a review branch stands, as the first line of its index says it.
//   node counts.mjs <worktree> [--no-checks] [--json]
// --no-checks leaves out npm test and npm run lint, which take a while.
import { counts, line } from '../../lib/counts.mjs';

const args = process.argv.slice(2);
const worktree = args.find((a) => !a.startsWith('--'));
if (!worktree) {
  console.error('usage: counts.mjs <worktree> [--no-checks] [--json]');
  process.exit(2);
}
const c = counts(worktree, { checks: !args.includes('--no-checks') });
console.log(args.includes('--json') ? JSON.stringify(c, null, 2) : line(c));
