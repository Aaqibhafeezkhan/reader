---
title: Notes on a talk
---

← [Contents](index.md)

## Questions and answers

`Q:` and `A:` at the start of a line make an exchange, set apart from the
notes around it: the question in italics, the answer upright. A name in
parentheses shows beside the label. Another `A:` straight after an answer --
unnamed, or naming the same person -- continues it as a new paragraph, and the
same goes for `Q:`:

::: tabs
+++ Source
```markdown
Q (audience): Is this a pendulum swing or an integration?
A (Thomas): An integration.

A: The renaissance and the scientific revolution each had half of it.
A (Sarah): I'd say it's a spiral.
```
+++ Rendered
Q (audience): Is this a pendulum swing or an integration?
A (Thomas): An integration.

A: The renaissance and the scientific revolution each had half of it.
A (Sarah): I'd say it's a spiral.
:::

That is one answer from Thomas in two paragraphs, then one from Sarah. Any
line starting at the margin that isn't `Q:` or `A:` ends the exchange.

A backslash (`\A:`) keeps a line that happens to start that way as typed.

A `Q:` or `A:` indented under an exchange is part of it: an exchange of its
own, nested under the one above, as a list nests an item under another. It
can go as deep as it's indented, and the next line at the margin starts a
new exchange. So a proposal can show what it split into, with the talk about
it in the margin, an aside going with the line it's under at any depth:

::: tabs
+++ Source
```markdown
Q (Claude): Fix the tracks bug now?
A: Now, or file an issue.
  ~ This needs to be split into two
  Q (Claude): Fix part A now?
  A: File an issue.
  Q (Claude): Fix part B now?
  A: Now.
Q (Claude): Fix this other part?
A: File an issue.
```
+++ Rendered
Q (Claude): Fix the tracks bug now?
A: Now, or file an issue.
  ~ This needs to be split into two
  Q (Claude): Fix part A now?
  A: File an issue.
  Q (Claude): Fix part B now?
  A: Now.
Q (Claude): Fix this other part?
A: File an issue.
:::

Indenting only nests an exchange in another: an indented `Q:` with no
exchange above it stays as typed. Under a heading, the heading's level
already says what it belongs to.

Inside a list's item, an exchange starts at the item's words, as one does at
the margin: a question under a numbered point, with its choices under it, is
drawn as a question in that point. A `- Q:` bullet is a question too, and a
`- A:` in the bullet after it its answer:

::: tabs
+++ Source
```markdown
1) [ ] **Two lists numbered the same**

   The first item to claim an id keeps it.

   Q (Claude): Is that enough, for now?
   - ( ) Yes
   - ( ) [@ Something else]
```
+++ Rendered
1) [ ] **Two lists numbered the same**

   The first item to claim an id keeps it.

   Q (Claude): Is that enough, for now?
   - ( ) Yes
   - ( ) [@ Something else]
:::

An answer can be a pick from choices, `( )` in front of each, as a
[field's](forms.md#fields) are: they're radio buttons in a row, one set to
each `A:` line. Clicking one writes `(x)` in front of it, and `( )` in front of
the rest. A [blank](forms.md#blanks-in-a-sentence) as one of them is a blank,
and filling it in picks it, the answer and the `(x)` written together:

::: tabs
+++ Source
```markdown
Q (Claude): Put the page bar fix in 0.0.4?
A: ( ) Yes ( ) No ( ) [@ Something else]
```
+++ Rendered
Q (Claude): Put the page bar fix in 0.0.4?
A: ( ) Yes ( ) No ( ) [@ Something else]
:::

The line has to start with a choice, each with words after it, or it's read
as typed: `A: I'd say (x) marks the spot` is only an answer. [Start
over](forms.md#starting-over) clears the choice picked, and the blank.

## Retro cards and votes

A retro's cards work the same way: `Good:`, `Bad:` and `Try:` each start a
card, labelled G, B or T in blue-green, red-orange or blue, colours that
stay apart for most colour blindness too, with `A:` after it as its
discussion. Every card
line is a card of its own, even from the same person twice in a row. `+1`
under a card or a question is a vote for it, named or not, with a comment
after a colon or not; the card shows how many votes it has:

::: tabs
+++ Source
```markdown
Bad (Josh): We were surprised by the release deadline
+1 (Rob)
+1 (Joe): same, I found out the day of
A (Rob): Would like to see those planned relative to the calendar.

Try [x] (Ana): Put the release dates on the team calendar
```
+++ Rendered
Bad (Josh): We were surprised by the release deadline
+1 (Rob)
+1 (Joe): same, I found out the day of
A (Rob): Would like to see those planned relative to the calendar.

Try [x] (Ana): Put the release dates on the team calendar
:::

A `+1` with no card or question above it stays as typed.

A card that's a paragraph or two long can have its label on a line of its
own, and its words indented under it, a blank line between or not. The
same goes for a `Q:` or an `A:`. Its words are a paragraph: a label alone
with nothing indented under it stays as typed, as does one with a list, a
quote or code under it, or another card, question or answer. An aside
written between a label and its words goes beside the label, with a blank
line before the words, as an indented line straight after an aside is the
aside's own:

::: tabs
+++ Source
```markdown
Good (Claude):

  An aside under the line it was about kept each conversation in place.

  Neither of us had to say which line or which item.
+1 (Josh): I'd add that it shows we need to fold finished asides.
```
+++ Rendered
Good (Claude):

  An aside under the line it was about kept each conversation in place.

  Neither of us had to say which line or which item.
+1 (Josh): I'd add that it shows we need to fold finished asides.
:::

Clicking a card's G or B marks its discussion done: the line gets an
`[x]` (`Good [x] (Josh):`), and the card, its votes and its answers fade.
Click again to take it away. A `Try`'s T is a box instead, ticked once it's
been tried: the same `[x]`, a check in place of the T, and the card stays
as it was. On a slide being presented, a card shows whether it's done but
can't be clicked.

## Linking to a question or a card

Each question and each card can be linked to by its label and how many of
its kind come before it, counted down the whole file, nested ones too:
`#Q1` is the first question, `#G2` the second Good, and `#B1` and `#T1` the
first Bad and Try. A question carried on by another `Q:` from the same
person is one question, with one id.

::: tabs
+++ Source
```markdown
Q (Daniel): Where should we go for coffee?
A (Maria): Let's look at [the next question](#Q2) first.

Q (Daniel): Do we need a break at all?
A (Maria): Yes. Back to [the first question](#Q1), then.
```
+++ Rendered
Q (Daniel): Where should we go for coffee?
A (Maria): Let's look at [the next question](#Q2) first.

Q (Daniel): Do we need a break at all?
A (Maria): Yes. Back to [the first question](#Q1), then.
:::

A card or question added above one moves its number on, and a link to it
with it. To keep one where it is, put it in a numbered list, `1) Good:`,
whose item is `#1` however the cards around it move (see [Items in a
list](links.md#items-in-a-list)). A heading, or a block before it, keeps an
id that's already had.

## Definitions

A line starting `!` is a **definition**: a term, a colon, and what it
means, set as a dictionary sets it: in a box, the term in bold small capitals
on a tint. The meaning is markdown like any other line (links, bold, `[red]{red}`), and who
used the term can follow it in parentheses, as in an exchange:

::: tabs
+++ Source
```markdown
!SLAB (Venkat): similar layers of abstraction
!gatherer: an intermediate operation that can see the whole stream
!gatherer: one that keeps its own *state* between elements
!REPL:

Venkat keeps coming back to !SLAB.
```
+++ Rendered
!SLAB (Venkat): similar layers of abstraction
!gatherer: an intermediate operation that can see the whole stream
!gatherer: one that keeps its own *state* between elements
!REPL:

Venkat keeps coming back to !SLAB.
:::

Definitions on lines in a row make one glossary, and the same term again
straight after is another sense of it, numbered. A term with nothing after
its colon is one you heard but haven't looked up: it reads *not yet
defined*, and clicking it fills it in as a field is. A term in capitals
whose meaning spells it out has those letters bolded: **s**imilar
**l**ayers of **ab**straction.

Written with a `!` before it anywhere else in the document -- before its
definition or after, in an aside, on a later slide of a deck -- the term is
set as it is in its entry, and its meaning shows on hover.

A term in capitals is matched as written, or with an `s` (`!SLOs`); one in
lower case, in any case and plural or singular (`!Sealed interfaces` at the
start of a sentence). A `!` before a word that
isn't defined is left as typed, as are code and links.

A backslash (`\!SLAB:`, `\!SLAB`) keeps a line or a word that happens to
start that way as typed.

## Quotes

A blockquote whose last line starts with `--` takes that line as its
attribution, set right-aligned under the quote. Links, and `scripture:`, work
there as anywhere:

::: tabs
+++ Source
```markdown
> The road of excess leads to the palace of wisdom.
> -- [William Blake](https://en.wikipedia.org/wiki/The_Marriage_of_Heaven_and_Hell)
```
+++ Rendered
> The road of excess leads to the palace of wisdom.
> -- [William Blake](https://en.wikipedia.org/wiki/The_Marriage_of_Heaven_and_Hell)
:::
