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
