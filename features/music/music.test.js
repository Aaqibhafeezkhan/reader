import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { tuneName, barsOf } from './index.js';

const TWINKLE = 'X:1\nT:Twinkle, Twinkle\nM:4/4\nL:1/4\nK:C\nC C G G | A A G2 | F F E E | D D C2 |]';

test('a music fence is wrapped, its ABC still inside as code, and named for a screen reader by its title, key, time and bars', () => {
  const { body } = render(`\`\`\`music\n${TWINKLE}\n\`\`\`\n`);
  assert.match(body, /<div class="music" data-name="Twinkle, Twinkle: C major, 4\/4, 4 bars"><pre><code class="language-music">X:1\nT:Twinkle, Twinkle/);
  assert.doesNotMatch(body, /music-staff|music-play/, 'nothing drawn, nor a button, until the frame draws it');
});

test('a tune is named by what its header says, as it\'s said', () => {
  assert.equal(tuneName('K:Am\nM:6/8\n|: ABc def :|\n|: g2 a :| b'), 'Tune: A minor, 6/8, 3 bars');
  assert.equal(tuneName('T:Reel\nK:F#dor\nM:C|\nAB|'), 'Reel: F sharp Dorian, cut time, 1 bar');
  assert.equal(tuneName('T:Air\nM:C\nK:Bb\n"Bb"B2 !p!c2 | d4 % a comment | not bars\n'), 'Air: B flat major, common time, 2 bars');
  assert.equal(tuneName('T:Only a title'), 'Only a title');
});

test('bars are counted by their bar lines, but one that opens a line, and notes after the last are a bar', () => {
  assert.equal(barsOf('K:C\n|: AB | cd :|'), 2);
  assert.equal(barsOf('K:C\nAB | cd'), 2);
  assert.equal(barsOf('K:C\nAB || cd |]\nef |'), 3);
  // Voices play together, so a treble and a bass staff count once.
  assert.equal(barsOf('V:RH clef=treble\nV:LH clef=bass\nK:C\n[V:RH] AB | cd |]\n[V:LH] A,B, | C,D, |]'), 2);
  assert.equal(barsOf('K:C\nV:1\nAB | cd |\nV:2\nA,B, | C,D, |\nV:1\nef |]\nV:2\nE,F, |]'), 3);
});

test('an export shows the staff the frame drew, named, with no button, and its ABC out of sight', () => {
  const svg = '<svg viewBox="0 0 770 95"></svg>';
  const { body } = render(`\`\`\`music\n${TWINKLE}\n\`\`\`\n`, { drawn: { music: { [TWINKLE]: svg } }, for: 'export' });
  assert.match(body, /<div class="music drawn" data-name="[^"]+"><pre>[\s\S]*<\/pre><div class="music-staff" role="img" aria-label="Twinkle, Twinkle: C major, 4\/4, 4 bars"><svg viewBox="0 0 770 95"><\/svg><\/div><\/div>/);
  assert.doesNotMatch(body, /music-play/);
  // Only what was drawn for that text.
  assert.doesNotMatch(render('```music\nK:C\nAB\n```\n', { drawn: { music: { [TWINKLE]: svg } } }).body, /music-staff/);
});
