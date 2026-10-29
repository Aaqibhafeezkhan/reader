import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';
import { preview, settle } from '../../test/dom.js';
import { note } from './index.js';

const para = (src, env) => render(src, env).body.match(/<p>([\s\S]*?)<\/p>/)[1];

test('a note is named in scientific pitch, A4 at 440 Hz', () => {
  assert.deepEqual(note('A4'), { name: 'A4', spoken: 'A4', hz: 440 });
  assert.deepEqual(note('C4'), { name: 'C4', spoken: 'C4', hz: 261.626 });
  assert.deepEqual(note('F#3'), { name: 'F♯3', spoken: 'F sharp 3', hz: 184.997 });
  assert.deepEqual(note('Bb4'), { name: 'B♭4', spoken: 'B flat 4', hz: 466.164 });
  assert.equal(note('B♭4').hz, note('A#4').hz);
  assert.equal(note('c5').hz, 523.251);
  assert.equal(note('A0').hz, 27.5);
  for (const not of ['H9', 'C', '4', 'C#b4', 'C10', 'Cx4', '']) assert.equal(note(not), null, not);
});

test('pitch:[C4] is a button that names the note and says what it plays', () => {
  assert.equal(para('Start around pitch:[C4].'),
    'Start around <button type="button" class="pitch" data-hz="261.626" aria-label="Play C4">C4</button>.');
  assert.equal(para('pitch:[F#3]'), '<button type="button" class="pitch" data-hz="184.997" aria-label="Play F sharp 3">F♯3</button>');
});

test('words in the brackets after a note show instead, and are in its name', () => {
  assert.equal(para('pitch:C4[middle C]'),
    '<button type="button" class="pitch" data-hz="261.626" aria-label="Play middle C (C4)">middle C</button>');
  assert.equal(para('pitch:Bb4[]'), '<button type="button" class="pitch" data-hz="466.164" aria-label="Play B flat 4">B♭4</button>');
  assert.equal(para('pitch:C4[<b>]'), '<button type="button" class="pitch" data-hz="261.626" aria-label="Play &lt;b&gt; (C4)">&lt;b&gt;</button>');
});

test('what isn\'t a note stays as typed, as does one in code or escaped', () => {
  for (const src of ['pitch:[H9]', 'pitch:[]', 'pitch:[C 4]', 'xpitch:[C4]', '\\pitch:[C4]', 'pitch:H9[x]', '`pitch:[C4]`']) {
    assert.doesNotMatch(render(src).body, /class="pitch"/, src);
  }
  assert.doesNotMatch(render('```\npitch:[C4]\n```\n').body, /class="pitch"/);
});

test('a task\'s box is named with the note in it', () => {
  assert.match(render('- [ ] Sing pitch:[C4] then pitch:G3[lower]\n').body, /aria-label="Sing C4 then lower"/);
});

test('it\'s a button on a slide and in a record, where nothing can be worked, but only named on an exported page', () => {
  const button = /<button type="button" class="pitch" data-hz="440" aria-label="Play A4">A4<\/button>/;
  assert.match(slides('# Warmup\n\npitch:[A4]\n').slides[0].body, button);
  const record = '---\nopen-until: 2026-10-28 04:00\n---\n\n- [ ] Sing pitch:[A4]\n';
  const closed = render(record, { now: new Date(2026, 9, 29).getTime() }).body;
  assert.match(closed, / disabled/, 'the record is shut');
  assert.match(closed, button);
  assert.equal(para('pitch:[A4] and pitch:C4[middle C]', { exported: true }), '<span class="pitch">A4</span> and <span class="pitch">middle C</span>');
});

// Web Audio as far as a tone needs it, keeping what's played.
function audio(window) {
  const played = [];
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  window.AudioContext = class {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const wave = { frequency: { ...param(), setValueAtTime: (hz) => { wave.hz = hz; } }, connect() {}, disconnect() {} };
      wave.start = () => played.push(wave);
      wave.stop = () => {};
      return wave;
    }
  };
  return played;
}

test('in the preview, pressing a note plays it, and it says so till it has faded', async () => {
  const p = preview();
  const played = audio(p.window);
  p.show(render('pitch:[A4] pitch:[C4]').body);
  const [a4] = p.document.querySelectorAll('button.pitch');
  a4.click();
  assert.deepEqual(played.map((w) => w.hz), [440]);
  assert.equal(played[0].type, 'sine');
  assert.ok(a4.classList.contains('pitch-playing'));
  a4.click();
  played[0].onended();
  await settle();
  assert.ok(a4.classList.contains('pitch-playing'), 'still sounding, pressed again');
  played[1].onended();
  await settle();
  assert.equal(a4.classList.contains('pitch-playing'), false);
  assert.deepEqual(p.posted.filter((m) => m.type === 'edit'), [], 'playing changes nothing in the file');
});

test('on a slide, pressing a note plays it, and neither the click nor Enter moves the deck', () => {
  const p = preview();
  const played = audio(p.window);
  p.show(slides('# Warmup\n\npitch:[G3]\n\n---\n\n# Next\n').slides[0].body, { deck: true });
  const g3 = p.document.querySelector('button.pitch');
  g3.click();
  g3.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.deepEqual(played.map((w) => w.hz), [195.998]);
  assert.deepEqual(p.posted.filter((m) => m.type === 'click' || m.type === 'key'), []);
});

test('with no Web Audio, pressing a note does nothing, and says nothing is sounding', async () => {
  const p = preview();
  p.window.AudioContext = undefined;
  p.show(render('pitch:[A4]').body);
  const a4 = p.document.querySelector('button.pitch');
  a4.click();
  await settle();
  assert.equal(a4.classList.contains('pitch-playing'), false);
});
