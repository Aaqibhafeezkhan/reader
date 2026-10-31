---
title: Layout
---

← [Contents](index.md)

A `:::` block named `columns`, `row`, `grid`, `cards`, `tabs` or `compare`
lays out what's in it.
Any other `:::` block styles it (see [Styling text](text.md)).

## Columns

A `:::` block named `columns` sets what's in it **side by side**, each
block a column, all the same width:

::: tabs
+++ Source
````markdown
::: columns
```number
15%
daily code change
```

```number
26%
weekly code change
```
:::
````
+++ Rendered
::: columns
```number
15%
daily code change
```

```number
26%
weekly code change
```
:::
:::

- Any block can be a column: a paragraph, a list, an image, a quote, a
  fence.
- For a column of more than one block, put a `+++` line between the
  columns. Then only those lines start one.
- The other names on the line are styles for everything in it, as on any
  `:::` block: `::: columns slategray avenir-next`.
- Blocks nest: a style block in a column, or columns in a column.
- An aside written in a columns block, or right after it, sits beside all
  of it.

::: tabs
+++ Source
```markdown
::: columns
### Before
* slow
* manual
+++
### After
* fast
* automatic
:::
```
+++ Rendered
::: columns
### Before
* slow
* manual
+++
### After
* fast
* automatic
:::
:::

## Row

A `:::` block named `row` sets its first block **beside the rest**, at
that block's own width, and stacks the others in the width that's left,
top-aligned: a cover beside a book's title, a portrait beside a bio.

::: tabs
+++ Source
```markdown
::: row
![](images/cover.svg =56x)

**[Pride and Prejudice](https://www.gutenberg.org/ebooks/1342)** · Jane Austen

progress:[326/432] pages
:::
```
+++ Rendered
::: row
![](images/cover.svg =56x)

**[Pride and Prejudice](https://www.gutenberg.org/ebooks/1342)** · Jane Austen

progress:[326/432] pages
:::
:::

- An image alone in the first block is just the image, as small as its
  size makes it, not a figure with a caption. Its alt text is still its
  name, for a screen reader.
- A bar of how far along beside it takes the width that's left.
- For a first block of more than one block, a portrait and its caption,
  put a `+++` line after it. Then what's before the first `+++` is the
  first block, and everything after it is beside it.
- `::: row reverse` puts the first block on the right. The other names on
  the line are styles, as on any `:::` block.
- In a narrow window, it stays a row while the rest has room for a few
  words beside the first block, and then the rest goes under it.
- An aside written in a row, or right after it, sits beside all of it.

## Grid

A `:::` block named `grid`, with a number after it, sets what's in it out
**in that many columns**, row by row. A list in it lays out its items;
otherwise each block is a cell:

::: tabs
+++ Source
```markdown
::: grid 2
- ( ) **A** · Strength training
- ( ) **B** · Running
- ( ) **C** · Something else
- ( ) **D** · I did not exercise today
:::
```
+++ Rendered
::: grid 2
- ( ) **A** · Strength training
- ( ) **B** · Running
- ( ) **C** · Something else
- ( ) **D** · I did not exercise today
:::
:::

- The list stays one list: choices in a grid are still one choice, and
  boxes still tick.
- Cells in a row are the same height, with a gap between them.
- With no number, `::: grid` fits as many columns as there's room for.
- On a narrower page it has fewer columns, and on a phone, one.
- For a cell of more than one block, put a `+++` line between the cells,
  as in columns.
- `::: grid 2 cards` draws each cell as a card (see [Cards](#cards)).
- The other names on the line are styles for everything in it:
  `::: grid 2 gray`. Grids nest in other `:::` blocks, and they in it.
- Elsewhere, it's a list, or the blocks one after another.

## Cards

A `:::` block named `cards` draws each item of a list in it as **a card**:
a border round it, to tap anywhere to choose it.

::: tabs
+++ Source
```markdown
::: cards
- ( ) **A** · Strength training
- (x) **B** · Running
- ( ) **C** · Something else
:::
```
+++ Rendered
::: cards
- ( ) **A** · Strength training
- (x) **B** · Running
- ( ) **C** · Something else
:::
:::

- The chosen card is drawn in the accent, a border and a light fill, with
  a tick at its corner. A checked task's card is filled, its words faded.
- Clicking anywhere on a card chooses it, or ticks it, and with the
  keyboard the ring goes round the whole card. A link, a video's play
  button or a field's own choices in a card still take their own clicks.
- A plain list's items are cards with nothing to choose: links to go to,
  things to read. Without a list, each block is a card, or what's between
  `+++` lines.
- `::: grid 2 cards` lays the cards out in a grid (see [Grid](#grid)).
- An item with a background of its own keeps it, and shows it's chosen by
  its border.
- On a slide, or once the page is a record, the chosen card
  still shows, and none answers the pointer.
- The other names on the line are styles, as on any `:::` block.
  Elsewhere, it's a list.

## Tabs

A `:::` block named `tabs` holds **more than one version** of a passage, the
same code in Java and in Kotlin, say, and shows one at a time. These pages
use it for each sample's Source and Rendered.

::: tabs
+++ Source
````markdown
::: tabs
```java
http.oauth2Login(Customizer.withDefaults());
```

```kotlin
http { oauth2Login { } }
```
:::
````
+++ Rendered
::: tabs
```java
http.oauth2Login(Customizer.withDefaults());
```

```kotlin
http { oauth2Login { } }
```
:::
:::

- Each block is a tab, named for its fence's language (`Java`, `Kotlin`),
  or numbered. To name tabs yourself, or give one more than a block, start
  each with a `+++` line naming it: `+++ Maven`, `+++ Gradle`.
- The first tab shows until you pick another. Picking one picks it in every
  block on the page that has a tab of that name. The pick is remembered, so
  it holds as you edit and in the next document you open; a block shows the
  tab picked most lately of those it has. Picking Gradle leaves Java or
  Kotlin as it was.
- The block is framed, its tabs along the top, and is as tall as its
  tallest tab, so picking another doesn't move the page.
- On paper, every tab shows, one after another. In an exported file, like
  this page, each block still switches, but on its own.
- An aside written in a tab sits beside the block, shows only while that
  tab does, and marks words in it; one after the block is about all of it.

## Compare

A `:::` block named `compare` sets the versions **side by side** instead,
and marks the words they differ by, as a diff does:

::: tabs
+++ Source
```markdown
::: compare
+++ Draft
The service retries a failed request three times before giving up
+++ Final
The service retries each failed request up to three times, then gives up
:::
```
+++ Rendered
::: compare
+++ Draft
The service retries a failed request three times before giving up
+++ Final
The service retries each failed request up to three times, then gives up
:::
:::

- Click a version's name to compare the others against it. Its words that
  another version lacks are tinted red, and the other versions' words that
  it lacks green. The first is compared against until you pick another, and
  the pick is shared and remembered as a tab's is.
- Words are compared without regard to case or punctuation. Code is
  compared too, apart from the text and as written: a name, a number or
  each mark of punctuation is a word.

## Callouts

A blockquote that opens with `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`,
`[!WARNING]` or `[!CAUTION]` becomes a box headed with 📝 💡 ❗ ⚠️ or 🛑, as
on GitHub.

::: tabs
+++ Source
```markdown
> [!TIP]
> Go slow; it's sweeter.

> [!WARNING]
> my information
```
+++ Rendered
> [!TIP]
> Go slow; it's sweeter.

> [!WARNING]
> my information
:::

## Number badges

A numbered list written `1)` in place of `1.` has its numbers drawn as
badges, as a code fence's callouts are. It's still a numbered list on
GitHub.

::: tabs
+++ Source
```markdown
1) Clone the repo
2) Run `npm install`
```
+++ Rendered
1) Clone the repo
2) Run `npm install`
:::

With boxes, a `1)` list is steps to follow; see [Recipes](recipes.md).

## Tables

Pipe tables, with `:---:` and `---:` for alignment, as on GitHub.

::: tabs
+++ Source
```markdown
| Day | Talks |
| --- | ---: |
| Saturday | 12 |
| Sunday | 9 |
```
+++ Rendered
| Day | Talks |
| --- | ---: |
| Saturday | 12 |
| Sunday | 9 |
:::
