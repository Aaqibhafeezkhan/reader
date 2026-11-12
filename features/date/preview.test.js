import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { preview, settle } from '../../test/dom.js';

/** What the calendar's Today writes, at `hour` on 4 March 2026, the day starting `dayStarts` minutes after midnight. */
async function today({ hour, dayStarts }) {
  const p = preview();
  p.window.Date = class extends Date {
    constructor(...at) { super(...(at.length ? at : [2026, 2, 4, hour])); }
  };
  p.show(render('When: date:[]\n').body, { working: true, dayStarts });
  await settle();
  p.document.querySelector('.date').click();
  p.document.querySelector('.date-cal-today').click();
  await settle();
  const [edit] = p.posted.filter((m) => m.type === 'edit').flatMap((m) => m.edits);
  return edit?.after[0];
}

test('the calendar\'s Today goes by the day reader says it is, which starts at --day-starts (gh-269)', async () => {
  // 1am on the 4th, the day starting at 4am: it's still the 3rd.
  assert.equal(await today({ hour: 1, dayStarts: 240 }), 'When: date:2026-03-03[]');
  assert.equal(await today({ hour: 4, dayStarts: 240 }), 'When: date:2026-03-04[]');
  // With no --day-starts, the day starts at midnight.
  assert.equal(await today({ hour: 1 }), 'When: date:2026-03-04[]');
});
