/**
 * Working on reader (`npm run dev`, scripts/dev.js): what a page asks to
 * tell that the server it's talking to was started again, with changed code.
 *
 * `boot` is new each time the server starts. `app` is a fingerprint of the
 * app's own page, what static/index.html loads and static/app/: when it
 * differs from what the page loaded, the whole page is loaded again; when only
 * `boot` does, the change was to the server or to what the preview draws,
 * so the preview alone is (static/app/dev.js).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Every file under `dir`, `rel` to it, in order. */
function filesUnder(dir, rel = '') {
  let entries;
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => {
    const r = path.join(rel, e.name);
    return e.isDirectory() ? filesUnder(dir, r) : [r];
  });
}

/** The app's own files in `staticDir`: index.html, what it loads by `/name`, and app/. */
export function appFiles(staticDir) {
  let html;
  try {
    html = fs.readFileSync(path.join(staticDir, 'index.html'), 'utf8');
  } catch {
    return [];
  }
  const loaded = [...html.matchAll(/(?:src|href)="\/([^"/?#][^"?#]*)"/g)].map(([, f]) => f)
    .filter((f) => !f.startsWith('app/') && fs.existsSync(path.join(staticDir, f)));
  return ['index.html', ...new Set(loaded), ...filesUnder(staticDir, 'app')];
}

/** A fingerprint of the app's own files in `staticDir`, which changes when any of them does. */
export function appFingerprint(staticDir) {
  const hash = crypto.createHash('sha256');
  for (const f of appFiles(staticDir)) {
    hash.update(f).update('\0');
    try {
      hash.update(fs.readFileSync(path.join(staticDir, f)));
    } catch {
      // gone since it was listed: its name alone still counts
    }
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

/** What `/api/dev` answers for a server started now. */
export function devInfo(staticDir) {
  return { boot: crypto.randomUUID(), app: appFingerprint(staticDir) };
}
