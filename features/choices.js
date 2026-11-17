/**
 * Choices to pick one of, in a row on a line: each a mark, `( )` or `(x)`,
 * and the words after it, up to the next.
 *
 *   @ Session: ( ) Sat AM (x) Sat PM ( ) Sun AM
 *   A: ( ) Yes ( ) [@ Something else]
 *
 * A field's value is read as choices (features/fields), and so is an
 * answer's line (features/qa): what reads them is here, so they're read
 * alike, and so is the line each choice writes, with it alone picked.
 */

/** A choice's mark, `( )` or `(x)`, what's in it the group. */
export const MARK = /\(([ xX])\)/g;

/**
 * The choices on `line` from `from` on, if that's all there is from there:
 * `[{ checked, start, end, label: { start, end } }]`, where each mark starts
 * and ends on the line and where its words do, trimmed. Null if anything
 * but space comes before the first mark, or a mark has no words after it.
 * A mark inside one of `skip` (`[{ start, end }]`: a blank's answer, a code
 * span) is part of it, not a mark.
 */
export function choicesIn(line, from = 0, skip = []) {
  const inside = (at) => skip.some((s) => at >= s.start && at < s.end);
  const marks = [];
  MARK.lastIndex = from;
  for (let m = MARK.exec(line); m; m = MARK.exec(line)) {
    if (!inside(m.index)) marks.push({ checked: m[1] !== ' ', start: m.index, end: m.index + m[0].length });
  }
  if (!marks.length || line.slice(from, marks[0].start).trim()) return null;
  const found = [];
  for (const [k, mark] of marks.entries()) {
    const to = marks[k + 1]?.start ?? line.length;
    const words = line.slice(mark.end, to);
    if (!words.trim()) return null;
    const start = mark.end + words.length - words.trimStart().length;
    found.push({ ...mark, label: { start, end: mark.end + words.trimEnd().length } });
  }
  return found;
}

/**
 * Whether `choices`, as choicesIn found them, are answered: one picked, and
 * any blank in its words (`blanks`, as blank.js's inlineBlanks finds them)
 * written in, as a choice whose words are still to be written isn't an
 * answer yet.
 */
export function answeredBy(choices, blanks = []) {
  const unwritten = (c) => blanks.some((b) => b.start >= c.label.start && b.end <= c.label.end && !b.value.trim());
  return choices.some((c) => c.checked && !unwritten(c));
}

/** `line` with only its `k`-th choice picked, of `choices` as choicesIn found them; with none, for no `k`. */
export function pickedAt(line, choices, k = -1) {
  // A mark written is as long as it was, so each is still where it was found.
  return choices.reduce((out, c, j) => out.slice(0, c.start) + (j === k ? '(x)' : '( )') + out.slice(c.end), line);
}
