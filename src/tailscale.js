/**
 * Sharing reader on this machine's tailnet with `tailscale serve`, for
 * `reader --tailscale`: each of its two ports, the app's and the preview
 * frames', is served at the same port on the tailnet, over plain HTTP, to
 * 127.0.0.1, where reader listens. The tailnet's names for this machine are
 * then names reader answers to (`allowHosts`), and the frames, a port apart
 * from the app on the tailnet as they are here, are found where the page
 * looks for them.
 *
 * What it adds it takes away again when reader stops; a port the tailnet
 * already serves to reader's, set up by hand say, it leaves as it was.
 */

import { spawnSync } from 'node:child_process';

const CLI = 'tailscale';

function run(args) {
  const out = spawnSync(CLI, args, { encoding: 'utf8', timeout: 15000 });
  if (out.error?.code === 'ENOENT') {
    throw new Error("--tailscale needs the tailscale command, and it isn't installed here"
      + (process.platform === 'darwin' ? " (in Tailscale's settings: Install CLI)" : ''));
  }
  if (out.error) throw out.error;
  if (out.status !== 0) throw new Error(`tailscale ${args.join(' ')}: ${(out.stderr || out.stdout).trim()}`);
  return out.stdout;
}

/**
 * The names this machine has on the tailnet, as a browser there may send
 * them: its full MagicDNS name, its short one, and its addresses. Throws if
 * tailscale isn't here or isn't connected.
 */
export function tailnetNames() {
  const status = JSON.parse(run(['status', '--json']));
  if (status.BackendState !== 'Running') {
    throw new Error(`--tailscale needs tailscale connected, and it's ${status.BackendState || 'not'}; try tailscale up`);
  }
  const dns = (status.Self?.DNSName || '').replace(/\.$/, '').toLowerCase();
  const short = dns.split('.')[0];
  const ips = (status.Self?.TailscaleIPs || []).map((ip) => (ip.includes(':') ? `[${ip}]` : ip));
  return { dns, names: [...new Set([dns, short, ...ips].filter(Boolean))] };
}

/**
 * Serves `port` on the tailnet to 127.0.0.1's. Gives back whether it was
 * added, so reader takes away only what it added, and throws if the tailnet
 * already has that port for something else.
 */
export function serve(dns, port) {
  const target = `http://127.0.0.1:${port}`;
  const config = JSON.parse(run(['serve', 'status', '--json']) || '{}');
  if (config.TCP?.[port]) {
    if (config.TCP[port].HTTP && config.Web?.[`${dns}:${port}`]?.Handlers?.['/']?.Proxy === target) return false;
    throw new Error(`the tailnet already serves port ${port} for something else; see tailscale serve status`);
  }
  run(['serve', '--bg', `--http=${port}`, target]);
  return true;
}

/** Takes `port` off the tailnet again; quietly, as reader is stopping. */
export function unserve(port) {
  spawnSync(CLI, ['serve', `--http=${port}`, 'off'], { stdio: 'ignore', timeout: 15000 });
}
