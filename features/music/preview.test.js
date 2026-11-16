import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preview } from '../../test/dom.js';
import { render } from '../../src/render.js';

const TWINKLE = 'X:1\nT:Twinkle\nM:4/4\nL:1/4\nK:C\nC C G G | A A G2 |]';

/**
 * The preview frame, with an abcjs that draws a staff of one note, and
 * plays by calling back each note: `said` is what it was asked, and
 * `beat(n)` sounds note n, or the end with none.
 */
function frame({ offline = false } = {}) {
  const p = preview();
  const said = [];
  let callback = null;
  p.window.AudioContext = class { constructor() { said.push('audio context'); } };
  p.window.ABCJS = {
    renderAbc: (el, text, options) => {
      said.push(['draw', text, options]);
      if (/\[\[\[/.test(text)) {
        el.innerHTML = '<svg><path class="abcjs-note"></path></svg>';
        return [{ lines: [1], warnings: ['Music Line:2:2: Unknown character <span>ignored</span>', 'Music Line:2:2: Unknown character <span>ignored</span>'] }];
      }
      el.innerHTML = '<svg><path class="abcjs-note"></path></svg>';
      return [{ lines: [1], warnings: [] }];
    },
    synth: {
      supportsAudio: () => true,
      CreateSynth: class {
        async init(o) { said.push(['init', o.options.soundFontUrl]); }
        async prime() { if (offline) throw new Error('404'); said.push('prime'); }
        start() { said.push('start'); }
        stop() { said.push('stop'); }
        pause() { said.push('pause'); }
        resume() { said.push('resume'); }
      },
    },
    TimingCallbacks: class {
      constructor(tune, o) { callback = o.eventCallback; }
      start(at) { said.push(['timer start', at]); }
      pause() { said.push('timer pause'); }
      stop() { said.push('timer stop'); }
    },
  };
  const settled = async () => {
    for (let i = 0; i < 10; i++) {
      await new Promise(setImmediate);
      await Promise.all(p.window.Preview.pending());
    }
  };
  const $ = (sel) => p.document.querySelector(sel);
  const beat = (n) => callback(n == null ? null : { elements: [[p.document.querySelectorAll('.abcjs-note')[n]]] });
  return { ...p, said, settled, $, beat };
}

test('a tune is drawn on a staff named for it, as wide as the text, its ABC out of sight, with Play in its lower right', async () => {
  const p = frame();
  p.show(render(`\`\`\`music\n${TWINKLE}\n\`\`\`\n`).body);
  await p.settled();
  const [, text, options] = p.said.find((s) => s[0] === 'draw');
  assert.equal(text, TWINKLE);
  assert.equal(options.responsive, 'resize');
  const host = p.$('.music');
  assert.ok(host.classList.contains('drawn'));
  assert.equal(p.$('.music-staff').getAttribute('role'), 'img');
  assert.equal(p.$('.music-staff').getAttribute('aria-label'), 'Twinkle: C major, 4/4, 2 bars');
  const play = p.$('.music-play');
  const bar = play.closest('.music-bar');
  assert.equal(bar.previousElementSibling, p.$('.music-staff'), 'under the staff');
  assert.deepEqual([...bar.children].map((c) => c.className), ['music-said', 'music-start', 'music-play'], 'what it says, then its buttons, last on the right');
  assert.equal(p.$('.music-said').getAttribute('role'), 'status');
  assert.deepEqual([play.getAttribute('aria-label'), play.title, play.textContent], ['Play Twinkle: C major, 4/4, 2 bars', 'Play', ''], 'an icon, named');
  assert.ok(play.querySelector('svg'));
  assert.ok(p.$('.music-start').hidden, 'nothing to go back to the start of yet');
  assert.deepEqual(Object.keys(p.window.Preview.drawn().music), [TWINKLE], 'what it drew, for an export');
});

test('Play plays it from reader\'s own notes, marking each as it sounds, and turns to Pause', async () => {
  const p = frame();
  p.show(render(`\`\`\`music\n${TWINKLE}\n\`\`\`\n`).body);
  await p.settled();
  const play = p.$('.music-play');
  const start = p.$('.music-start');
  play.click();
  await p.settled();
  assert.deepEqual(p.said.slice(-5), ['audio context', ['init', 'http://frames.localhost:8734/soundfont/'], 'prime', 'start', ['timer start', undefined]]);
  assert.equal(play.title, 'Pause');
  assert.equal(play.getAttribute('aria-label'), 'Pause Twinkle: C major, 4/4, 2 bars');
  assert.equal(start.hidden, false, 'begun, it can go back to the start');
  p.beat(0);
  assert.equal(p.document.querySelectorAll('.music-now').length, 1);
  // Paused, it stays where it was, marked; Play carries on from there.
  play.click();
  assert.deepEqual(p.said.slice(-2), ['pause', 'timer pause']);
  assert.equal(play.title, 'Play');
  assert.equal(p.document.querySelectorAll('.music-now').length, 1);
  play.click();
  assert.deepEqual(p.said.slice(-2), ['resume', ['timer start', undefined]]);
  assert.equal(play.title, 'Pause');
  // Played to its end, it's as it was before it was played.
  p.beat(null);
  assert.equal(play.title, 'Play');
  assert.ok(start.hidden);
  assert.equal(p.document.querySelectorAll('.music-now').length, 0);
});

test('Back to the start: playing, it plays on from there; paused, it waits there until Play', async () => {
  const p = frame();
  p.show(render(`\`\`\`music\n${TWINKLE}\n\`\`\`\n`).body);
  await p.settled();
  const play = p.$('.music-play');
  const start = p.$('.music-start');
  play.click();
  await p.settled();
  p.beat(0);
  start.click();
  assert.deepEqual(p.said.slice(-4), ['stop', 'timer stop', 'start', ['timer start', 0]]);
  assert.equal(play.title, 'Pause', 'still playing');
  assert.equal(p.document.querySelectorAll('.music-now').length, 0);
  play.click();
  start.click();
  assert.deepEqual(p.said.slice(-2), ['stop', 'timer stop']);
  assert.equal(play.title, 'Play', 'still paused');
  assert.equal(start.hidden, false);
  play.click();
  assert.deepEqual(p.said.slice(-2), ['resume', ['timer start', 0]], 'from the start');
});

test('another tune played stops the one before, back to as it was', async () => {
  const p = frame();
  p.show(render(`\`\`\`music\n${TWINKLE}\n\`\`\`\n\n\`\`\`music\n${TWINKLE.replace('Twinkle', 'Other')}\n\`\`\`\n`).body);
  await p.settled();
  const [first, second] = p.document.querySelectorAll('.music-play');
  first.click();
  await p.settled();
  second.click();
  await p.settled();
  assert.deepEqual([first.title, second.title], ['Play', 'Pause']);
  assert.deepEqual([...p.document.querySelectorAll('.music-start')].map((b) => b.hidden), [true, false]);
});

test('offline, a tune whose notes aren\'t kept says it needs the network', async () => {
  const p = frame({ offline: true });
  p.show(render(`\`\`\`music\n${TWINKLE}\n\`\`\`\n`).body);
  await p.settled();
  p.$('.music-play').click();
  await p.settled();
  assert.equal(p.$('.music-said').textContent, 'It needs the network the first time its notes are played.');
  assert.equal(p.$('.music-play').title, 'Play');
});

test('ABC with something wrong shows its text, what\'s wrong once each, and what could be drawn, faded', async () => {
  const p = frame();
  p.show(render('```music\nK:C\nthis isn\'t [[[\n```\n').body);
  await p.settled();
  const host = p.$('.music');
  assert.deepEqual([host.classList.contains('drawn'), host.classList.contains('warned')], [false, true]);
  assert.equal(p.$('.music-error').textContent, 'Music Line:2:2: Unknown character ignored');
});
