/**
 * report.html, written beside a run's screenshots: every picture in the folder
 * on one page, with what each shows, to narrow down by pills and step through.
 * It's one file with nothing to load but the pictures beside it, so it opens
 * from disk. What a picture shows is read from its name, so that a run adds to
 * what earlier ones left there.
 */

/* global document */

import fs from 'node:fs';
import path from 'node:path';

const FACETS = ['file', 'browser', 'size', 'theme', 'page'];
const BROWSER = /^(chromium|firefox|webkit)$/;
const THEME = /^(light|dark|contrast|forced)$/;

/** What a screenshot's name says it shows, or only its name if it's not one of ours. */
export function tagsOf(name) {
  const stem = name.replace(/\.png$/i, '');
  const words = stem.split('.');
  const tags = {};
  const take = (pattern) => (pattern.test(words.at(-1) ?? '') ? words.pop() : null);
  const part = take(/^part\d+$/);
  const page = take(/^page\d+$/);
  const theme = take(THEME);
  if (!theme) return { file: stem };
  // A desktop goes without saying in the name.
  const size = BROWSER.test(words.at(-1) ?? '') ? 'desktop' : words.pop();
  const browser = take(BROWSER);
  if (!browser) return { file: stem };
  Object.assign(tags, { file: words.join('.'), browser, size, theme });
  if (page) tags.page = page.replace('page', 'page ');
  if (part) tags.part = part.replace('part', 'part ');
  return tags;
}

/** Pills in one category are "or", and in different categories "and"; none is everything. */
export function matches(tags, chosen) {
  return Object.entries(chosen).every(([facet, values]) => !values.length || values.includes(tags[facet]));
}

const inOrder = (a, b) => a.localeCompare(b, undefined, { numeric: true });

const CSS = `
:root { color-scheme: light dark; font: 14px/1.4 system-ui, sans-serif; }
body { margin: 0; background: Canvas; color: CanvasText; }
header { position: sticky; top: 0; z-index: 1; background: Canvas; padding: 10px 16px; border-bottom: 1px solid color-mix(in srgb, CanvasText 20%, transparent); }
.facet { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 3px 0; }
.facet b { width: 4.5em; font-weight: 600; opacity: 0.7; }
button { font: inherit; color: inherit; cursor: pointer; }
.pill { padding: 2px 10px; border-radius: 99px; border: 1px solid color-mix(in srgb, CanvasText 35%, transparent); background: none; }
.pill[aria-pressed="true"] { background: CanvasText; color: Canvas; }
#count { margin-top: 6px; opacity: 0.7; }
#clear { margin-left: 8px; padding: 0; border: 0; background: none; text-decoration: underline; }
main { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; padding: 16px; align-items: start; }
.shot { position: relative; display: block; width: 100%; padding: 0; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); background: none; border-radius: 4px; overflow: hidden; height: 300px; }
.shot img { display: block; width: 100%; }
.tags { position: absolute; right: 4px; bottom: 4px; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 3px; }
.tags span { padding: 0 6px; border-radius: 99px; background: rgb(0 0 0 / 0.75); color: #fff; font-size: 11px; }
#view { position: fixed; inset: 0; z-index: 2; display: flex; flex-direction: column; background: Canvas; }
#view[hidden] { display: none; }
#bar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid color-mix(in srgb, CanvasText 20%, transparent); }
#bar .tags { position: static; flex: 1; justify-content: flex-start; }
#where { opacity: 0.7; }
#frame { flex: 1; overflow: auto; text-align: center; }
#frame img { max-width: 100%; }
`;

/** What runs in the page: the pills, the pictures they leave, and stepping through them. */
function run(shots, facets, matches) {
  const $ = (id) => document.getElementById(id);
  const chosen = Object.fromEntries(facets.map(([facet]) => [facet, []]));
  const tagsHtml = (tags) => {
    const row = document.createElement('span');
    row.className = 'tags';
    for (const value of Object.values(tags)) row.append(Object.assign(document.createElement('span'), { textContent: value }));
    return row;
  };
  let shown = [];
  let at = -1;

  const show = (i) => {
    at = (i + shown.length) % shown.length;
    const shot = shown[at];
    $('picture').src = shot.src;
    $('picture').alt = shot.name;
    $('frame').scrollTop = 0;
    $('where').textContent = `${at + 1} of ${shown.length}`;
    $('viewTags').replaceChildren(tagsHtml(shot.tags));
    $('view').hidden = false;
  };
  const close = () => {
    $('view').hidden = true;
    document.querySelectorAll('.shot')[at]?.focus();
  };

  const draw = () => {
    shown = shots.filter((s) => matches(s.tags, chosen));
    $('count').firstChild.textContent = `${shown.length} of ${shots.length}`;
    $('clear').hidden = !Object.values(chosen).some((v) => v.length);
    $('shots').replaceChildren(...shown.map((shot, i) => {
      const b = Object.assign(document.createElement('button'), { className: 'shot', title: shot.name });
      b.append(Object.assign(document.createElement('img'), { src: shot.src, alt: shot.name, loading: 'lazy' }), tagsHtml(shot.tags));
      b.addEventListener('click', () => show(i));
      return b;
    }));
  };

  for (const [facet, values] of facets) {
    const row = document.createElement('div');
    row.className = 'facet';
    row.append(Object.assign(document.createElement('b'), { textContent: facet }));
    for (const value of values) {
      const pill = Object.assign(document.createElement('button'), { className: 'pill', textContent: value });
      pill.setAttribute('aria-pressed', 'false');
      pill.addEventListener('click', () => {
        const list = chosen[facet];
        const was = list.indexOf(value);
        if (was < 0) list.push(value);
        else list.splice(was, 1);
        pill.setAttribute('aria-pressed', String(was < 0));
        draw();
      });
      row.append(pill);
    }
    $('facets').append(row);
  }
  $('clear').addEventListener('click', () => {
    for (const list of Object.values(chosen)) list.length = 0;
    document.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-pressed', 'false'));
    draw();
  });
  $('prev').addEventListener('click', () => show(at - 1));
  $('next').addEventListener('click', () => show(at + 1));
  $('close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if ($('view').hidden) return;
    if (e.key === 'ArrowLeft') show(at - 1);
    else if (e.key === 'ArrowRight') show(at + 1);
    else if (e.key === 'Escape') close();
  });
  draw();
}

/** The page for these pictures' names. */
export function reportHtml(names) {
  const shots = [...names].sort(inOrder).map((name) => ({ name, src: encodeURIComponent(name), tags: tagsOf(name) }));
  // A category with one value in it has nothing to choose between.
  const facets = FACETS
    .map((facet) => [facet, [...new Set(shots.map((s) => s.tags[facet]).filter(Boolean))].sort(inOrder)])
    .filter(([, values]) => values.length > 1);
  const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screenshots</title>
<style>${CSS}</style>
<header>
  <div id="facets"></div>
  <div id="count"><span></span> <button id="clear" hidden>Clear</button></div>
</header>
<main id="shots"></main>
<div id="view" hidden>
  <div id="bar">
    <button id="prev" aria-label="Previous">←</button>
    <span id="where"></span>
    <button id="next" aria-label="Next">→</button>
    <span id="viewTags"></span>
    <button id="close">Close (Esc)</button>
  </div>
  <div id="frame"><img id="picture" alt=""></div>
</div>
<script>
const matches = ${matches};
(${run})(${json(shots)}, ${json(facets)}, matches);
</script>
</html>
`;
}

/** Writes report.html for every picture now in `out`, and says where it is. */
export function writeReport(out) {
  const names = fs.readdirSync(out).filter((f) => f.endsWith('.png'));
  const file = path.join(out, 'report.html');
  fs.writeFileSync(file, reportHtml(names));
  return file;
}
