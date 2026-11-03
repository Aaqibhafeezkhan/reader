---
title: Files
---

← [Contents](index.md)

## The file list

The sidebar shows one folder at a time: its `.md`, `.markdown` and `.pdf`
files by name, then the folders under it that have any. Click a folder to go
into it, and the path above the list to come back out. It skips
dot-directories and `node_modules`, and remembers the folder you were in.
Typing in **Filter…** searches every folder at once, as one flat list with
each file's folder beside it.

**New** creates a file in the folder you're in, named after today's date
(`2026-09-25.md`) unless you give it another name. If that file already exists,
it's opened instead. PDFs open read-only in the left pane.

## Today

**Today**, at the top of the file list, lists the files dated today, from every folder under the one reader was opened on, so that a daily file is one click away without knowing where it lives.
It's there whichever folder is shown, and a workbook opens from it in Work, as it does from anywhere.
With nothing dated today, there's no **Today**; nor is there while you're filtering, or looking at a file's versions or outline.

A file's date is the `date:` in its front matter:

```markdown
---
title: To do
date: 2026-11-03
---
```

Without one, it's a `YYYY-MM-DD` in the file's name or path, as in `journal/2026-11-03.md` or `2026/11/03/notes.md`.
If there are several, the one nearest the file counts.
Something that isn't a date, like `2026-13-45` or `date: soon`, doesn't count, so a `date: soon` leaves the file dated by its name.
The date is the server's, in its own time zone.

A day starts at midnight, unless you start reader with `--day-starts`.
With `reader --day-starts 04:00`, **Today** still lists yesterday's files until 04:00, so a journal written at 1am goes in the day it belongs to.

## The outline

The `›` at the end of the open file's row (or `→` on it) goes one level
further in, to the file's **outline**. The path above the list, or `←`, comes back
out to the files.

- With `---` between parts, as a day of talks taken down in one file has,
  each part is an entry, named by its first heading, or by its first line
  when it has none. Its `#` to `###` headings are under it.
- Without `---`, the outline is the `#` to `###` headings, nested.
- In a talk (`type: slides` in its front matter; see
  [Work and present](presenting.md)), each slide is an entry, named by its title, and the headings in a
  slide aren't listed. A slide that holds only a `#` heading starts a
  section, and the slides after it, up to the next one, are under it.

Click an entry to go there: the editor and the page beside it both move to
it. A part or a page's number is beside it. As you scroll, the entry you're
in is marked, and its part opens. Parts are folded otherwise; `▸` and `▾`,
or `→` and `←`, open and fold one. The outline follows the open file, so
`⌘⌥↑` and `⌘⌥↓` still step through the folder's files.

### Taking a part out into a file of its own

The arrow-out-of-a-box icon at the end of an entry takes that part out into a file
of its own, beside this one: a talk from a day of them, an idea from a week
of them. The name is made from its title (`spring-security-7.md`) and can be
changed first; `Enter` makes it, and `Esc` doesn't. In its place, the file
keeps a link to it:

```markdown
→ [Spring Security 7](spring-security-7.md)
```

The new file starts with this one's front matter, and a `title:` there says
where it came from: `DevNexus day 1 - Spring Security 7`.

To take out several at once, `⌘`-click the entries, `⇧`-click for a run of
them, or press `⌘A` in the outline for every part; then the icon on any of
them takes each into its own file. `Esc` lets them go.

The toast that says where it went has **Undo**, which puts the part back and
the new file in the trash. It's only offered while the toast is up, and not
once either file has changed.

## Going to a place

**`⌃G`** (Control, not `⌘`, which is the browser's find again) asks where to go:

- `12` is page 12, the twelfth part, or slide 12 of a talk.
- `:340` is line 340.
- Anything else finds an entry by its title: where it starts, then a word
  in it, then its letters in order. With nothing typed, the box lists the
  whole outline.

It works in Work too, where page 12 is the page with that number, and while
presenting, where `12` is slide 12.

## Lines, and pointing at them

The editor numbers its lines down the side: a number for each line in the
file, however many rows it wraps to. `#` at the bottom right turns them off.

To say where something is (to Claude, say, or in a message), copy it:

- `⌘⇧C` copies the file and the line the caret is on,
  `/Users/me/notes/talk.md:13`, or the lines selected, `talk.md:13-18`.
- Clicking a line's number copies that line.
- ⧉ by the file's name copies just its path.

From another device (`--host`), a path on the server is no use, so what's
copied is the file's address instead, `http://nas:8734/#notes/talk.md:13`.
Opening that address opens the file at those lines.

## Versions

Files that share a name are versions of one file:

```
slides.md            the main version
slides.arc1.md       arc1
slides.sketch.md     sketch
```

They take one row, `slides`, which opens `slides.md`. The `›` at the end of
the row lists the versions, with the day each was last changed. `a.b.md` is
a version of `a` when `a.md` is in the same folder, or another `a.*` file is:
`v1.2-notes.md` on its own is just a file. With no `slides.md`, the row opens
the version changed last.

The branch icon at the end of a row copies the file as another version,
`slides.draft.md`, opens it, and asks what to call it. The star beside a
version makes it the main one: `slides.arc1.md` becomes `slides.md`, and the
old `slides.md` becomes a version named after the day it was last changed,
`slides.oct13.md`.

## Renaming and deleting

Double-click a row, or press `F2`, to rename it where it is: `Enter` keeps
the new name and `Esc` doesn't. A document's `.md` stays on unless you type
another. Renaming a file's row renames all its versions with it (`slides` to
`talk` makes `slides.arc1.md` `talk.arc1.md`), and a version's row, in its
list, takes just the version's name. Typing a folder, `archive/slides`,
moves it there.

The red trash can, or `⌘⌫`, moves a file into `.reader/trash/`, and the
message that says so has an **Undo**. Nothing there is deleted for good
until you empty that folder yourself. A file's row with versions has no
trash can, so one click can't take them all.

## Saving

- Writes to disk about a second after you stop typing, and immediately on `⌘S`.
- Writes are atomic (temp file, then rename).
- If the file changed on disk since you opened it (say, in vim), the save is
  refused and a banner lets you **load the disk version** or **keep yours**.
  If you haven't typed anything, the app picks up outside edits quietly the
  next time its window gets focus.
- The previous version is copied to `<dir>/.reader/backups/<file>/` on every
  `⌘S` and at most every five minutes while autosaving. The last 10 are kept.
- Backups move with a file when it's renamed, branched from or made the main
  version, and stay where they are when it's in the trash.
