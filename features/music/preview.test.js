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
      },
    },
    TimingCallbacks: class {
      constructor(tune, o) { callback = o.eventCallback; }
      start() {}
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

test('a tune is drawn on a staff named for it, as wide as the text, its ABC out of sight, with Play above it', async () => {
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
  assert.equal(play.nextElementSibling.getAttribute('role'), 'status');
  assert.equal(play.closest('.music-bar').nextElementSibling, p.$('.music-staff'), 'above the staff');
  assert.deepEqual([play.textContent, play.getAttribute('aria-pressed'), play.getAttribute('aria-label')], ['Play', 'false', 'Play Twinkle: C major, 4/4, 2 bars']);
  assert.deepEqual(Object.keys(p.window.Preview.drawn().music), [TWINKLE], 'what it drew, for an export');
});

test('Play plays it from reader\'s own notes, marking each as it sounds, and pressed again stops', async () => {
  const p = frame();
  p.show(render(`\`\`\`music\n${TWINKLE}\n\`\`\`\n`).body);
  await p.settled();
  const play = p.$('.music-play');
  play.click();
  await p.settled();
  assert.deepEqual(p.said.slice(-4), ['audio context', ['init', 'http://frames.localhost:8734/soundfont/'], 'prime', 'start']);
  assert.deepEqual([play.textContent, play.getAttribute('aria-pressed')], ['Stop', 'true']);
  p.beat(0);
  assert.equal(p.document.querySelectorAll('.music-now').length, 1);
  play.click();
  assert.deepEqual([play.textContent, play.getAttribute('aria-pressed')], ['Play', 'false']);
  assert.equal(p.document.querySelectorAll('.music-now').length, 0);
  assert.ok(p.said.includes('stop'));
  // Played to its end, it's done of itself.
  play.click();
  await p.settled();
  p.beat(null);
  assert.equal(play.textContent, 'Play');
});

test('offline, a tune whose notes aren\'t kept says it needs the network', async () => {
  const p = frame({ offline: true });
  p.show(render(`\`\`\`music\n${TWINKLE}\n\`\`\`\n`).body);
  await p.settled();
  p.$('.music-play').click();
  await p.settled();
  assert.equal(p.$('.music-said').textContent, 'It needs the network the first time its notes are played.');
  assert.equal(p.$('.music-play').textContent, 'Play');
});

test('ABC with something wrong shows its text, what\'s wrong once each, and what could be drawn, faded', async () => {
  const p = frame();
  p.show(render('```music\nK:C\nthis isn\'t [[[\n```\n').body);
  await p.settled();
  const host = p.$('.music');
  assert.deepEqual([host.classList.contains('drawn'), host.classList.contains('warned')], [false, true]);
  assert.equal(p.$('.music-error').textContent, 'Music Line:2:2: Unknown character ignored');
});
