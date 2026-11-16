/**
 * A bar that counts what's to be done in its section counts it again when
 * a box says it's done or isn't (`preview:done`), or a question is
 * answered (a choice picked, `change` or `preview:answered`), by the lines
 * it counted when it was drawn (`data-lines`, `data-questions`): the bar fills, and its count
 * says so, before the page is drawn again from the file. Once a turn, after
 * what changed has said so. Runs in the preview frame.
 */
(() => {
  const linesOf = (s) => (s ?? '').split(' ').filter(Boolean);
  const boxDone = (n) => document.querySelector(`[data-done][data-line="${n}"]`)?.dataset.done === 'true';
  // A list of choices says its line as the preview's blocks do (render.js's `lines`).
  const answered = (n) => document.querySelector(`[data-answered][data-line="${n}"]`)?.dataset.answered === 'true';
  const count = () => {
    for (const bar of document.querySelectorAll('.progress[data-lines]')) {
      const boxes = linesOf(bar.dataset.lines);
      const questions = linesOf(bar.dataset.questions);
      const done = boxes.filter(boxDone).length + questions.filter(answered).length;
      const of = boxes.length + questions.length;
      const meter = bar.querySelector('progress');
      meter.value = Math.min(done, meter.max);
      bar.querySelector('.progress-count').textContent = `${done} of ${of}`;
    }
  };
  let counting = false;
  const recount = () => {
    if (counting || !document.querySelector('.progress[data-lines]')) return;
    counting = true;
    queueMicrotask(() => {
      count();
      counting = false;
    });
  };
  for (const type of ['preview:done', 'change', 'preview:answered']) document.addEventListener(type, recount);
})();
