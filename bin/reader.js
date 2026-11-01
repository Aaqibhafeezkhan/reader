#!/usr/bin/env node
/**
 *   reader <dir> [--port 8734] [--frame-port 8735] [--no-browser] [--open <file>] [--host <address> --allow-host <name>]
 *   reader export <file>... [--out <file>] [--no-draw]
 *   reader --version
 *
 * Serve a directory of markdown for reading and editing in the browser, or
 * save documents in it as HTML (src/export-cli.js).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer, listenFrames } from '../src/server.js';
import { version } from '../src/version.js';

const USAGE = `usage: reader <dir> [--port 8734] [--frame-port 8735] [--no-browser]
                     [--open <file>] [--host <addr> --allow-host <name>]
       reader export <file>... [--out <file>] [--no-draw]
       reader --version

  <dir>          the content directory to serve (default: current directory)
  --port <n>     port to listen on (default: 8734, or the next free one)
  --frame-port <n>
                 port the preview frames are served on where the browser
                 can't have them at frames.localhost: Safari, or another
                 device (default: the port after --port's, or a free one)
  --no-browser   don't open a browser tab
  --open <file>  open this file first (path relative to <dir>)
  --host <addr>  address to listen on (default: 127.0.0.1); 0.0.0.0 for every
                 network this machine is on. There is no sign-in: whoever can
                 reach it can read and write <dir>
  --allow-host <name>
                 a name or address other devices reach this machine by, as
                 the browser will send it; repeat for more than one
  --version      print reader's version: v0.0.2, or v0.0.2+abc1234 from a
                 checkout that isn't at that release
`;

function parseArgs(argv) {
  const opts = { dir: null, port: null, framePort: null, browser: true, open: null, host: '127.0.0.1', allowHosts: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      process.stdout.write(USAGE);
      process.exit(0);
    } else if (a === '--version') {
      // Said at once, as --help is, whatever else is asked for.
      return { ...opts, version: true };
    } else if (a === '--port' || a === '-p') {
      opts.port = portNumber(argv[++i]);
    } else if (a.startsWith('--port=')) {
      opts.port = portNumber(a.slice('--port='.length));
    } else if (a === '--frame-port') {
      opts.framePort = portNumber(argv[++i]);
    } else if (a.startsWith('--frame-port=')) {
      opts.framePort = portNumber(a.slice('--frame-port='.length));
    } else if (a === '--no-browser') {
      opts.browser = false;
    } else if (a === '--open') {
      opts.open = argv[++i];
    } else if (a === '--host' || a === '--allow-host') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) fail(`${a} needs a value`);
      if (a === '--host') opts.host = value;
      else opts.allowHosts.push(value);
    } else if (a.startsWith('-')) {
      fail(`unknown option ${a}\n\n${USAGE}`);
    } else if (!opts.dir) {
      opts.dir = a;
    } else {
      fail(`unexpected argument ${a}\n\n${USAGE}`);
    }
  }
  for (const [name, port] of [['--port', opts.port], ['--frame-port', opts.framePort]]) {
    if (port !== null && (!Number.isInteger(port) || port < 0 || port > 65535)) fail(`${name} must be a number`);
  }
  if (opts.port !== null && opts.port !== 0 && opts.port === opts.framePort) fail('--port and --frame-port must differ');
  return opts;
}

// Digits only: Number() takes '' and ' ' for 0, which is any free port.
function portNumber(value) {
  return /^\d+$/.test(value ?? '') ? Number(value) : NaN;
}

function fail(msg) {
  process.stderr.write(`reader: ${msg}\n`);
  process.exit(1);
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* the URL is printed anyway */
  }
}

if (process.argv[2] === 'export') {
  const { main } = await import('../src/export-cli.js');
  try {
    await main(process.argv.slice(3));
  } catch (err) {
    fail(err.message);
  }
  process.exit(0);
}

const LOCAL = new Set(['127.0.0.1', 'localhost', '::1']);
const EVERYWHERE = new Set(['0.0.0.0', '::']);

const opts = parseArgs(process.argv.slice(2));
if (opts.version) {
  process.stdout.write(`${(await version()).label}\n`);
  process.exit(0);
}
const dir = path.resolve(opts.dir || '.');
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`not a directory: ${dir}`);

// The address to print and open: the one listened on, or, listening on
// every network, this machine's own. An address listened on is one the
// browser may name, though it isn't loopback.
const at = EVERYWHERE.has(opts.host) ? '127.0.0.1' : opts.host.includes(':') ? `[${opts.host}]` : opts.host;
const allowHosts = LOCAL.has(opts.host) || EVERYWHERE.has(opts.host) ? opts.allowHosts : [...opts.allowHosts, at];

const made = createServer({ root: dir, allowHosts });
const { server, content } = made;

// Without --port, count up from 8734 so each directory gets its own instance
// and the URLs stay about the same from run to run.
const DEFAULT_PORT = 8734;
const MAX_TRIES = 50;
let port = opts.port ?? DEFAULT_PORT;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && opts.port === null && port < DEFAULT_PORT + MAX_TRIES - 1) {
    server.listen(++port, opts.host);
    return;
  }
  if (err.code === 'EADDRINUSE') {
    fail(
      opts.port === null
        ? `ports ${DEFAULT_PORT}-${port} are all busy; pick one with --port.`
        : `port ${port} is busy; pick another with --port, or leave it off to use a free one.`
    );
  }
  fail(err.message);
});

server.listen(port, opts.host);

// The preview frames' second port beside it, before the address is printed:
// the one asked for, or the next after the app's, or else any that's free.
server.on('listening', async () => {
  const { port } = server.address();
  try {
    await listenFrames(made, opts.framePort ?? port + 1, { anyPort: opts.framePort === null });
  } catch (err) {
    fail(err.code === 'EADDRINUSE'
      ? `port ${opts.framePort} is busy; pick another with --frame-port, or leave it off to use a free one.`
      : err.message);
  }
  const hash = opts.open ? `#${encodeURIComponent(opts.open)}` : '';
  const url = `http://${at}:${port}/${hash}`;
  const count = content.list().length;
  console.log(`\n  reader — ${content.root}`);
  console.log(`  ${count} file${count === 1 ? '' : 's'}`);
  console.log(`  ${url}`);
  for (const name of opts.allowHosts) console.log(`  http://${name}:${port}/${hash}`);
  if (!LOCAL.has(opts.host)) {
    console.log(`\n  listening on ${opts.host} with no sign-in: anyone who can reach this`);
    console.log('  machine can read and write these files. Keep it to a network you trust.');
    if (!opts.allowHosts.length && EVERYWHERE.has(opts.host)) {
      console.log('  Other devices are refused until their name for it is given with --allow-host.');
    }
  }
  console.log('  ctrl-c to stop\n');
  if (opts.browser) openBrowser(url);
});

// SIGTERM is how a container or a service manager stops it.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nstopped');
    process.exit(0);
  });
}
