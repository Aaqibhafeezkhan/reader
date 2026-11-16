import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) });

/** The messages lint has for `code`, were it the file at `filePath`. */
async function lint(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.message);
}

/** Asserts that `code`, at `filePath`, fails lint for reaching into features/`name`/. */
async function reaches(code, filePath, name) {
  const messages = await lint(code, filePath);
  assert.equal(messages.length, 1, messages.join('\n'));
  assert.match(messages[0], new RegExp(`refers to features/${name}/, which is the ${name} feature's own`));
}

test('a feature importing another feature\'s files fails lint', async () => {
  await reaches("import { tasks } from '../tasks/index.js';\nexport { tasks };\n", 'features/steps/x.js', 'tasks');
});

test('a feature\'s nested file reaching another feature\'s nested file fails lint', async () => {
  await reaches("import { grid } from '../../tasks/kinds/grid.js';\nexport { grid };\n", 'features/steps/parts/x.js', 'tasks');
});

test('a feature re-exporting another feature\'s files fails lint', async () => {
  await reaches("export { tasks } from '../tasks/index.js';\n", 'features/steps/x.js', 'tasks');
  await reaches("export * from '../tasks/index.js';\n", 'features/steps/x.js', 'tasks');
});

test('a feature importing another feature\'s files when it runs fails lint', async () => {
  await reaches("export const load = () => import('../tasks/index.js');\n", 'features/steps/x.js', 'tasks');
});

test('a feature reading another feature\'s files by URL fails lint', async () => {
  await reaches("export const css = new URL('../tasks/tasks.css', import.meta.url);\n", 'features/steps/x.js', 'tasks');
  await reaches("export const dir = new URL('../tasks/', import.meta.url);\n", 'features/steps/x.js', 'tasks');
});

test('a feature may import what features share, its own files, and its tests the core', async () => {
  const code = "import { escapeAttr } from '../source.js';\nimport { render } from '../../src/render.js';\nimport { page } from '../../test/dom.js';\nimport { x } from './x.js';\nimport { y } from '../steps/y.js';\nexport const css = new URL('./steps.css', import.meta.url);\nexport const preview = new URL('preview.js', import.meta.url);\nexport { escapeAttr, render, page, x, y };\n";
  assert.deepEqual(await lint(code, 'features/steps/x.test.js'), []);
});

test('what features share importing a feature\'s files fails lint', async () => {
  await reaches("import { isOutput } from './highlight/callouts.js';\nexport { isOutput };\n", 'features/layout.js', 'highlight');
});

test('the core importing a feature\'s own files fails lint', async () => {
  await reaches("import { asideTokens } from '../features/asides/index.js';\nexport { asideTokens };\n", 'src/x.js', 'asides');
  await reaches("export const css = new URL('../features/asides/asides.css', import.meta.url);\n", 'src/x.js', 'asides');
});

test('the tests importing a feature\'s own files fails lint', async () => {
  await reaches("import { readEntry } from '../features/asides/key.js';\nexport { readEntry };\n", 'test/x.test.js', 'asides');
});

test('the core may import what features share', async () => {
  const code = "import { FEATURES } from '../features/index.js';\nimport { COLORS } from '../features/names.js';\nexport const dir = new URL('../features/', import.meta.url);\nexport { FEATURES, COLORS };\n";
  assert.deepEqual(await lint(code, 'src/x.js'), []);
});

test('the list of features alone may import a feature\'s index.js, and nothing else of it', async () => {
  assert.deepEqual(await lint("import tasks from './tasks/index.js';\nexport { tasks };\n", 'features/index.js'), []);
  await reaches("import { css } from './tasks/tasks.js';\nexport { css };\n", 'features/index.js', 'tasks');
  await reaches("import tasks from './tasks/index.js';\nexport { tasks };\n", 'features/names.js', 'tasks');
});

/** Asserts that `code`, at `filePath`, fails lint for reading features/`name`/'s placeholder. */
async function readsPlaced(code, filePath, name) {
  const messages = await lint(code, filePath);
  assert.ok(messages.length >= 1, 'no message');
  for (const m of messages) assert.match(m, new RegExp(`reads MARKS\\.${name}, the ${name} feature's placeholder`));
}

test('a feature reading another feature\'s placeholder fails lint (gh-282)', async () => {
  const head = "import { MARKS } from '../source.js';\n";
  await readsPlaced(`${head}export const [a, b] = MARKS.date;\n`, 'features/tasks/x.js', 'date');
  await readsPlaced(`${head}export const a = MARKS['date'][0];\n`, 'features/tasks/x.js', 'date');
  await readsPlaced(`${head}const { date } = MARKS;\nexport { date };\n`, 'features/tasks/x.js', 'date');
  await readsPlaced("import { MARKS } from '../features/source.js';\nexport const a = MARKS.tasks;\n", 'src/x.js', 'tasks');
});

test('lint says which rule a tangle breaks, who broke it and what to do instead (gh-282)', async () => {
  const [result] = await eslint.lintText("import { MARKS } from '../source.js';\nexport const [a, b] = MARKS.date;\n", { filePath: 'features/tasks/x.js' });
  const [m] = result.messages;
  assert.equal(m.ruleId, 'reader/feature-tangle');
  assert.match(m.message, /^tasks reads MARKS\.date, the date feature's placeholder/);
  assert.match(m.message, /`requires`/);
});

test('a feature may read its own placeholder, what features share, and any feature\'s placeholder, not knowing whose (gh-282, gh-291)', async () => {
  const head = "import { MARKS } from '../source.js';\n";
  assert.deepEqual(await lint(`${head}export const [a, b] = MARKS.date;\n`, 'features/date/x.js'), []);
  assert.deepEqual(await lint(`${head}export const [a, b, c] = MARKS.layout;\n`, 'features/tabs/x.js'), []);
  assert.deepEqual(await lint("import { PLACEHOLDER } from '../source.js';\nexport const any = new RegExp(PLACEHOLDER);\n", 'features/styles/x.js'), []);
  // No feature is let through to read one other's (PLACED is gone).
  for (const [name, file] of [['tasks', 'features/styles/x.js'], ['styles', 'features/definitions/x.js']]) {
    const [said, ...more] = await lint(`${head}export const [a, b] = MARKS.${name};\n`, file);
    assert.match(said, new RegExp(`reads MARKS\\.${name}, the ${name} feature's placeholder`));
    assert.deepEqual(more, []);
  }
});

test('a feature setting a name on env that features don\'t share fails lint (gh-282)', async () => {
  for (const code of ['export const f = (state) => { state.env.dates = []; };\n', 'export const f = (env) => { env.dates ??= []; };\n']) {
    const messages = await lint(code, 'features/date/x.js');
    assert.equal(messages.length, 1, messages.join('\n'));
    assert.match(messages[0], /^date sets env\.dates, which isn't one of the names every feature shares/);
  }
});

test('a feature may set a shared name on env, and its own state under a Symbol (gh-282)', async () => {
  const code = "const DATES = Symbol('dates');\nexport const f = (state) => { state.env[DATES] = []; state.env.margin = []; };\n";
  assert.deepEqual(await lint(code, 'features/date/x.js'), []);
});

test('a feature setting a name features may only read fails lint, saying so (gh-282)', async () => {
  for (const code of ['export const f = (state) => { state.env.lineBase = 1; };\n', 'export const f = (env) => { env.frontMatter = {}; };\n']) {
    const messages = await lint(code, 'features/date/x.js');
    assert.equal(messages.length, 1, messages.join('\n'));
    assert.match(messages[0], /^date sets env\.(lineBase|frontMatter), which features may read but not write/);
  }
});

test('each name features share says its type, what it holds, and how to read and write it (gh-282)', async () => {
  const { SHARED_ENV } = await import('../features/source.js');
  const names = SHARED_ENV.map((e) => e.name);
  assert.equal(new Set(names).size, names.length, 'a name twice');
  for (const e of SHARED_ENV) {
    assert.deepEqual(Object.keys(e), ['name', 'type', 'description', 'read', 'write'], e.name);
    for (const k of ['name', 'type', 'description', 'read']) assert.ok(typeof e[k] === 'string' && e[k].trim(), `${e.name}: ${k}`);
    assert.ok(e.write === null || (typeof e.write === 'string' && e.write.trim()), `${e.name}: write`);
  }
});
