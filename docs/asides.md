---
title: Asides
reviewer #: Josh
reviewer m: Maria, teal
topic c: Coherence
topic s: Style
topic a: adjectives, circle
topic v: verbs, teal, highlight
topic l: clauses
---

← [Contents](index.md)

## Your own voice

A line starting `~` is an **aside**: your own voice, set in a column of
its own beside the text, level with the line you were reacting to. It
doesn't change the shape of what it's written in: a list stays one list
with an aside between its items.

::: tabs
+++ Source
```markdown
The speaker said most teams adopt a tool long before they agree on how to use it.

~ True of us too; worth a post on our own conventions
```
+++ Rendered
The speaker said most teams adopt a tool long before they agree on how to use it.

~ True of us too; worth a post on our own conventions
:::

An aside can go after a paragraph or straight under any line of one.
Under a line, the paragraph carries on below it as one paragraph, so
with a sentence to a line, a reviewer can answer any sentence. There,
an aside that runs onto a second line indents it.

## Who, and what about

An aside can also say **who** it's from and **what** it's about, for
reviewing a document in its margin. Declare one-character aliases in the
front matter, then put them straight after the `~`, in any order:

::: tabs
+++ Source
```markdown
-----
reviewer #: Josh
reviewer m: Maria, teal
topic c: Coherence
topic s: Style
-----

Some paragraph.

~#c This contradicts §2.
~ms Too long; split it.
```
+++ Rendered
Some paragraph.

~#c This contradicts §2.
~ms Too long; split it.
:::

The aside then opens with the reviewer's name, in their colour, and a pill
for each topic, and its rule takes the reviewer's colour. A legend under
the byline lists who and what with how many asides each, as at the top of
this page. A colour after a name is that alias's own; the rest come from a
palette that holds up in print. A run of aliases with one that isn't
declared still makes an aside, with that one marked `?` for a slip of the
finger. With more than one, or in a document with no aliases, a `~word`
line reads as text, as it always has. In a deck, the aliases go in the
deck's front matter.

In Edit and Work, click a name or a topic in the legend to show only its asides; the others are dimmed, not taken away, so you can still see where they are.
Several reviewers mean any of them, and so do several topics; a reviewer and a topic together mean both, as Josh's asides about Coherence.
The filter is kept in the address, `#review.md?by=%23&about=c`, so a filtered page can be shared or reloaded; click a name again, or the `×` beside them, to show every aside.
It isn't written in the file, and a printed or exported page shows every aside.

A colour you name is drawn in the palette's hue for it, deep on a light
page and bright on a dark one, so a name and its count read as text
either way: `reviewer m: Maria, gold` is the palette's amber.

| Palette | Names |
|---|---|
| `red` | red, crimson, maroon |
| `amber` | amber, orange, gold, yellow, brown |
| `moss` | moss, green, lime, olive |
| `green` (a teal) | teal, cyan, turquoise |
| `blue` | blue, navy |
| `violet` | violet, purple, indigo |
| `rose` | rose, pink, magenta |
| `slate` | slate, grey, gray |

A `#hex`, or another name, is kept, but a pill, a chip or the legend
takes it darker on a light page, or lighter on a dark one, where it
wouldn't read: `#ffd700` is a dark gold. The rule and the marks keep it as
it's written.

## Threads

Reviewing in the margin is a conversation, so an aside can be answered.
A line starting `~~` straight under an aside is a **reply** to it, with its own aliases, or none:

::: tabs
+++ Source
```markdown
Every ticked item can use up an ingredient.
~#c [ ] Does this mean a shopping item can hold it back?
~~m Yes, and ticking it uses the ingredient up.
~~# Then let's go back to steps only.

Only a recipe's steps use one up.
~# [x] Is the shopping list left alone?
~~m It is.
```
+++ Rendered
Every ticked item can use up an ingredient.
~#c [ ] Does this mean a shopping item can hold it back?
~~m Yes, and ticking it uses the ingredient up.
~~# Then let's go back to steps only.

Only a recipe's steps use one up.
~# [x] Is the shopping list left alone?
~~m It is.
:::

The replies sit under the aside, a little in, each opening with who wrote it, and the thread keeps the aside's place beside its line.
Replies are flat: every `~~` after an aside answers that thread, as comments under a review comment do.
A reply counts towards its reviewer in the legend.
`~~` only starts a reply before a space or a run of aliases, so `~~struck~~` text is struck through, as it always was.

Any aside folds to its first line, and opens again, by its `›`; folding is a way of reading the page, so nothing is written.

A box after the aliases, `~# [ ]`, as after a heading's hashes, makes a thread that can be **resolved**, with a grey check before who it's from.
Press it, and its `[x]` is written into the file: the check turns green, the thread goes into the done ink, as a ticked task does, and it starts folded, out of the way but kept as the record of what was decided.
In the legend, a dot at a name's corner counts what's in its threads still to resolve, so what's left to talk through shows.

Elsewhere, a thread reads as plain text: a question, its answers, and `[x]` as done.

## Marks

An aside can say which **words** it's about, and they're marked as a pen
would mark them: circled, underlined (straight, `dotted` or `wavy`) or
highlighted, in the topic's colour, with a line drawn from them to the
aside. Give a topic its style after its name and colour; one with none
underlines. Then name the words in brackets after the aside's aliases:

::: tabs
+++ Source
```markdown
-----
topic a: adjectives, circle
topic v: verbs, teal, highlight
topic l: clauses
-----

the quick brown fox jumped over the lazy dog
~a[quick] nice job getting the q in early
~v[jumped] ooh, j is hard too
~l[the lazy dog] and a z for the win!!
```
+++ Rendered
the quick brown fox jumped over the lazy dog
~a[quick] nice job getting the q in early
~v[jumped] ooh, j is hard too
~l[the lazy dog] and a z for the win!!
:::

The words are looked for in the line the aside is under, then in the rest
of that paragraph, or, after a blank, the paragraph before. Whole words
only; `[the#2]` is the second `the`. Braces after them override the
topic's style (`~a[quick]{highlight}`). Several asides can name the same
words, each with its own line, and the aside opens with the words it named,
for when the line can't be seen: on a page too narrow for the margin, or
exported, where nothing draws it. Words not found show there with a `?`.
The writer's own aside can name words too (`~[quick]`), and one with
nothing after the brackets just marks them.

Words can be marked in the text as well, with or without an aside, as a
style is set (see [Styling text](text.md)): `[the lazy dog]{l}` in topic
`l`'s colour and style, `{l circle}` in another style, `{circle}` alone in
the ink's. A color named alongside is the mark's, from the palette as a
topic's is. An aside naming those
words is tied to that mark.

::: tabs
+++ Source
```markdown
over [the lazy dog]{l} and [the fence]{wavy red}
~[the fence] which fence?
```
+++ Rendered
over [the lazy dog]{l} and [the fence]{wavy red}
~[the fence] which fence?
:::

Hovering a mark or an aside about it picks out both, and the line. A
mark's topic shows on hover too, and a screen reader says it, so it isn't
known only by its colour.

## A note to whoever opens the file

An HTML comment on lines of its own is left out of the page, asides
inside it too, so it's the place for a note to whoever opens the file,
such as how to review it:

```markdown
<!--
To review: write ~D and your topics under the line you mean, then a thought.
-->
```
