---
title: The page
---

← [Contents](index.md)

What's in a document's front matter sets up its page: its masthead, the
fonts it's set in and what's behind it. These work in any document, and in
a deck they set every slide.

## The masthead

Front matter (`Title`, `Author`, `Date`, `Tags`, `Speaker`, `Listener`)
becomes the masthead; without a `Title` the file name is used. `Speaker`
and `Listener` head the two columns, the text's and the asides'. Any other
key shows in the byline as `key: value`, but for those reader reads itself
(`font:`, `background:` and the rest below, `type:` (see
[Work and present](presenting.md)), and a deck's `time:`, `paging:` and
`transition:`) and one holding keys of its own (`multibox:`).

```markdown
---
title: DevNexus, day 1
author: Josh Cummings
date: March 2026
tags: security, java
---
```

## Fonts

`font:` in the front matter is the font the document is set in, and
`title-font:` the font of its headings, when they're to differ:

```markdown
---
font: avenir-next
title-font: playfair-display georgia
---
```

- A font is named as in a `{…}` style: hyphens for its spaces, in any case.
  reader loads no fonts, so it has to be installed. Give more than one and
  they're tried in order; the page's own serif comes last.
- `font:` alone sets the headings too. `title-font:` sets every heading: the
  page's title, a slide's, and the ones under them.
- Asides, captions and code keep their own faces, and text styled with
  `{…}` or a `:::` block keeps the font it names.

## Backgrounds

`background:` in the front matter is what's behind the page: a color, an
image, or both, in either order. In a deck it's behind every slide, and a
slide says otherwise with the same line in its notes:

```markdown
---
background: images/paper.jpg
---

# Every slide is on paper

---

# Except the point you came to make

<!-- background: midnightblue -->
```

- A color is a CSS color name or a `#hex`. On a dark one the text turns
  light. It wins over the [theme](look.md): a light one stays light in
  Dark.
- An image is a path from the note, or a URL, ending in `.png`, `.jpg`,
  `.gif`, `.webp`, `.svg` or `.avif`. It covers the page. reader can't see
  whether an image is dark, so say so with a color, which also shows while
  the image loads: `background: images/stars.jpg black`.
- `background: none` in a slide's notes leaves that slide plain.
- A `background:` line isn't shown with the notes, unless it doesn't read
  as a background.
- Backgrounds are left off paper; they're set for a screen.

## Paper

`print: landscape` or `print: portrait` says which way a deck's sheets are
turned; see [Export and print](exporting.md).
