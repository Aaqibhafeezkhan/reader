---
title: Styling text
---

← [Contents](index.md)

## Colors and fonts

Text can be colored and set in another font by naming the styles in braces
after it. A CSS color name (`red`, `slategray`, `rebeccapurple`, ...) sets
the color; any other name is a font, with hyphens for spaces. A font you
don't have falls back to the page's own.

::: tabs
+++ Source
```markdown
[this is red]{red}, and [this is both]{darkgreen times-new-roman}.
```
+++ Rendered
[this is red]{red}, and [this is both]{darkgreen times-new-roman}.
:::

A topic's alias, or `circle`, `underline`, `dotted`, `wavy` or `highlight`,
marks the text instead (see [Asides](asides.md)).

::: tabs
+++ Source
```markdown
[circled]{circle}, [underlined]{underline}, [dotted]{dotted},
[wavy]{wavy} and [highlighted]{highlight goldenrod}.
```
+++ Rendered
[circled]{circle}, [underlined]{underline}, [dotted]{dotted},
[wavy]{wavy} and [highlighted]{highlight goldenrod}.
:::

For whole paragraphs, lists or tables, fence them with `:::`:

::: tabs
+++ Source
```markdown
::: slategray georgia
Everything here is gray and in Georgia,

- lists and tables included,

until the closing line.
:::
```
+++ Rendered
::: slategray georgia
Everything here is gray and in Georgia,

- lists and tables included,

until the closing line.
:::
:::

A list item takes styles of its own from braces where it's declared:
after its bullet, and its box if it has one, before its text. They style
the whole item, its bullet or box included, and its cell in a grid.
Braces naming anything but colors, backgrounds and the generic fonts
(`serif`, `monospace`, ...) stay as typed:

::: tabs
+++ Source
```markdown
- ( ) {bg-lemonchiffon} **High energy · Pleasant**: excited, happy
- ( ) {bg-honeydew} **Low energy · Pleasant**: calm, content
- ( ) {gray} Not sure yet
```
+++ Rendered
- ( ) {bg-lemonchiffon} **High energy · Pleasant**: excited, happy
- ( ) {bg-honeydew} **Low energy · Pleasant**: calm, content
- ( ) {gray} Not sure yet
:::

### Backgrounds

`bg-` and a CSS color name sets a background, wherever a style can go. On
a few words it's a highlighter; on a `:::` block or a list item it's a
box round the whole of it, with its corners rounded:

::: tabs
+++ Source
```markdown
Some [words to find again]{bg-yellow} in a sentence.

::: bg-aliceblue
A whole passage on a pale blue,

- its lists included.
:::
```
+++ Rendered
Some [words to find again]{bg-yellow} in a sentence.

::: bg-aliceblue
A whole passage on a pale blue,

- its lists included.
:::
:::

- The page keeps the words on it readable: a background is drawn pale on
  a light page and deep, in the same hue, on a dark one, whatever color
  was named. The words stay the page's own.
- In a layout (`::: grid 2 bg-lavender`), each cell takes the background.
- An item drawn as a card keeps its background, chosen or not (see
  [Cards](layout.md#cards)).
- In the system's high-contrast colors, a background gives way to the
  system's, and a line round it still sets it apart.

A `:::` block can also lay out what's in it; see [Layout](layout.md).

## Arrows

`->`, `<-` and `<->` show as →, ← and ↔. A backslash (`\->`) keeps them as
typed.

::: tabs
+++ Source
```markdown
draft -> review -> publish, and \-> as typed
```
+++ Rendered
draft -> review -> publish, and \-> as typed
:::

## Math

`math:[…]` sets relations between ideas as symbols, keeping the words
upright. Alone on its line it is centered like an equation; within a sentence
it stays inline:

| You write | Shows |
| --- | --- |
| `>=` `<=` `!=` `~=` | ≥ ≤ ≠ ≈ |
| `>>` `<<` | ≫ ≪ |
| `->` `<-` `<->` | → ← ↔ |
| `*` `+-` `-` | × ± − |
| `.:` `inf` | ∴ ∞ |

::: tabs
+++ Source
```markdown
math:[readability >> cleverness]

In short, math:[well-known code ~= fast code].
```
+++ Rendered
math:[readability >> cleverness]

In short, math:[well-known code ~= fast code].
:::

A `-` joining two words (`well-known`) stays a hyphen.

## Notes

`pitch:[C4]` names a note in a small button that plays it, a tone that fades in a couple of seconds.
The note is in scientific pitch: a letter, a `#` or `b` if it's sharp or flat, and its octave, with A4 at 440 Hz and middle C at C4.
Words in brackets after a note show instead of its name.

::: tabs
+++ Source
```markdown
- Start around pitch:[C4], slide down to pitch:[G3] and back up.
- Range: pitch:[G4] -> pitch:[Bb4], then pitch:C5[the top].
```
+++ Rendered
- Start around pitch:[C4], slide down to pitch:[G3] and back up.
- Range: pitch:[G4] -> pitch:[Bb4], then pitch:C5[the top].
:::

Playing a note changes nothing in the file, so it plays on a slide, in Work, and on a page past its `open-until:` too.
An exported page only names the note, having nothing to play it with.
Something that isn't a note (`pitch:[H9]`) stays as typed, as does one in code.

## Emoji

Emoji shortcodes like `:tada:` show as 🎉 in the rendered pane but stay as
`:tada:` in the file. Code spans and unknown names are left as written.

::: tabs
+++ Source
```markdown
Shipped :tada: but `:tada:` in code stays.
```
+++ Rendered
Shipped :tada: but `:tada:` in code stays.
:::
