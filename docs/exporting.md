---
title: Export and print
---

← [Contents](index.md)

## One HTML file

The export icon at the end of a document's row, shown when the row is
hovered or open, saves it as one HTML file: the rendered page, with its stylesheet and
the images it takes from the directory inside it. Nothing in that file draws:
a diagram or a puzzle is in it as the preview drew it, the puzzle as far as
it's been played.

A deck, `type: slides` or `type: workbook`, is saved as its pages, as Work
shows them, one after another and without its speaker notes. A document is
saved whole, `---` parts and all, with its masthead.

## Paper

**`⌘P`** prints the open document as that file prints, saving it first. A
deck prints a page to a sheet: each page starts a sheet of its own,
and every sheet is numbered at its foot, so a packet needs no `*Page 2*`
typed in. Each page is scaled up, as much as twice, to fill its sheet, so
a puzzle is bigger and there's more room to write. A page too long for one
sheet runs onto the next as it is, and takes its number too. (The saved
file, printed itself, leaves its pages at reading size.)

Slides (`type: slides`) print across the sheet, landscape, and a workbook
(`type: workbook`) down it, portrait.
`print: landscape` or `print: portrait` in the front matter says otherwise.
Backgrounds are left off paper; they're set for a screen. The numbers need
Chrome 131 or later; other browsers print the sheets without them.

On paper, every tab of a `tabs` block shows, one after another.

## From the command line

`reader export` does the same from the command line, saving each document
beside itself as `<name>.html`, or to `--out` when there's one:

```console
$ reader export presentation.md
presentation.md -> presentation.html
```

It reads from the current directory. A diagram is drawn by Chrome or
Chromium, run headless: the one at `CHROME_PATH`, or one installed where it
usually is. Without one, or with `--no-draw`, a diagram is left as its text.
An image the document names that isn't in the directory is left as a link,
and said so. A link to another of the documents saved with it goes to that
one's `.html`, so a folder of them saved together still links up.

## Keeping the HTML in step, on GitHub

reader is also a GitHub Action that exports documents and commits the HTML
that changed, so a pushed `.md` doesn't leave its `.html` behind:

```yaml
# .github/workflows/export.yml
on:
  push:
    paths: [presentation.md, images/**]

permissions:
  contents: write

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jzheaux/reader@main
        with:
          files: presentation.md
```

`files` takes more than one, separated by spaces or new lines, and globs
like `slides/*.md`. `commit: false` leaves the HTML for a later step, and
`message` is the commit's. The commit is pushed with the workflow's own
token, which doesn't start another run.

Diagrams are drawn by the runner's Chrome with the runner's fonts, so their
lines and boxes may differ a little from the ones drawn on your machine. The
images have to be committed for the runner to put them inside the page.

## A folder of pages, on GitHub Pages

With `commit: false`, the HTML can go to GitHub Pages instead of the
repository, here from a `docs` folder:

```yaml
- uses: jzheaux/reader@main
  with:
    files: docs/*.md
    commit: false
- run: mkdir _site && cp docs/*.html _site/
- uses: actions/configure-pages@v6
- uses: actions/upload-pages-artifact@v5
- uses: actions/deploy-pages@v5
```

These pages are published much the same way, though with `reader export`
run in place of the Action, so they're drawn by the reader they document.

A folder's `index.md` is its `index.html`, the page Pages opens first.
