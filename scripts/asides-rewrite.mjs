#!/usr/bin/env node
/**
 * Rewrites asides written before gh-305 the way they're read now: each line
 * of an aside or a reply starts with its own mark, as a quote's lines start
 * with `>`.
 *
 * Before, an aside went on onto the lines after it that had no mark: one
 * indented past its `~`, or, for an aside after a blank line, a line of
 * plain text, up to a blank line or a line that starts a block. Now nothing
 * but its own `~` lines carries it on, so each such line gets the mark and
 * aliases of the aside or reply it carried on (`~#c `, `~~c `), its words
 * as they were read, and so reads as it did. Words in brackets and a box
 * stay on the first line only, as they start an aside.
 *
 *   node scripts/asides-rewrite.mjs <file or folder>... [--check]
 *
 * A folder is read for its `.md` files, all the way down. `--check` lists
 * the lines that would change without writing them, and exits 1 if there
 * are any. Rewriting a file already rewritten changes nothing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from '../src/page.js';
import { keyOf } from '../features/key.js';
import { fenced, LIST_MARKER } from '../features/source.js';

// As the asides feature read them before gh-305 (features/asides/preprocess.js).
const ASIDE_RE = /^([ \t]*)~(?!~)([^\s~[]*)(?:\[((?:[^\]\\\n]|\\.)+)\](?:\{([a-z]+)\})?)?([ \t]+.*)?$/i;
const REPLY_RE = /^([ \t]*)~~([^\s~[]*)([ \t]+.*)?$/;
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;
// What ended a plain line's carrying an aside on: a block's start, as
// markdown's, reader's own, and a line another feature had already made a
// list's item when the asides were read (an exchange's or a vote's).
const BLOCK_START_RE = new RegExp(String.raw`^[ \t]*(?:${LIST_MARKER}[ \t]|#{1,6}[ \t]|>|${'```'}|~{3,}|-{3,}\s*$|_{3,}\s*$|:{3}|\+{3,}(?:[ \t]|$)|@[ \t]|\\?![ \t]*[^\s[!:()][^:\n]*:(?:[ \t]|$)|(?:Q|A|Good|Bad|Try)(?:[ \t]+\[[ xX]\])?(?:[ \t]*\([^)]*\))?:|\+1\b)`);

// Whether `run`, the aliases after a `~`, makes it an aside by `key`: one
// declared at least, and one more at most, a slip (features/asides/key.js).
function attribute(run, key) {
  const chars = [...run];
  const declared = chars.filter((c) => key.has(c)).length;
  return declared > 0 && chars.length - declared <= 1;
}

const expandTabs = (line) => line.replace(/\t/g, '    ');
const indentOf = (line) => expandTabs(line).match(/^ */)[0].length;

/** `line` as an aside's first line, `{ indent, run }`, or null. */
function asideOf(line, key) {
  const m = ASIDE_RE.exec(line);
  if (!m || (m[2] && !attribute(m[2], key))) return null;
  return { m, indent: m[1], run: m[2], head: m[0].length - m[1].length - (m[5] || '').length };
}

/** `line` as a reply's first line, or null. */
function replyOf(line, key) {
  const m = REPLY_RE.exec(line);
  if (!m || !m[3]?.trim() || (m[2] && !attribute(m[2], key))) return null;
  return { m, indent: m[1], run: m[2], head: m[0].length - m[1].length - m[3].length };
}

/**
 * `src` with each line that carried an aside or a reply on given its mark:
 * `{ text, changed }`, `changed` the lines (from 0) that were.
 */
export function rewrite(src) {
  const text = String(src).replace(/\r\n?/g, '\n');
  const all = text.split('\n');
  const { meta, source, lines: from } = extract(text);
  const key = keyOf(meta);
  const lines = source.split('\n');
  const changed = [];
  const code = fenced();
  let last = '';
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    const found = !code(line) && asideOf(line, key);
    if (!found) {
      last = line;
      i++;
      continue;
    }
    const within = last.trim() !== '';
    i = carryOn(i, found, '~', within);
    for (let r; i < lines.length && (r = replyOf(lines[i], key));) i = carryOn(i, r, '~~', within);
    if (!within && i < lines.length && !lines[i].trim()) i++;
  }
  return { text: all.join('\n'), changed };

  // Marks each line that carried on the aside or reply on `lines[at]`, and
  // returns the line after them.
  function carryOn(at, { indent, run, head }, tilde, within) {
    const markerIndent = indentOf(lines[at]);
    const contentIndent = expandTabs(lines[at]).indexOf('~') + head + 1;
    let k = at + 1;
    for (; k < lines.length; k++) {
      const next = lines[k];
      if (!next.trim() || FENCE_RE.test(next) || asideOf(next, key) || replyOf(next, key)) break;
      const ind = indentOf(next);
      if (!(ind > markerIndent || (!within && !BLOCK_START_RE.test(next)))) break;
      const words = expandTabs(next).slice(Math.min(ind, contentIndent));
      all[from[k]] = `${indent}${tilde}${run} ${words}`;
      changed.push(from[k]);
    }
    return k;
  }
}

/** The `.md` files at `p`: itself, or those in it, all the way down. */
function markdownAt(p) {
  if (!fs.statSync(p).isDirectory()) return [p];
  return fs.readdirSync(p, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
    .flatMap((e) => (e.isDirectory() ? markdownAt(path.join(p, e.name)) : e.name.endsWith('.md') ? [path.join(p, e.name)] : []));
}

function main(args) {
  const check = args.includes('--check');
  const paths = args.filter((a) => a !== '--check');
  if (!paths.length) {
    console.error('usage: node scripts/asides-rewrite.mjs <file or folder>... [--check]');
    return 2;
  }
  let count = 0;
  for (const file of paths.flatMap(markdownAt)) {
    const before = fs.readFileSync(file, 'utf8');
    const { text, changed } = rewrite(before);
    if (!changed.length) continue;
    count += changed.length;
    if (check) for (const n of changed) console.log(`${file}:${n + 1}: ${text.split('\n')[n]}`);
    else {
      fs.writeFileSync(file, before.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text);
      console.log(`${file}: ${changed.length} line${changed.length === 1 ? '' : 's'}`);
    }
  }
  return check && count ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
