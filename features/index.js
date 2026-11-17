/**
 * The features the renderer is built from, in the order their markdown-it
 * plugins are applied. Each is a directory here holding what it needs:
 *
 *   { name, requires?, plugin?, html?, css?, raw?, late?, keys?, moved?, closes?, preview?, lazy? }
 *
 * - `requires`: the names of the features this one is built on, whose
 *   tokens, classes or events it reads, as steps reads tasks' boxes and
 *   draws on badges' badges. It still imports nothing from them. Each must
 *   be in the list, and come before it, or loading the list fails.
 * - `plugin`: a markdown-it plugin.
 * - `html`: a pass over the finished page's HTML, for what the tokens don't
 *   reach (the masthead, say).
 * - `css`: added to the rendered page's stylesheet.
 * - `raw`: applied before the rest: a feature that reads the file as
 *   written, before the page's front matter and comments come off
 *   (src/page.js).
 * - `late`: a markdown-it plugin applied after every feature's `plugin`,
 *   for a rule that reads what all of them leave as text: the words an
 *   aside chooses.
 * - `keys`: the front matter keys that are the feature's own, as asides'
 *   `['reviewer', 'topic']` are for `reviewer #: Josh`: they aren't keys of
 *   `env.frontMatter`, nor shown in the byline as written, and the feature
 *   reads them with `env.frontMatter.entry(...keys)` (static/markdown.js).
 *   One it can't read is still its to show, saying so (open-until's
 *   warning), rather than disappearing.
 * - `moved`: `(line, days) => line or null`, for a front matter line that
 *   says a date: the line as it's written for a copy of the page dated
 *   `days` later, so the date keeps its distance from the page's, as
 *   open-until moves its day (src/page.js's `movedLine`). Null for a line
 *   that isn't the feature's.
 * - `closes`: `(frontMatter) => ms or null`, for a feature whose keys say
 *   when the page closes, becoming a record that can't be worked: the
 *   page is drawn `closed` past the earliest (src/page.js), and the server
 *   refuses what the page's inputs write long after it.
 * - `preview`: the path of a script the server loads into the preview frame,
 *   where it can use static/preview-api.js, or a list of them, loaded in
 *   order.
 * - `lazy`: the path of a script, or a list of them, served for the preview
 *   frame to load itself, when a page needs it: a big one, say, that most
 *   pages don't. It's named from the frame's `location`, not its `<base>`,
 *   which is the app's (CONTRIBUTING.md).
 */

import openUntil from './open-until/index.js';
import asides from './asides/index.js';
import fields from './fields/index.js';
import tasks from './tasks/index.js';
import qa from './qa/index.js';
import definitions from './definitions/index.js';
import sizes from './sizes/index.js';
import alerts from './alerts/index.js';
import attributions from './attributions/index.js';
import styles from './styles/index.js';
import date from './date/index.js';
import scripture from './scripture/index.js';
import scriptureLds from './scripture-lds/index.js';
import search from './search/index.js';
import rfc from './rfc/index.js';
import pitch from './pitch/index.js';
import timer from './timer/index.js';
import count from './count/index.js';
import progress from './progress/index.js';
import social from './social/index.js';
import arrows from './arrows/index.js';
import ordinals from './ordinals/index.js';
import math from './math/index.js';
import emoji from './emoji/index.js';
import puzzles from './puzzles/index.js';
import highlight from './highlight/index.js';
import mermaid from './mermaid/index.js';
import music from './music/index.js';
import headline from './headline/index.js';
import number from './number/index.js';
import badges from './badges/index.js';
import steps from './steps/index.js';
import ingredients from './ingredients/index.js';
import columns from './columns/index.js';
import grid from './grid/index.js';
import cards from './cards/index.js';
import row from './row/index.js';
import tabs from './tabs/index.js';
import fold from './fold/index.js';

// open-until comes first, so that in the preview frame the page is judged
// open or closed before any other feature puts back what it kept. styles
// comes after qa and attributions: a `:::` block marks a line after
// qa has made it a list item, and after an attribution's dash is marked, as
// it does any other. highlight comes before puzzles, which wraps the fence
// rule it finds, as mermaid, music, headline and number do. columns, row, grid and cards come after
// styles, which leaves them the lines their blocks open and close on. date comes after fields, so the lines
// it keeps are as written, without its marks. tasks comes after date, as a box
// is named by the words beside it, a date's among them; the lines it writes
// back are the file's as written (`env.written`), so date's marks aren't in them. tabs comes last, so the
// words it compares are the ones the others leave as text; only the `late`
// plugins, which find the words an aside chooses, come after it. fold
// comes after it, marking a heading by its line as written, whoever draws it.
export const FEATURES = checkRequires([openUntil, asides, fields, qa, definitions, sizes, alerts, attributions, styles, columns, row, grid, cards, date, tasks, scripture, scriptureLds, search, rfc, pitch, timer, count, progress, social, math, arrows, ordinals, emoji, highlight, mermaid, music, headline, number, badges, steps, ingredients, puzzles, tabs, fold]);

/**
 * Throws unless each feature's `requires` names features in the list that
 * come before it, in the order their plugins are applied: those that are
 * `raw` first, then the rest, then those with only a `late` plugin, as
 * src/render.js applies them. A feature with a `plugin` and a `late` one
 * goes by its `plugin`, where its rules start. A feature's rules can then
 * rely on what the ones it requires leave in the tokens. Returns the list.
 */
export function checkRequires(features) {
  const lateOnly = (f) => f.late && !f.plugin;
  const order = [
    ...features.filter((f) => f.raw),
    ...features.filter((f) => !f.raw && !lateOnly(f)),
    ...features.filter((f) => !f.raw && lateOnly(f)),
  ].map((f) => f.name);
  for (const f of features) {
    for (const name of f.requires ?? []) {
      const at = order.indexOf(name);
      if (at < 0) throw new Error(`The ${f.name} feature requires ${name}, which isn't in the list of features`);
      if (at > order.indexOf(f.name)) throw new Error(`The ${f.name} feature requires ${name}, which has to come before it in the list of features`);
    }
  }
  return features;
}
