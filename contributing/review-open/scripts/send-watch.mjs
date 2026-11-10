// Waits for a ticked Send box; see ../../lib/send-watch.mjs.
//   node send-watch.mjs [poll ms] [--once]
import { main } from '../../lib/send-watch.mjs';

await main(process.argv.slice(2));
