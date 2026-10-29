---
title: Forms and checklists
---

← [Contents](index.md)

What's filled in on the page is written into the file, saved like typing,
and can be undone as typing can. All of it works in [Work](presenting.md)
too, where the file can't be typed into. On a slide being presented, none
of it does: boxes, choices, fields and dates show as they stand.

## Tasks

`- [ ] take out the trash` shows a checkbox, and `- [x]` a checked one.
Clicking a box rewrites the `[ ]` in the file, as an ordinary (undoable)
edit. `- ( )` and `- (x)` are radio buttons instead: only one in a list can
be chosen, and choosing one clears the others' `(x)`.

::: tabs
+++ Source
```markdown
- [x] take out the trash
- [ ] water the plants

- ( ) tea
- (x) coffee
```
+++ Rendered
- [x] take out the trash
- [ ] water the plants

- ( ) tea
- (x) coffee
:::

A heading takes a checkbox too, `## [ ] Stretch`, to mark what's under it
done; `## \[ ] Stretch` keeps the brackets as typed. Boxes in a row,
`- [ ][ ][ ]`, are one box with stages (see [Recipes](recipes.md)).

## Fields

A line starting `@ ` is a **form field**: a label, a colon, and whatever's
filled in after it, which can be nothing yet. Each colon is a line of
blank, so a longer answer gets more room, running to the end of the line:

::: tabs
+++ Source
```markdown
@ My Name: Josh
@ Date:
@ Notes:::
```
+++ Rendered
@ My Name: Josh
@ Date:
@ Notes:::
:::

The value still goes on the one line in the file, wrapping only on the page,
and a blank grows if it outruns its lines. Click the label, the blank, or
beside them to fill it in, right on the page: `Enter` (or clicking away)
writes it into the file; `Esc` puts it back; `Tab` and `⇧Tab` write it and
move to the next field or the one before. The value is shown just as typed,
with no markdown.

A field can say what goes in it: text in braces at the end of its label is a **hint**, shown faint in the blank until something's filled in.
It goes with the label, before the colon, since what follows the colon is the value.
It isn't part of the label, and a screen reader hears it as the blank's placeholder.

::: tabs
+++ Source
```markdown
@ Hours of sleep last night {e.g. 7.5}:
@ The Way of Kings {What would you argue with the author about?}:::
```
+++ Rendered
@ Hours of sleep last night {e.g. 7.5}:
@ The Way of Kings {What would you argue with the author about?}:::
:::

A label that really ends in braces escapes them, `@ Set \{a, b\}:`.

On a slide being presented, or on an exported page, a field can't be filled
in: it reads as its label and what's written there, or as blank, still
showing its hint. A field of choices, below, shows the one picked, and on a
slide it can't be changed. On an exported page its buttons can be clicked,
but nothing is saved.

A field whose value is nothing but `( )` choices is one to pick from, its
radio buttons in a row after the label. Clicking one writes `(x)` in front
of it, and `( )` in front of the rest.

::: tabs
+++ Source
```markdown
@ Session: ( ) Sat AM (x) Sat PM ( ) Sun AM ( ) Sun PM
```
+++ Rendered
@ Session: ( ) Sat AM (x) Sat PM ( ) Sun AM ( ) Sun PM
:::

## Blanks in a sentence

A blank can also sit inside a sentence, filled in the way a madlib is:
`[@ ` and what goes there, which shows small under the blank. It's filled in
as a field is, and the answer is written after a colon and shown bold, to
stand apart from the sentence.

::: tabs
+++ Source
```markdown
The [@ an animal: walrus] jumped over the [@ a piece of furniture].
```
+++ Rendered
The [@ an animal: walrus] jumped over the [@ a piece of furniture].
:::

Square brackets typed into it are written as round ones, so they don't end
it early. One followed by `(` is a link, as `[text](url)` is, and a
backslash (`\[@ `) keeps it as typed.

## Dates

`date:` is a day, written year-month-day and read in words. Words in the
brackets are shown instead, and with no day at all it is a blank to pick one
into:

| You write | Shows |
| --- | --- |
| `date:2026-11-10[]` | November 10, 2026 |
| `date:2026-11-10[the deadline]` | the deadline |
| `date:[]` | *pick a date* |

::: tabs
+++ Source
```markdown
Drafts by date:2026-11-10[the deadline], reviews by date:2026-11-17[], and
the party on date:[].
```
+++ Rendered
Drafts by date:2026-11-10[the deadline], reviews by date:2026-11-17[], and
the party on date:[].
:::

Hover a date and a calendar shows its month, the day marked. Click the date
(or press `Enter` on it) and the calendar stays open: `‹` and `›` go from
month to month, and clicking a day writes it into the file in the date's
place. The arrow keys move by a day or a week, `PageUp` and `PageDown` by a
month, `Enter` picks, and `Esc` or a click elsewhere closes it. This works
in Work too, though not on a slide. A date that isn't one
(`date:2026-02-30[]`) stays as typed.

## Starting over

`reset:[]` is a **Start over** button: it clears every box in its section
(the heading it's under, to the next at that level or above), plain,
staged or a choice, as one edit you can undo. `reset:[Clear]` names it.
It's as much for a todo list or a game as for a [recipe](recipes.md).

## Progress

`progress:` draws a bar, and says how far along it is.
Two numbers in the brackets, done and of how many, draw it as written; the words after it say what's counted.

::: tabs
+++ Source
```markdown
progress:[326/1007] pages
```
+++ Rendered
progress:[326/1007] pages
:::

Empty brackets count the boxes in its section (the heading it's under, to the next at that level or above, or the slide it's on), and how many are ticked.
A staged box counts once it's full; a choice isn't a box, and neither is the heading's own box, which says the whole section is done.

::: tabs
+++ Source
```markdown
progress:[] packed

- [x] Passport
- [x] Charger
- [ ] Rain jacket
```
+++ Rendered
progress:[] packed

- [x] Passport
- [x] Charger
- [ ] Rain jacket
:::

The bar fills as the boxes are ticked, in Work too.
On a slide, on an exported page, or once the page is a record (below), it shows the boxes as the file has them.

## Timers

`timer:[2m]` is a timer: its time, and a **Start** button.
Started, it counts down, and can be paused, resumed or reset; it doesn't start by itself.

::: tabs
+++ Source
```markdown
Breathe in for four and out for six. timer:[2m]
```
+++ Rendered
Breathe in for four and out for six. timer:[2m]
:::

The time is in hours, minutes and seconds, each a number and its letter, in that order: `90s`, `2m`, `1m30s`, `1h`.
Anything else (`timer:[soon]`) stays as typed.
Several on a page each run on their own.

At zero it stops, says *Time’s up*, and sounds three short tones; a screen reader hears it then, and not the count as it goes.
Nothing of it is written to the file, so it runs on a slide, in Work, and on a page past its `open-until:` too.
Going to another page or slide doesn't stop it: it still sounds at zero, and shows where it got to when you come back.
An exported page only says how long, having nothing to count down with.

## Closing a form

Some pages are filled in for a while and are then a record: a day's checklist, a sign-up sheet, a quiz.
`open-until:` in the front matter says until when.

```markdown
---
title: Potluck sign-up
open-until: 2026-11-08 18:00
---
```

It's a day and a time, read by the clock of whoever has the page open; a day alone (`open-until: 2026-11-07`) is open to the end of that day.
The byline says so, *Editable Until 18:00 on 8 November 2026, Two Days Away*, counting down by the minute, and a workbook says it atop each page.

Once the time has passed, the page's boxes, choices, fields, dates and puzzles show what was left in them and can't be changed, and an empty field has no hint.
The byline then says *No Longer Editable*, and when it closed on hover, or when the keyboard reaches it.
If the time passes while the page is open, it shuts there and then: what was being typed into a field is kept.
Playing something back (a video, a sound) still works, and Edit still edits the file: change the time to open it again.

An exported page says until when it could be edited, without the count, or that it no longer can.
Should the page's inputs still write to the file a day after it closed, the server refuses them, a day late so that a server whose clock or time zone isn't yours errs towards open.
