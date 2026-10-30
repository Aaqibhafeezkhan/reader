# reader

[![CI](https://github.com/jzheaux/reader/actions/workflows/ci.yml/badge.svg)](https://github.com/jzheaux/reader/actions/workflows/ci.yml)
[![CodeQL](https://github.com/jzheaux/reader/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/jzheaux/reader/actions/workflows/github-code-scanning/codeql)
[![Release](https://img.shields.io/github/v/release/jzheaux/reader)](https://github.com/jzheaux/reader/releases/latest)
[![License](https://img.shields.io/github/license/jzheaux/reader)](LICENSE)

A local, two-pane reader and editor for a directory of markdown. Pick a file:
it's rendered on the left and editable on the right, and the left side follows
you as you type.

It reads **reader-markdown**: ordinary markdown, and a few more things for
taking notes, reviewing, teaching and presenting, such as asides in the
margin, forms to fill in, puzzles to play and decks to present. A file of it
still reads as plain text anywhere else.

**Documentation: <https://jzheaux.github.io/reader/>**

## Getting started

Node 22.13+.

```console
$ git clone https://github.com/jzheaux/reader && cd reader
$ npm install
$ npm link          # puts `reader` on your PATH
$ reader ~/Documents/notes
```

Opens <http://127.0.0.1:8734/>. `Ctrl-C` stops it. Nothing leaves your machine.

Then write a line starting `~` under something, and see it set in the
margin beside it:

```markdown
The speaker said most teams adopt a tool long before they agree on how to use it.

~ True of us too; worth a post on our own conventions
```

## Docker

Without Node, or on a NAS, there's an image for `linux/amd64` and
`linux/arm64`, serving whatever is mounted at `/docs`:

```console
$ docker run --rm -p 127.0.0.1:8734:8734 -p 127.0.0.1:8735:8735 -v ~/notes:/docs jzheaux/reader
```

Reaching it from other devices, a `compose.yaml` and the rest are in
[Run it in Docker](docs/docker.md), which is also its page on
[Docker Hub](https://hub.docker.com/r/jzheaux/reader).

The rest is in the [documentation](https://jzheaux.github.io/reader/), or
its source in [`docs/`](docs/). To work on reader itself, see
[CONTRIBUTING.md](CONTRIBUTING.md).
