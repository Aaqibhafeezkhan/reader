---
title: Run it in Docker
---

← [Contents](index.md)

A local, two-pane reader and editor for a directory of markdown: rendered on
the left, editable on the right, with asides set in a column of their own.
This image serves the directory mounted at `/docs`, for a NAS or a home
server, or to try reader without installing Node.

Source, issues and releases: <https://github.com/jzheaux/reader>.
Documentation: <https://jzheaux.github.io/reader/>.

## Run

```console
$ docker run --rm -p 127.0.0.1:8734:8734 -p 127.0.0.1:8735:8735 -v ~/notes:/docs jzheaux/reader
```

Then open <http://localhost:8734/>. `Ctrl-C` stops it.

- **`/docs`** is the directory reader serves, and writes to: saves, and its
  backups and trash in `/docs/.reader`. Without a mount it's a volume of
  Docker's own.
- **Port 8734** is the one it listens on in the container. Publish it on
  whichever port you like: `-p 127.0.0.1:9000:8734` for
  <http://localhost:9000/>. Leaving out `127.0.0.1:` publishes it on every
  address the machine has, so other devices can reach it too.
- **Port 8735** serves the page's preview, apart from the app, where the
  browser can't have it at `frames.localhost` on the app's own port: in
  Safari, and on another device. Publish it beside 8734, one port after
  wherever that goes: `-p 127.0.0.1:9000:8734 -p 127.0.0.1:9001:8735`.
  Without it, Chrome and Edge on this machine still work; Safari shows a
  blank page.
- **The user** is `node`, uid 1000, not root. A directory mounted from the
  host has to be writable by 1000, or the container run as its owner:
  `--user "$(id -u):$(id -g)"`.
- **The clock** is the container's, which is UTC unless it's told otherwise.
  Today and Start today's go by it, so in Denver tomorrow would come at 5pm
  in the winter and 6pm in the summer. Give it yours with `-e TZ=`:
  `-e TZ=America/Denver`; the image needs nothing more for it.

## From another device

To reach it from other devices, publish the ports on every address (`-p
8734:8734 -p 8735:8735`). reader also answers only requests addressed to
`localhost` or `127.0.0.1` unless it's told the names other devices reach it
by; that guards against other web sites, not other devices. Reaching the NAS as `nas.local`,
or by its address, name each after the image:

```console
$ docker run -d --name reader -p 8734:8734 -p 8735:8735 -v /volume1/notes:/docs \
    jzheaux/reader --allow-host nas.local --allow-host 192.168.1.20
```

Whatever follows the image name is added to reader's own options, so any of
them can go there; see [Install and run](https://jzheaux.github.io/reader/install.html).

There is no sign-in: whoever can reach the port can read and write `/docs`.
Keep it to a network you trust, such as your home network or a tailnet, or
put a proxy that signs people in in front of it.

## Compose

A `compose.yaml` for the same:

```yaml
services:
  reader:
    image: jzheaux/reader
    command: ["--allow-host", "nas.local"]
    environment:
      TZ: America/Denver
    ports:
      - "8734:8734"
      - "8735:8735"
    volumes:
      - /volume1/notes:/docs
    restart: unless-stopped
```

```console
$ docker compose up -d
```

## Tags

- `latest`, the newest release
- `0.0.2` and so on, each release, as listed at
  <https://github.com/jzheaux/reader/releases>

Each is built for `linux/amd64` and `linux/arm64`.
