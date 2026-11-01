import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preview } from '../../test/dom.js';
import { render } from '../../src/render.js';

/**
 * The preview frame, with a Mermaid that draws an empty <svg> named for
 * the theme it was set to: `drawings` counts what it drew.
 */
function frame() {
  const p = preview();
  let config = {};
  const counted = { drawings: 0 };
  p.window.mermaid = {
    initialize: (c) => { config = c; },
    render: async () => {
      counted.drawings++;
      return { svg: `<svg data-theme="${config.theme}" data-paper="${config.themeVariables?.background ?? ''}"></svg>` };
    },
  };
  const settled = async () => {
    for (let i = 0; i < 10; i++) {
      await new Promise(setImmediate);
      await Promise.all(p.window.Preview.pending());
    }
  };
  const drawnAs = () => p.document.querySelector('.mermaid-figure svg')?.dataset.theme;
  return { ...p, counted, settled, drawnAs };
}

const PAGE = render('```mermaid\nflowchart LR\n  a --> b\n```\n').body;

test('a diagram is drawn dark in the dark theme, and light in the light', async () => {
  const p = frame();
  p.show(PAGE, { dark: true });
  await p.settled();
  assert.equal(p.drawnAs(), 'dark');
  p.show(PAGE, { dark: false });
  await p.settled();
  assert.equal(p.drawnAs(), 'neutral');
  // each drawn once, and kept: back to dark draws nothing again
  p.show(PAGE, { dark: true });
  await p.settled();
  assert.equal(p.drawnAs(), 'dark');
  assert.equal(p.counted.drawings, 2);
});

test('a diagram on a dark background is drawn dark, and on a light one light, whatever the theme', async () => {
  const p = frame();
  p.show(`<div class="gm-bg" style="background-color: rgb(0, 0, 64)"></div>${PAGE}`, { dark: false });
  await p.settled();
  assert.equal(p.drawnAs(), 'dark');
  p.show(`<div class="gm-bg" style="background-color: rgb(250, 240, 220)"></div>${PAGE}`, { dark: true });
  await p.settled();
  assert.equal(p.drawnAs(), 'neutral');
});

test('what a frame not told the theme drew, for an export, is the light drawing', async () => {
  const p = frame();
  p.show(PAGE);
  await p.settled();
  assert.match(p.window.Preview.drawn().mermaid['flowchart LR\n  a --> b'], /data-theme="neutral"/);
});

test('a drawn diagram is an image named by its accTitle, or as a diagram, as an export names it', async () => {
  const p = frame();
  p.show(render('```mermaid\nflowchart LR\n  accTitle: How a "post" & <draft> is published\n  a --> b\n```\n\n```mermaid\ngraph TD\n```\n').body);
  await p.settled();
  const figures = [...p.document.querySelectorAll('.mermaid-figure')];
  assert.deepEqual(figures.map((f) => [f.getAttribute('role'), f.getAttribute('aria-label')]), [
    ['img', 'How a "post" & <draft> is published'],
    ['img', 'Diagram'],
  ]);
});
