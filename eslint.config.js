import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { SHARED_ENV } from './features/source.js';
import globals from 'globals';

const FEATURES = fileURLToPath(new URL('./features/', import.meta.url));

const FRAME = ['features/*/preview.js', 'features/puzzles/kinds/*.js'];

// Each feature's name, by its directory.
const NAMES = new Set(fs.readdirSync(FEATURES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));

/**
 * The feature whose directory holds `file`, at any depth, or null for a
 * file outside every feature's: one at the top of features/, which
 * features share, or one elsewhere. `dir` says `file` is a directory.
 */
function featureOf(file, dir) {
  const [name, ...rest] = path.relative(FEATURES, file).split(path.sep);
  return name && name !== '..' && !path.isAbsolute(name) && (rest.length || dir) ? name : null;
}

/**
 * A feature is left out or bundled on its own, and the rest do without it,
 * so every file in features/<name>/ is that feature's own. Nothing outside
 * that directory refers to one of them, by an import, an `export ... from`,
 * an `import()` or a `new URL(..., import.meta.url)`, the way a feature
 * loads its CSS and its preview scripts. What features share sits at the
 * top of features/. A feature's one public part is its descriptor, the
 * default export of its index.js, and only features/index.js imports it.
 * A feature's own tests sit in its directory, and may reach ../../src/ and
 * ../../test/ as any file may.
 *
 * Nor does a feature read another's placeholders, `MARKS.<name>` in
 * features/source.js, which it leaves in the text before the text is
 * parsed: it reads the tokens they become, which carry their words in
 * `content` (gh-282). One that finds its own after another's at a line's
 * start steps past any feature's, PLACEHOLDER, without knowing whose (gh-291).
 *
 * And a feature sets on `env` only the names in SHARED_ENV that say how to
 * write them (features/source.js); it keeps its own state under a Symbol of
 * its own, which no other can name.
 */
const featureTangle = {
  meta: {
    type: 'problem',
    messages: {
      private: "{{who}} refers to features/{{name}}/, which is the {{name}} feature's own, so that every other feature works without it. Share what's needed from a file at the top of features/, or reach {{name}} through features/index.js. See \"Layout of the code\" in CONTRIBUTING.md.",
      env: "{{own}} sets env.{{name}}, which isn't one of the names every feature shares (SHARED_ENV, features/source.js). Keep a feature's own state under a key only it can name, `const KEY = Symbol('{{own}}')`, then `state.env[KEY]`. A name for every feature to read goes in SHARED_ENV first, with what it means. See gh-282.",
      readonly: "{{own}} sets env.{{name}}, which features may read but not write (SHARED_ENV, features/source.js, says who sets it). Keep a feature's own state under a key only it can name, `const KEY = Symbol('{{own}}')`, then `state.env[KEY]`. See gh-282.",
      placed: "{{who}} reads MARKS.{{name}}, the {{name}} feature's placeholder, which only holds {{name}}'s place in the text until the text is parsed; then {{name}} turns it into tokens of its own. To build on {{name}}, add '{{name}}' to the `requires` in {{where}} and read its tokens in a core rule (`md.core.ruler.push`), which runs after {{name}}'s. See gh-282.",
    },
  },
  create(context) {
    const from = context.filename;
    const own = featureOf(from);
    const check = (node, specifier, relative) => {
      if (typeof specifier !== 'string' || !relative(specifier)) return;
      const to = path.resolve(path.dirname(from), specifier.replace(/[?#].*/, ''));
      const name = featureOf(to, /\/$/.test(specifier));
      if (!name || featureOf(from) === name) return;
      if (from === path.join(FEATURES, 'index.js') && to === path.join(FEATURES, name, 'index.js')) return;
      context.report({ node, messageId: 'private', data: { name, who: own ? `features/${own}/` : 'This file' } });
    };
    // An import's specifier is relative only as ./ or ../; a URL's is
    // unless it has a scheme or starts at the root.
    const imported = (s) => /^\.\.?(\/|$)/.test(s);
    const url = (s) => !/^([a-z][a-z\d+.-]*:|\/)/i.test(s);
    const literal = (node) => node?.type === 'Literal' ? node.value
      : node?.type === 'TemplateLiteral' && !node.expressions.length ? node.quasis[0].value.cooked : null;
    const source = (node) => node.source && check(node.source, literal(node.source), imported);
    // MARKS.date, MARKS['date'] or const { date } = MARKS, outside features/date/.
    const placed = (node, name) => {
      if (!NAMES.has(name) || name === own) return;
      context.report({ node, messageId: 'placed', data: { name, who: own ?? 'This file', where: own ? `features/${own}/index.js` : "a feature's index.js" } });
    };
    const isMarks = (node) => node?.type === 'Identifier' && node.name === 'MARKS';
    // env.x = ..., state.env.x ??= ..., in a feature's own files.
    const isEnv = (node) => (node?.type === 'Identifier' && node.name === 'env')
      || (node?.type === 'MemberExpression' && !node.computed && node.property.name === 'env');
    return {
      AssignmentExpression(node) {
        const to = node.left;
        if (!own || to.type !== 'MemberExpression' || to.computed || !isEnv(to.object)) return;
        const shared = SHARED_ENV.find((e) => e.name === to.property.name);
        if (!shared) context.report({ node: to, messageId: 'env', data: { name: to.property.name, own } });
        else if (!shared.write) context.report({ node: to, messageId: 'readonly', data: { name: to.property.name, own } });
      },
      MemberExpression(node) {
        if (!isMarks(node.object)) return;
        const name = node.computed ? literal(node.property) : node.property.name;
        if (typeof name === 'string') placed(node, name);
      },
      VariableDeclarator(node) {
        if (!isMarks(node.init) || node.id.type !== 'ObjectPattern') return;
        for (const p of node.id.properties) {
          if (p.type !== 'Property') continue;
          const name = p.computed ? literal(p.key) : p.key.name ?? p.key.value;
          if (typeof name === 'string') placed(p, name);
        }
      },
      ImportDeclaration: source,
      ExportNamedDeclaration: source,
      ExportAllDeclaration: source,
      ImportExpression: source,
      NewExpression(node) {
        const [where, base] = node.arguments;
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'URL') return;
        if (base?.type !== 'MemberExpression' || base.object.type !== 'MetaProperty' || base.property.name !== 'url') return;
        check(where, literal(where), url);
      },
    };
  },
};

export default [
  { ignores: ['node_modules/', 'static/vendor/', 'features/*/vendor/', 'desktop/dist/'] },
  js.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      // Private-use characters are markers between passes; written raw they
      // can't be seen in the source. Spell them as escapes.
      'no-restricted-syntax': ['error',
        { selector: 'Literal[raw=/[\uE000-\uF8FF]/]', message: 'Write private-use characters as \\u escapes.' },
        { selector: 'TemplateElement[value.raw=/[\uE000-\uF8FF]/]', message: 'Write private-use characters as \\u escapes.' },
      ],
    },
  },
  // The server, the CLI, the scripts, the desktop app, the renderer's features
  // and the tests, less what features draw into the preview frame, which has no Node.
  {
    files: ['bin/**/*.js', 'src/**/*.js', 'scripts/**/*.js', 'scripts/**/*.mjs', 'desktop/*.js', 'features/**/*.js', 'test/**/*.js', '*.config.js'],
    ignores: FRAME,
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
  // The review skills' scripts; browse.mjs also hands functions to the page it drives.
  {
    files: ['contributing/**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
  {
    files: ['contributing/lib/browse.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  // Each feature's files are its own, as a package's are in Java: see
  // `features` above.
  {
    plugins: { reader: { rules: { 'feature-tangle': featureTangle } } },
    rules: { 'reader/feature-tangle': 'error' },
  },
  // The app and what it imports are modules; the preview frame's scripts
  // (its own, the puzzles' and the features') are classic scripts sharing
  // `window.Preview` and `window.Puzzles`, Mermaid's `window.mermaid`, abcjs's `window.ABCJS`, and
  // `window.Ink` (ink.js) and `window.Tone` (tone.js). The app and the speaker view have `window.Theme`
  // (theme.js), `window.Frames` (frames.js) and `window.Overview` (overview.js); the app and the preview
  // frame `window.Spoken` (spoken.js).
  {
    files: ['static/app/*.js', 'static/edits.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser, Theme: 'readonly', Frames: 'readonly', Overview: 'readonly', Spoken: 'readonly' } },
  },
  {
    files: ['static/preview-api.js', 'static/preview.js', 'static/ink.js', 'static/theme.js', 'static/frames.js', 'static/speaker.js', 'static/overview.js', 'static/spoken.js', 'static/views.js', 'static/awake.js', 'static/tone.js', ...FRAME],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, Preview: 'readonly', Puzzles: 'readonly', mermaid: 'readonly', ABCJS: 'readonly', Ink: 'readonly', Tone: 'readonly', Theme: 'readonly', Frames: 'readonly', Overview: 'readonly', Spoken: 'readonly' } },
  },
];
