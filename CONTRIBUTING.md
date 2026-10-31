# Contributing

Node 22.13+.

```console
$ git clone https://github.com/jzheaux/reader && cd reader
$ npm install
$ npm test
$ npm run lint
```

The documentation is in [`docs/`](docs/), written in reader-markdown and
published to <https://jzheaux.github.io/reader/> on each push to `main`. To
see a page as it'll be published, open `docs` in reader, or export it:

```console
$ cd docs && node ../bin/reader.js export *.md
```

A change to what reader-markdown does goes in its page there, with a sample
in a `::: tabs` block, its `+++ Source` and `+++ Rendered` tabs.

## Layout of the code

| | |
| --- | --- |
| `bin/reader.js` | CLI |
| `src/version.js` | which reader this is, from `package.json` (and the commit, in a checkout past its release): for `--version` and the foot of the file list |
| `src/export-cli.js`, `src/browser.js` | `reader export`, and the headless browser it draws with |
| `src/export.js` | a document as one HTML file, to keep, send or print: its stylesheet and images inside it, a deck as its pages |
| `action.yml` | the GitHub Action |
| `Dockerfile` | the Docker image, serving `/docs`; its page on Docker Hub is `docs/docker.md` |
| `desktop/` | the desktop app: `main.js` (a window and a server for each folder opened, its frames' second port any free one, and the menus), `folders.js` (the folders opened, each on a port of its own), `electron-builder.yml` (the installers) |
| `src/server.js` | HTTP API and static files, and the preview frames' own origin (`frames.localhost`, or a second port), which serves only what a frame loads |
| `src/content.js` | the content directory: listing, safe paths, saves, backups, the trash, branching, renaming and promoting versions |
| `src/render.js` | markdown → `{css, body}` for the preview: one markdown-it, with every feature, laid out in columns; `makeRenderer(features)` for a test that leaves one out |
| `src/page.js` | what every page has taken off before the features read it: its front matter (less the lines a feature claims, its `matter`) and its HTML comments, with each line left traced back to the file |
| `src/columns.js` | the two-column layout: the speaker's passages beside the notes in the margin about them (`env.margin`, each `{ anchor, render(attrs) }`), under the masthead, its byline's reviewers among it, and what features add to it (`env.masthead`) |
| `features/` | one directory per piece of syntax: its markdown-it plugin, CSS, tests and, if it can be clicked, the `preview.js` that makes it so; one built on others names them in its `requires` (`features/index.js`) (so far: `open-until`, `asides`, `fields`, `tasks`, `qa`, `definitions`, `sizes`, `alerts`, `attributions`, `styles`, `columns`, `row`, `tabs`, `date`, `scripture`, `scripture-lds`, `search`, `rfc`, `pitch`, `timer`, `social`, `math`, `arrows`, `emoji`, `highlight`, `mermaid`, `headline`, `number`, `badges`, `count`, `progress`, `steps`, `ingredients`, `puzzles`) |
| `src/slides.js` | a `slides`-format deck → rendered slides and their notes |
| `src/pacing.js` | a deck's pacing plan: checkpoints and budgets from the notes, and when each slide should start |
| `src/fonts.js` | a document's own fonts: `font:` and `title-font:` in the front matter |
| `src/background.js` | what's behind a page or a slide: `background:` in the front matter, or in a slide's notes |
| `src/transition.js` | how one slide gives way to the next: `transition:` in the front matter, or in a slide's notes |
| `static/app/` | the app, a module each: `main.js` (start, events, keys), `files.js` (the file list), `outline.js` and `sections.js` (the open file's outline), `goto.js` (going to a place, `⌃G`), `extracting.js` (taking a part out into a file), `versions.js` (folders, and which files are versions of which), `manage.js` (branching, renaming, the trash), `render.js` (the preview), `saving.js`, `editing.js`, `lines.js` (line numbers, copying where you are), `modes.js` (layout, work mode), `sync.js` (scrolling the editor and the preview together), `pages.js` (a deck worked through a page at a time), `dots.js` (a workbook's dots), `done.js` (which pages of a deck are done, by what's tagged on them, and the bar of how many), `deck.js` (presenting), `moves.js` (where each key moves the deck), `screens.js` (two-screen presenting), `fit.js` (slides that don't fit), `exporting.js` (saving a document as HTML, and printing it), `sheets.js` (a deck's pages scaled to fill the paper), `pdf.js`, `status.js`, `api.js`, `state.js` |
| `static/preview.html` | the sandboxed preview frame, served from the frames' own origin |
| `static/frames.js` | where the app and the speaker view load a preview frame from, by name or by port, tried once a tab; and sending a frame a message at its own origin (`Frames.post`) |
| `static/markdown.js` | reading markdown as written, for the server and the app alike: the front matter, what a document says it is (`type:`, a `document` without one), and which lines are fenced code |
| `static/preview-api.js` | what the frame offers the scripts drawn into it: `Preview.edit` (the edits asked for in one turn go up as one), `Preview.flush`, `Preview.register`, `Preview.wait`, and whether the page can be worked (`Preview.workable`) or is a record (`Preview.closed`). Features lend each other nothing there; tasks answers `preview:complete`, sent to a box or a list item, by ticking it, or filling a staged one. Events the frame sends are named for what they mean, not who sent them: `preview:drawn` (something waited on is drawn), `preview:workable` and `preview:closed` (the page's answers changed), `preview:current` (what's current on the page changed; the current place carries `aria-current`), and `preview:done`, sent from a thing to be done when it's done or undone, which says which it is in `data-done` and its line in `data-line`. A question, choices of which one's to be picked, says whether it's answered in `data-answered`. A list item that's a step to follow carries `data-steps` |
| `static/tone.js` | a tone that fades, made with Web Audio, for whatever in the preview frame makes a sound: a note played (`pitch:`), a timer run out (`timer:`) |
| `static/progress.js` | how far along something is, a bar and "3 of 11", for `progress:` and whatever else counts what's done |
| `static/preview.js` | the frame itself: rendering, slide steps, fitting a slide, image peeks, shortcuts |
| `static/ink.js` | light text or dark on what's behind a page, by contrast: for the preview frame, and inside an exported page |
| `static/edits.js` | edits the preview asks for, checked against the lines they were drawn from |
| `static/views.js` | kept for the frames, which have no storage of their own: the versions picked in `tabs` and `compare` blocks, and how a document is set to be seen (a recipe's multiple) |
| `static/awake.js` | keeps the screen on while a frame asks: steps under way |
| `static/print.html` | the empty page a document is printed from, out of sight |
| `features/blank.js` | a blank to fill in, as any feature draws one (fields, definitions), and whether a page can be worked where it's drawn: not on a slide, not once exported, not once it's a record (`open-until:`) |
| `features/rows.js` | the page cut into rows, each passage beside the notes in the margin about it, whichever feature wrote them; and the block a note is written after (`lastBlockBefore`), where the words an aside chooses are |
| `features/mark.js`, `features/color.js` | a mark, words circled, underlined or highlighted, as styles draws one (`[quick]{circle}`) and asides does (`~a[quick]`); and the colours an author names, in the family's hue for each, as marks and an aside's key draw them |
| `features/fence.js` | what goes with a code fence, after it: its `output` fence and the notes on its marked lines, as highlight draws them and a layout keeps them in the fence's pane |
| `features/names.js` | the colour and generic font names CSS knows, for a style's `{red georgia}` and the front matter's `background:` and `font:` |
| `features/scheme.js` | short links, `scheme:path[label]`, as each scheme's feature declares one (`scripture:`, `rfc:`, `gh:`, `yt:`, ...): read in the text, and as the URL of a `[text](...)` link or a `![alt](...)` image, which shows what the scheme has to show, or else links |
| `features/asides/` | asides: lifted out of the source (`preprocess.js`), who they're from and what they're about (`key.js`), each a note in the page's margin, its cell drawn by the feature (`index.js`) and styled (`asides.css`), and the words they choose, marked last of all (`marks.js`, the feature's `late` plugin) and tied to them by a line (`preview.js`) |
| `features/puzzles/` | puzzle fences: found and wrapped (`index.js`), drawn, played and posted back in the preview (`preview.js`) |
| `features/puzzles/kinds/` | one file per kind of puzzle; a file here is a fence name |
| `static/speaker.html`, `static/speaker.js` | the speaker view for a deck being presented |
| `static/overview.js`, `static/overview.css` | the overview, every slide as a thumbnail to pick from (`O`), shared by the deck and the speaker view |
| `static/spoken.js` | a slide as a screen reader hears it, shared by the deck and the preview frame, so the two say a slide alike |
| `test/dom.js` | a page for the tests of what runs in a browser (happy-dom's), and the preview frame as the server serves it |

Every file in a feature's directory, at any depth, is that feature's own, as a package's are in Java. Nothing outside it refers to one: not another feature, not what features share, not the core (`src/`), not the tests in `test/`, by an import, an `export ... from`, an `import()` or a `new URL(..., import.meta.url)`. What two features share goes at the top of `features/`. A feature's one public part is its descriptor, the default export of its `index.js`, and only `features/index.js` imports it; the rest reach a feature through `FEATURES`. A feature's own tests sit in its directory and may reach `src/` and `test/`. `npm run lint` fails on a reference that breaks this (`eslint.config.js`), so the core and every other feature work without any one of them.

A preview frame is another origin than the app's, but its `<base>` is the app's `/content/`, so that a document's links and images find its files. A script the frame loads late (Mermaid's, say) is named from the frame's own `location`, `new URL('/features/...', location.href)`, never by a bare path, which the `<base>` would send to the app, where the frame's policy won't load it from and the app doesn't serve it. The frames' origin serves only what `preview.html` names and features' `preview` and `lazy` scripts; anything else a frame needs goes there too (`src/server.js`).

PDF.js is vendored in `static/vendor/`, Mermaid in `features/mermaid/vendor/`, and the sites' marks in `features/social/icons/`; their versions and licenses are noted there.

## The desktop app

`desktop/` is reader in a window of its own, for those who'd rather not
run a server: Electron, starting `src/server.js` for each folder opened.
It has its own `package.json`, for Electron and what builds it; what it
ships is this checkout, with the dependencies in the one above.

```console
$ cd desktop && npm install
$ npm start -- ~/Documents/notes      # run it from the checkout
$ npm run dist                        # the installer for this platform, in desktop/dist
```

## Releasing

Each version has a milestone, titled with the version, that closes with a
review ([how it's done](REVIEWING.md)). Bumping `package.json` and running the
[Release](.github/workflows/release.yml) workflow are in
[RELEASE.md](RELEASE.md).
