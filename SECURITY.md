# Security

## Reporting a vulnerability

Please report it privately, through
[Report a vulnerability](https://github.com/jzheaux/reader/security/advisories/new)
on the repository's Security tab, and not in an issue, a pull request or a
discussion. Say what an attacker can do, and how, with the steps or a file
that shows it.

You'll hear back within a week. Once a fix is out, the advisory is
published, crediting you unless you'd rather it didn't.

## Supported versions

Fixes go to `main` and the latest release.

## Scope

reader has no sign-in: whoever can reach the server can read and write the
directory it serves, so the network it listens on is the boundary (see
[Options](docs/install.md#options)). That alone isn't a vulnerability. Reaching
files outside that directory, running script from a document someone else
wrote, or a page on another site reading or changing your files are.

## The preview frames

A document is drawn in frames apart from the app, so that nothing it brings
can reach the API or your files. Each frame is sandboxed, and is loaded from
an origin of its own, which serves the frame's page and its scripts and
styles and nothing else (no API, no files, GET and HEAD only):

- `http://frames.localhost:<the app's port>`, told apart from the app by the
  name it's asked by, where the app is opened at `127.0.0.1` or `localhost`
  and the browser takes `.localhost` names as this machine (Chrome, Edge,
  the desktop app): another site, so another process and other cookies;
- else a second port, `--frame-port`, by default the app's plus one (Safari,
  which asks the system for the name, and another device): the same site as
  the app, so the app sets no cookies, and must never.

The page tries the name once per tab and keeps the answer. The frame's policy
lets only the app frame it, and the frame takes messages only from the app's
origins; the app sends its frames messages at their own origin, or, to a frame
with no origin of its own, to any. A request a frame makes of the app is
another site's, or another origin's, and refused but for a document's images.
The app opened at `[::1]` is sent on to `127.0.0.1`, since a policy can't name
an IPv6 address.
