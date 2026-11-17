#!/usr/bin/env node
/**
 * `npm run dev -- <dir> [reader's options]`: reader, for working on reader.
 * It runs bin/reader.js, and starts it again whenever reader's code changes,
 * in src/, features/, static/ or bin/; the page notices and shows the change
 * (static/app/dev.js), as it's run with --dev. Only reader's code is watched: the folder it serves,
 * and its .reader/, never start it again. `reader` itself is as it was.
 *
 * Watched here rather than by `node --watch`, which follows only what's
 * imported and not the files the server reads and sends, such as the app's
 * scripts and each feature's CSS, and whose `--watch-path` isn't on every
 * system. A start that fails, from a mistake mid-edit, waits for the next change.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const WATCHED = ['src', 'features', 'static', 'bin'];
// Changes that come together, as a save or a checkout makes them, start it once.
const SETTLE = 150;

/** reader's arguments for each start: in dev mode, and after the first, with no new browser tab. */
export function argsFor(args, first) {
  const dev = args.includes('--dev') ? args : [...args, '--dev'];
  return first || dev.includes('--no-browser') ? dev : [...dev, '--no-browser'];
}

/** Whether a change to `file` (under a watched folder) is to reader's code, not an editor's leavings. */
export function counts(file) {
  if (!file) return true;
  const name = path.basename(file);
  return !file.split(/[\\/]/).some((part) => part.startsWith('.') || part === 'node_modules')
    && !/(~|\.swp|\.swx|\.tmp)$/.test(name) && !/^#.*#$/.test(name);
}

function main(args) {
  let child = null;
  let first = true;
  let again = false;
  let timer = 0;

  const start = () => {
    child = spawn(process.execPath, [path.join(ROOT, 'bin', 'reader.js'), ...argsFor(args, first)], {
      stdio: 'inherit',
    });
    first = false;
    child.on('exit', (code, signal) => {
      child = null;
      if (again) {
        again = false;
        start();
      } else if (code || signal) console.log('dev: reader stopped; it starts again when its code changes');
      else process.exit(0);
    });
  };

  const restart = () => {
    console.log('dev: reader\'s code changed; starting it again');
    if (!child) return start();
    again = true;
    child.kill('SIGTERM');
    return undefined;
  };

  for (const dir of WATCHED) {
    fs.watch(path.join(ROOT, dir), { recursive: true }, (event, file) => {
      if (!counts(file && String(file))) return;
      clearTimeout(timer);
      timer = setTimeout(restart, SETTLE);
    });
  }
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      if (child) child.kill(sig);
      process.exit(0);
    });
  }
  start();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main(process.argv.slice(2));
