---
title: How to Take Notes Like a Boss
tags: notes, tutorial
requires: reader 0.0.3
---

# Notes worth having

> [!NOTE]
> Reading this on the web?
> It's written for reader 0.0.3 or later.
> [Download the tutorial](https://jzheaux.github.io/reader/samples/take-notes-like-a-boss.zip) and unzip it into the folder reader shows: the one you named when you started it, or chose in the desktop app.
> It turns up in the file list as *take-notes-like-a-boss*, with the notes you'll practice on.
> To keep it apart, open it as a folder of its own instead: `reader take-notes-like-a-boss`, or File → Open Folder… in the desktop app.

Most notes are a transcript.
The talk is recorded anyway, and the slides get posted by Friday.
What isn't recorded anywhere is what *you* thought while you listened.

Taking notes like a boss means catching both, the speaker's words and your own, and keeping them apart.
It means a word you didn't know gets looked up, a line worth keeping gets kept, and an idea turns into action.
And it means doing all that in plain text, so the notes still read anywhere.

That plain text is reader-markdown.

!reader-markdown: GitHub-flavored markdown, plus a few extras for taking notes, reviewing, teaching and presenting; it still reads as plain text anywhere else

~ This page is !reader-markdown too.
~ A line like this one, starting with `~`, is an aside: the writer's voice, set in the margin.

Each part below takes one habit from a day of notes at Riverbend Dev Days.
At the end, you'll give that day its ten minutes yourself.

---

# One file a day

A conference day, a week of standups, a class: give each one a single file.
**New** in the file list makes one named after today's date, like `2026-10-26.md`.

Put `---` on a line of its own between talks.
Each talk becomes a part of the file, and the outline lists the parts by their first heading.

::: tabs
+++ Source
```markdown
-----
title: Riverbend Dev Days, day 1
date: October 2026
-----

# Boring Software

Priya Raman, keynote

---

# Backpressure for the Rest of Us

Tomás Ortega
```
+++ Outline
![The outline of the day's notes, in the file list](images/outline.png "The outline, with a number for each part" =230x)
:::

`⌃G` then a word from a talk's title goes straight to it, however long the day got.

> [!TIP]
> Don't stop to tidy during a talk.
> Type fast, in plain bullets.
> Tidying is for the ten minutes after.

---

# Their words, your words

A talk gives you two streams at once: what's said, and what it makes you think.
Most notes blur them, and a month later nobody can tell which was which.

Write theirs as usual.
Write yours on a line starting `~ `, right under the line it's about.

::: tabs
+++ Source
```markdown
- an unbounded queue is choosing to crash later
~ Our importer does exactly this.
~ That was the outage in August.
```
+++ Rendered
- an unbounded queue is choosing to crash later
~ Our importer does exactly this.
~ That was the outage in August.
:::

The aside sits in the margin, level with the line, and the list stays one list.

To point at the exact words, name them in brackets after the `~`:

::: tabs
+++ Source
```markdown
- an unbounded queue is choosing to crash later
~[unbounded queue] Our importer does exactly this.
```
+++ Rendered
- an unbounded queue is choosing to crash later
~[unbounded queue] Our importer does exactly this.
:::

~ If you can't tell whether a thought was the speaker's or yours, it's yours.
~ Make it an aside.

---

# Questions in the room

The questions are often the best part of a talk, and the part notes lose.
Start a line with `Q:` for a question and `A:` for its answer, with who said it in parentheses:

::: tabs
+++ Source
```markdown
Q (audience): Do retries count?
A (Tomás): Retries are just a producer you forgot about.
```
+++ Rendered
Q (audience): Do retries count?
A (Tomás): Retries are just a producer you forgot about.
:::

The exchange is set apart from the notes around it, so you can find it again at a glance.
The same works for a hallway conversation after the talk.

---

# Words you didn't know

Every talk has a word everyone else seems to know.
Don't stop to look it up; write it down with a `!` and a colon, and nothing after:

::: tabs
+++ Source
```markdown
!SLO:
```
+++ Rendered
!SLO:
:::

It reads *not yet defined*, so it stands out when you skim the notes later.
Click it to fill it in, once you know:

::: tabs
+++ Source
```markdown
!SLO: service level objective, the reliability you promise yourselves
```
+++ Rendered
!SLO: service level objective, the reliability you promise yourselves
:::

From then on, write `!SLO` anywhere in the file and its meaning shows when you hover it.

---

# Lines worth keeping

Some lines you'll want word for word.
Make them a quote, with `> --` and who said it on the last line:

::: tabs
+++ Source
```markdown
> If the example is wrong, the docs are wrong.
> -- Dana Whitfield
```
+++ Rendered
> If the example is wrong, the docs are wrong.
> -- Dana Whitfield
:::

~ One or two per talk.
~ If everything is a quote, nothing is.

---

# Something to do

A note that doesn't change anything was entertainment.
Before the next talk starts, ask what you'll do differently, and write it as a task:

::: tabs
+++ Source
```markdown
- [ ] Count our innovation tokens before planning on date:2026-11-03[]
- [ ] Put a max on the importer's queue
```
+++ Rendered
- [ ] Count our innovation tokens before planning on date:2026-11-03[]
- [ ] Put a max on the importer's queue
:::

Click a box to tick it, and click a date to pick another day.
Both are written back into the file.

---

# The ten minutes after

Right after the last talk, while it's fresh, go through the day once:

1) Skim the outline, talk by talk.
2) Fill in every word that reads *not yet defined*.
3) Turn your own thoughts into asides, if they snuck into the bullets.
4) Turn the questions into `Q:` and `A:`.
5) Pick the one or two lines worth quoting.
6) Write one task per talk, or decide the talk didn't need one.

Then look at the talk you'll come back to most.
Give it a file of its own: in the outline, the arrow-out-of-a-box icon at the end of its entry takes it out into a file beside this one, and leaves a link in its place.

::: tabs
+++ Start
```markdown
# The Docs Nobody Reads

Dana Whitfield

- write for the person reading at 2am
- one task per page
- ...
```
+++ Finish
```markdown
# The Docs Nobody Reads

→ [The Docs Nobody Reads](the-docs-nobody-reads.md)
```
:::

~ For the whole day, open [start](start/riverbend-day-1.md) and [finish](finish/riverbend-day-1.md) side by side.

---

# Your turn

Open [the notes as they were typed](start/riverbend-day-1.md) and give them their ten minutes.
The checklist is at the top of the notes, with a link back here.

Then plan for the next one:

@ The next talk, class or meeting I'll take notes in:
@ When:
