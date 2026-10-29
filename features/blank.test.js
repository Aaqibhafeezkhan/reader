import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workable, typable, hinted, unfilled, shut, closed } from './blank.js';

test('a page can be worked in the editor, but not on a slide or once exported', () => {
  assert.equal(workable({}), true);
  assert.equal(workable({ deck: true }), false);
  assert.equal(workable({ exported: true }), false);
});

test('nor once it\'s a record, past the time it was open until', () => {
  assert.equal(closed({}), false);
  assert.equal(closed({ closed: true }), true);
  assert.equal(workable({ closed: true }), false);
  assert.equal(typable('Name', { closed: true }), '');
});

test('a blank is a box named by its label only where the page can be worked', () => {
  assert.equal(typable('a "place"', {}), ' tabindex="0" role="textbox" aria-label="a &quot;place&quot;"');
  assert.equal(typable('Name', { deck: true }), '');
  assert.equal(typable('Name', { exported: true }), '');
});

test('a box or a choice is shut on a slide, but kept as it is in the editor and on an exported page', () => {
  assert.equal(shut({}), '');
  assert.equal(shut({ deck: true }), ' disabled');
  assert.equal(shut({ exported: true }), '');
});

test('a record\'s boxes are shut, exported or not', () => {
  assert.equal(shut({ closed: true }), ' disabled');
  assert.equal(shut({ closed: true, exported: true }), ' disabled');
});

test('an empty blank says it\'s blank only where it can\'t be filled in', () => {
  assert.equal(unfilled('', {}), '');
  assert.equal(unfilled('', { exported: true }), '<span class="field-blank">blank</span>');
  assert.equal(unfilled('', { deck: true }), '<span class="field-blank">blank</span>');
  assert.equal(unfilled('Josh', { exported: true }), '');
});

test('a hint is a box\'s placeholder where it can be typed in, and only shown where it can\'t', () => {
  assert.equal(hinted('', {}), '');
  assert.equal(hinted('e.g. "7.5"', {}), ' data-hint="e.g. &quot;7.5&quot;" aria-placeholder="e.g. &quot;7.5&quot;"');
  assert.equal(hinted('e.g. 7.5', { deck: true }), ' data-hint="e.g. 7.5"');
  assert.equal(hinted('e.g. 7.5', { exported: true }), ' data-hint="e.g. 7.5"');
});

test('an empty blank that can\'t be filled in says its hint after it\'s blank', () => {
  assert.equal(unfilled('', { deck: true }, 'e.g. <7>'), '<span class="field-blank">blank, e.g. &lt;7&gt;</span>');
  assert.equal(unfilled('', {}, 'e.g. 7'), '');
  assert.equal(unfilled('8', { deck: true }, 'e.g. 7'), '');
});

test('a record\'s empty blank has no hint, and is only said to be blank', () => {
  assert.equal(hinted('e.g. 7.5', { closed: true }), '');
  assert.equal(hinted('e.g. 7.5', { closed: true, exported: true }), '');
  assert.equal(unfilled('', { closed: true }, 'e.g. 7.5'), '<span class="field-blank">blank</span>');
  assert.equal(unfilled('8', { closed: true }, 'e.g. 7.5'), '');
});
