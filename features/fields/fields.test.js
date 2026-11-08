import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';

test('@ lines become form fields that know their line and value', () => {
  const { body } = render('# Form\n\n@ My Name: Josh\n@ Date:\n@ Time: 10:30 -> *noon* <b>\n');
  assert.match(body, /<span class="field" data-line="2" data-text="@ My Name: Josh" data-head="@ My Name:"><span class="field-label">My Name<\/span><span class="field-value" data-value="Josh" tabindex="0" role="textbox" aria-label="My Name">Josh<\/span><\/span>/);
  assert.match(body, /data-line="3" data-text="@ Date:" data-head="@ Date:"><span class="field-label">Date<\/span><span class="field-value" data-value="" tabindex="0" role="textbox" aria-label="Date"><\/span>/);
  assert.match(body, /data-value="10:30 -&gt; \*noon\* &lt;b&gt;"[^>]*>10:30 -&gt; \*noon\* &lt;b&gt;</);
});

test('@ lines with more colons are that many lines tall', () => {
  const { body } = render('@ Notes ::: it went well\n@ Bio::\n@ Name: Josh\n');
  assert.match(body, /<span class="field" data-line="0" data-text="@ Notes ::: it went well" data-head="@ Notes :::" data-lines="3" style="--lines: 3"><span class="field-label">Notes<\/span><span class="field-value" data-value="it went well"/);
  assert.match(body, /data-line="1" [^>]* data-lines="2" style="--lines: 2"><span class="field-label">Bio<\/span><span class="field-value" data-value=""/);
  assert.match(body, /<span class="field" data-line="2" [^>]*><span class="field-label">Name</);
});

test('@ lines in code, indented, without a label or mid-sentence are left as typed', () => {
  const { body } = render('```\n@ No: code\n```\n\nhello @ there: x\n\n @ Indented: x\n\n@ : empty\n\n@mention: hi\n');
  assert.doesNotMatch(body, /class="field"/);
  assert.match(body, /@ No: code/);
  assert.match(body, /hello @ there: x/);
  assert.match(body, /@mention: hi/);
});

test('a field carried into an aside keeps its line', () => {
  const { body } = render('~ a thought\n@ Name: x\n', { line: 3 });
  assert.match(body, /gm-aside-cell[\s\S]*<span class="field" data-line="4" data-text="@ Name: x" data-head="@ Name:">/);
});

test('a field in a ::: block is styled with it', () => {
  const { body } = render('::: red\n@ Name: x\n:::\n');
  assert.match(body, /<p style="color: red"><span class="field" data-line="1" /);
});

test('a field of ( ) choices is radio buttons in a row, each knowing its line with only it picked', () => {
  const { body } = render('@ Session: ( ) Sat AM  (x) Sat PM ( ) Sun (late)\n');
  assert.match(body, /<span class="field" data-line="0" data-text="@ Session: \( \) Sat AM {2}\(x\) Sat PM \( \) Sun \(late\)" data-head="@ Session:" data-choices data-answered="true" role="radiogroup" aria-labelledby="field-0"><span class="field-label" id="field-0">Session<\/span><span class="field-choices">/);
  const radios = [...body.matchAll(/<label class="field-choice"><input type="radio" class="choice-box" name="field-0" data-on="([^"]*)"( checked)?> ([^<]*)<\/label>/g)]
    .map(([, on, checked, label]) => ({ on, checked: Boolean(checked), label }));
  assert.deepEqual(radios, [
    { on: '@ Session: (x) Sat AM  ( ) Sat PM ( ) Sun (late)', checked: false, label: 'Sat AM' },
    { on: '@ Session: ( ) Sat AM  (x) Sat PM ( ) Sun (late)', checked: true, label: 'Sat PM' },
    { on: '@ Session: ( ) Sat AM  ( ) Sat PM (x) Sun (late)', checked: false, label: 'Sun (late)' },
  ]);
});

test('a value that is only partly choices is written in, as typed', () => {
  for (const value of ['before ( ) A ( ) B', '( ) A ( )', '(y) A']) {
    const { body } = render(`@ Pick: ${value}\n`);
    assert.doesNotMatch(body, /field-choices/, value);
    assert.match(body, /class="field-value"/, value);
  }
});

test('[@ ] in a sentence is a blank there, knowing where it is on its line', () => {
  const line = 'I am from a [@ an item from childhood] and [@ a product: Tang].';
  const { body } = render(`# Me\n\n${line}\n`);
  const text = 'data-text="I am from a [@ an item from childhood] and [@ a product: Tang]."';
  assert.match(body, new RegExp(`<p>I am from a <span class="field field-inline" data-line="2" ${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} data-head="\\[@ an item from childhood" data-start="12" data-end="38"><span class="field-value" data-value="" tabindex="0" role="textbox" aria-label="an item from childhood"></span><span class="field-label">an item from childhood</span></span> and `));
  assert.match(body, /data-head="\[@ a product" data-start="43" data-end="62"><span class="field-value" data-value="Tang" tabindex="0" role="textbox" aria-label="a product">Tang<\/span><span class="field-label">a product<\/span><\/span>\.<\/p>/);
});

test('[@ ] lines keep their breaks, and a link, code, an escape or an @ line are left as they are', () => {
  const { body } = render('A [@ one]\nB [@ two]\n\n[@ text](x) `[@ code]` \\[@ kept]\n\n@ Name: [@ x]\n');
  assert.match(body, /<p>A <span class="field field-inline"[^]*?<\/span><\/span>\nB <span class="field field-inline"/);
  assert.match(body, /<a href="x">@ text<\/a> <code>\[@ code\]<\/code> \[@ kept\]/);
  assert.match(body, /<span class="field" data-line="5" [^>]*><span class="field-label">Name<\/span><span class="field-value" data-value="\[@ x\]"/);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('@ A: b\n').css, /\.field \{/);
});

test('a > in a field stays out of the tags it is written into', () => {
  const { body } = render('@ N"><svg>: v\n\nA [@ x"><b>: y].\n');
  for (const [tag] of body.matchAll(/<span [^>]*>/g)) assert.doesNotMatch(tag.slice(1, -1), /[<>]/, tag);
  assert.match(body, /data-text="@ N&quot;&gt;&lt;svg&gt;: v"/);
});

test('a blank is reached by the keyboard and read as a box named by its label, but not on an exported page', () => {
  const md = '@ Name: Josh\n\nI am [@ age].\n';
  const { body } = render(md);
  assert.match(body, /<span class="field-value" data-value="Josh" tabindex="0" role="textbox" aria-label="Name">/);
  assert.match(body, /<span class="field-value" data-value="" tabindex="0" role="textbox" aria-label="age">/);
  assert.doesNotMatch(render(md, { exported: true }).body, /tabindex|role="textbox"/);
});

test('on a slide or an exported page, no field is a box: it reads as its label and its value, or says it\'s blank', () => {
  const md = '@ Name: Josh\n@ Thoughts:\n\nI am [@ age] and [@ a place: home].\n\n@ Session: ( ) Sat AM (x) Sat PM\n';
  const deck = `# One\n\n${md}\n---\n\n# Two\n`;
  for (const [where, body] of [['a slide', slides(deck).slides[0].body], ['an exported page', render(md, { exported: true }).body]]) {
    assert.doesNotMatch(body, /class="field-value"[^>]*(tabindex|role=)/, `on ${where}`);
    assert.match(body, /<span class="field-label">Name<\/span><span class="field-value" data-value="Josh">Josh<\/span><\/span>/, `on ${where}`);
    assert.match(body, /<span class="field-label">Thoughts<\/span><span class="field-value" data-value=""><\/span><span class="field-blank vh">blank<\/span><\/span>/, `on ${where}`);
    assert.match(body, /<span class="field-value" data-value=""><\/span><span class="field-label">age<\/span><span class="field-blank vh">blank<\/span>/, `on ${where}`);
    assert.match(body, /<span class="field-value" data-value="home">home<\/span><span class="field-label">a place<\/span>/, `on ${where}`);
    assert.equal(body.match(/field-blank/g).length, 2, `on ${where}, only the empty ones say so`);
    // A field of choices keeps its buttons, showing the one picked.
    assert.equal(body.match(/<input type="radio" class="choice-box"/g).length, 2, `on ${where}`);
    assert.match(body, /<input type="radio" class="choice-box" name="field-\d+" data-on="[^"]*" checked(?: disabled)?> Sat PM/, `on ${where}`);
  }
  // On a slide they can't be changed; on an exported page they can be
  // clicked, though nothing is saved.
  assert.equal(slides(deck).slides[0].body.match(/class="choice-box"[^>]* disabled>/g).length, 2);
  assert.doesNotMatch(render(md, { exported: true }).body, /disabled/);
  assert.doesNotMatch(render(md).body, /disabled/);
  assert.doesNotMatch(render(md).body, /field-blank/, 'in the editor, a blank is a box to fill in');
});

test('a label\'s hint, in braces at its end, is said and shown in the blank, not part of its name', () => {
  const { body } = render('@ Hours of sleep {e.g. 7.5}:\n@ Book { What would you argue about? }::: no\n@ Time {e.g. 10:30}: 9:15\n');
  assert.match(body, /data-head="@ Hours of sleep \{e.g. 7.5\}:"><span class="field-label">Hours of sleep<\/span><span class="field-value" data-value="" tabindex="0" role="textbox" aria-label="Hours of sleep" data-hint="e.g. 7.5" aria-placeholder="e.g. 7.5"><\/span><\/span>/);
  assert.match(body, /data-head="@ Book \{ What would you argue about\? \}:::" data-lines="3" style="--lines: 3"><span class="field-label">Book<\/span><span class="field-value" data-value="no"[^>]* data-hint="What would you argue about\?"/);
  // A colon in a hint doesn't end the label.
  assert.match(body, /data-head="@ Time \{e.g. 10:30\}:"><span class="field-label">Time<\/span><span class="field-value" data-value="9:15"[^>]* data-hint="e.g. 10:30"/);
});

test('braces that are escaped, empty, the whole label or not at its end are the label\'s own', () => {
  const { body } = render('@ Set \\{a, b\\}:\n@ Empty {}:\n@ {only}:\n@ Mid {x} label:\n@ Odd { : no\n@ Half {a\\}:\n');
  const labels = [...body.matchAll(/<span class="field-label">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Set {a, b}', 'Empty {}', '{only}', 'Mid {x} label', 'Odd {', 'Half {a}']);
  assert.doesNotMatch(body, /data-hint/);
  assert.match(body, /data-head="@ Set \\\{a, b\\\}:"/);
});

test('a hinted field of choices is named by its label alone', () => {
  const { body } = render('@ Session {pick one}: ( ) A (x) B\n');
  assert.match(body, /data-head="@ Session \{pick one\}:" data-choices[^>]*><span class="field-label" id="field-0">Session<\/span>/);
});

test('on a slide or an exported page, an empty field still shows its hint, and says it after "blank"', () => {
  const md = '@ Hours {e.g. 7.5}:\n@ Name {first}: Josh\n';
  const deck = `# One\n\n${md}\n---\n\n# Two\n`;
  for (const [where, body] of [['a slide', slides(deck).slides[0].body], ['an exported page', render(md, { exported: true }).body]]) {
    assert.match(body, /<span class="field-value" data-value="" data-hint="e.g. 7.5"><\/span><span class="field-blank vh">blank, e.g. 7.5<\/span>/, `on ${where}`);
    assert.match(body, /<span class="field-value" data-value="Josh" data-hint="first">Josh<\/span><\/span>/, `on ${where}`);
    assert.doesNotMatch(body, /aria-placeholder/, `on ${where}, it isn't a box`);
  }
});

test('the stylesheet shows a hint only in an empty blank, and keeps it from being said twice', () => {
  const { css } = render('@ A {b}:\n');
  assert.match(css, /\.field-value\[data-hint\]:empty::before \{[^}]*content: attr\(data-hint\) \/ "";/);
});

test("in the system's own colours, a block field keeps its lines, and a date in one its line, in the text's colour", () => {
  const { css } = render('@ A:::\n');
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.match(forced, /\.field:not\(\.field-inline\) > :is\(\.field-value, \.field-held\) \{ forced-color-adjust: none; --gm-field-rule: CanvasText; \}/);
  assert.match(forced, /\.field:not\(\.field-inline\) > \.field-value:has\(> textarea\) \{ --gm-field-rule: Highlight; \}/);
});

test('a field indented under a list item is a field in that item, and keeps its indent when written', () => {
  const { body } = render('- ( ) **High energy**\n  @ Closest word: ( ) Angry ( ) Anxious\n- [ ] Read\n\n  @ What did you read?:\n');
  const items = body.split('<li').slice(1);
  assert.match(items[0], /<span class="field" data-line="1" data-text=" {2}@ Closest word: \( \) Angry \( \) Anxious" data-head=" {2}@ Closest word:" data-choices/);
  assert.match(items[0], /data-on=" {2}@ Closest word: \(x\) Angry \( \) Anxious"/);
  assert.match(items[1], /<span class="field" data-line="4" data-text=" {2}@ What did you read\?:" data-head=" {2}@ What did you read\?:"><span class="field-label field-label-stop">What did you read\?<\/span>/);
});

test('an indented field that isn\'t under a list item\'s text, or is in an indented code block, is left as typed', () => {
  const { body } = render('- item\n\n        @ Code: x\n\nPara\n  @ Lazy: x\n');
  assert.doesNotMatch(body, /class="field"/);
  assert.match(body, /<pre><code> {2}@ Code: x\n<\/code><\/pre>/);
  assert.match(body, /@ Lazy: x/);
});

test('a label that ends in its own stop, as a question does, is marked so it takes no colon', () => {
  const { body } = render('@ Anything else you learned today?:\n@ Name:\n');
  assert.match(body, /<span class="field-label field-label-stop">Anything else you learned today\?<\/span>/);
  assert.match(body, /<span class="field-label">Name<\/span>/);
});

test('a field whose value is a date is the date, drawn by the date feature, the field round it, a group named by its label', () => {
  const { body } = render('@ When: date:[]\n@ Due {a Friday}: date:2026-11-10[]\n');
  assert.match(body, /<span class="field" data-line="0" data-text="@ When: date:\[\]" data-head="@ When:" data-kind="date" role="group" aria-labelledby="field-0"><span class="field-label" id="field-0">When<\/span><span class="field-held"><span class="date date-blank" data-line="0" data-col="8" data-text="@ When: date:\[\]" tabindex="0" role="button" aria-haspopup="dialog">pick a date<\/span><\/span><\/span>/);
  assert.match(body, /data-kind="date" role="group" aria-labelledby="field-1"><span class="field-label" id="field-1">Due<\/span><span class="field-held"><time class="date" datetime="2026-11-10" data-line="1" data-col="18" [^>]*>November 10, 2026<\/time><\/span><\/span>/);
  assert.doesNotMatch(body, /class="field-value"|[\uE000-\uF8FF]/);
});

test('a field whose value is a date that is not one keeps it as typed', () => {
  const { body } = render('@ When: date:2026-02-30[]\n');
  assert.match(body, /<span class="field-held">date:2026-02-30\[\]<\/span>/);
});

test('a date field on a slide reads as its date, or as a blank', () => {
  const { body } = slides('# One\n\n@ When: date:[]\n@ Due: date:2026-11-10[]\n\n---\n\n# Two\n').slides[0];
  assert.match(body, /data-head="@ When:"><span class="field-label">When<\/span><span class="field-value" data-value=""><\/span><span class="field-blank vh">blank<\/span><\/span>/);
  assert.match(body, /<span class="field-held"><time class="date" datetime="2026-11-10"[^>]*>November 10, 2026<\/time><\/span>/);
  assert.doesNotMatch(body, /pick a date|tabindex/);
});

test('a date field in an indented code block is shown as written', () => {
  const { body } = render('- item\n\n        @ When: date:[]\n');
  assert.doesNotMatch(body, /[\uE000-\uF8FF]/);
});

test('a field whose value is number: holds a number, shown without its kind', () => {
  const { body } = render('@ Age {e.g. 12}: number:[]\n@ Age: number:12[]\n@ Score: number:-2.5[two and a half below]\n');
  assert.match(body, /data-head="@ Age \{e.g. 12\}:" data-kind="number"><span class="field-label">Age<\/span><span class="field-value" data-value="" [^>]*data-hint="e.g. 12"[^>]*><\/span>/);
  assert.match(body, /data-text="@ Age: number:12\[\]" data-head="@ Age:" data-kind="number"><span class="field-label">Age<\/span><span class="field-value" data-value="12"[^>]*>12<\/span>/);
  assert.match(body, /data-kind="number"><span class="field-label">Score<\/span><span class="field-value" data-value="-2.5"[^>]*>two and a half below<\/span>/);
});

test('a field whose number: is not a number keeps it as typed', () => {
  const { body } = render('@ Age: number:twelve[]\n');
  assert.doesNotMatch(body, /data-kind/);
  assert.match(body, /<span class="field-value" data-value="number:twelve\[\]"[^>]*>number:twelve\[\]<\/span>/);
});

test('a number field on a slide reads as its number, or as a blank', () => {
  const { body } = slides('# One\n\n@ Age {e.g. 12}: number:[]\n@ Age: number:12[]\n\n---\n\n# Two\n').slides[0];
  assert.match(body, /<span class="field-value" data-value="" data-hint="e.g. 12"><\/span><span class="field-blank vh">blank, e.g. 12<\/span>/);
  assert.match(body, /<span class="field-value" data-value="12">12<\/span>/);
});
