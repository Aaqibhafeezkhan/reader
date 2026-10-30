---
title: Links
---

← [Contents](index.md)

A few kinds of link are written as a name, a colon and brackets, so a
reference reads as itself in the file and links on the page. As with
emoji, the file keeps what you typed.

## Scripture

`scripture:` makes a link to Blue Letter Bible, in the RSV unless a version
follows a comma:

| You write | Links to | Shows |
| --- | --- | --- |
| `scripture:[Isaiah 2:1-5]` | `blueletterbible.org/rsv/isaiah/2/1-5` | Isaiah 2:1-5 |
| `scripture:[Isaiah 2:1-5, NIV]` | `blueletterbible.org/niv/isaiah/2/1-5` | Isaiah 2:1-5, NIV |
| `scripture:isaiah/2/1-5[plowshares]` | `blueletterbible.org/rsv/isaiah/2/1-5` | plowshares |

::: tabs
+++ Source
```markdown
Swords into scripture:isaiah/2/1-5[plowshares] (scripture:[Isaiah 2:1-5, NIV]).
```
+++ Rendered
Swords into scripture:isaiah/2/1-5[plowshares] (scripture:[Isaiah 2:1-5, NIV]).
:::

References in code, and bracketed text that doesn't read as
`Book ch[:vs]`, are left as written.

`scripture-lds:` does the same for any of the standard works -- Bible, Book
of Mormon, Doctrine and Covenants, Pearl of Great Price -- on
churchofjesuschrist.org. Books go by their full names or the usual short ones
(`1 Ne`, `D&C`, `JS—H`, `A of F`):

| You write | Links to | Shows |
| --- | --- | --- |
| `scripture-lds:[D&C 88:26]` | `…/dc-testament/dc/88?lang=eng&id=p26#p26` | D&C 88:26 |
| `scripture-lds:[1 Nephi 3:7]` | `…/bofm/1-ne/3?lang=eng&id=p7#p7` | 1 Nephi 3:7 |
| `scripture-lds:[Articles of Faith 13]` | `…/pgp/a-of-f/1?lang=eng&id=p13#p13` | Articles of Faith 13 |
| `scripture-lds:dc/88/26[quickened]` | `…/dc-testament/dc/88?lang=eng&id=p26#p26` | quickened |

## RFCs

`rfc:` does the same for the RFC Editor. The brackets are required; left empty,
they read as the RFC's name:

| You write | Links to | Shows |
| --- | --- | --- |
| `rfc:9110[]` | `rfc-editor.org/rfc/rfc9110.html` | RFC 9110 |
| `rfc:9110#section-15.5[]` | `rfc-editor.org/rfc/rfc9110.html#section-15.5` | RFC 9110 §15.5 |
| `rfc:6749[OAuth 2.0]` | `rfc-editor.org/rfc/rfc6749.html` | OAuth 2.0 |

::: tabs
+++ Source
```markdown
A 404 is in rfc:9110#section-15.5[], and the flows are in rfc:6749[OAuth 2.0].
```
+++ Rendered
A 404 is in rfc:9110#section-15.5[], and the flows are in rfc:6749[OAuth 2.0].
:::

## Searches

`search:` makes a Google search, for something to look into later. It shows
with a dotted underline and a ⌕. Spaces in the bracket become `+` in the
query, so these two are the same search:

| You write | Searches for | Shows |
| --- | --- | --- |
| `search:[commensality]` | commensality | commensality |
| `search:[My Many Worded Term]` | My+Many+Worded+Term | My Many Worded Term |
| `search:my+many+worded+term[My Many Worded Term]` | my+many+worded+term | My Many Worded Term |

::: tabs
+++ Source
```markdown
Look into search:[commensality] later.
```
+++ Rendered
Look into search:[commensality] later.
:::

## Profiles

`linkedin:`, `bluesky:`, `gh:`, `fb:`, `insta:` and `yt:` say where to
find someone: a link to that profile, with the site's mark before it. Words
in the brackets are shown instead of the address.

| You write | Links to | Shows |
| --- | --- | --- |
| `linkedin:jzheaux[]` | `linkedin.com/in/jzheaux` | linkedin.com/in/jzheaux |
| `linkedin:company/vmware[]` | `linkedin.com/company/vmware` | linkedin.com/company/vmware |
| `bluesky:jzheaux[]` | `bsky.app/profile/jzheaux.bsky.social` | @jzheaux.bsky.social |
| `bluesky:jzheaux.dev[]` | `bsky.app/profile/jzheaux.dev` | @jzheaux.dev |
| `gh:jzheaux[]` | `github.com/jzheaux` | github.com/jzheaux |
| `gh:jzheaux/reader#25[]` | `github.com/jzheaux/reader/issues/25` | jzheaux/reader#25 |
| `gh:jzheaux/reader@f61f000[]` | `github.com/jzheaux/reader/commit/f61f000` | jzheaux/reader@f61f000 |
| `fb:jzheaux[]` | `facebook.com/jzheaux` | facebook.com/jzheaux |
| `insta:jzheaux[]` | `instagram.com/jzheaux` | @jzheaux |
| `yt:jzheaux[]` | `youtube.com/@jzheaux` | @jzheaux |
| `yt:v/FcWl8WgKP8E[]` | `youtube.com/watch?v=FcWl8WgKP8E` | youtu.be/FcWl8WgKP8E |
| `gh:jzheaux[my GitHub]` | `github.com/jzheaux` | my GitHub |

::: tabs
+++ Source
```markdown
- gh:jzheaux[my GitHub], and gh:jzheaux/reader#25[]
- bluesky:jzheaux[]
- yt:jzheaux[]
```
+++ Rendered
- gh:jzheaux[my GitHub], and gh:jzheaux/reader#25[]
- bluesky:jzheaux[]
- yt:jzheaux[]
:::

A YouTube video goes by its own path, `yt:v/<id>`, as a LinkedIn company does, since a handle can look like a video's id.

## Linking, or showing

Markdown draws a line between linking to something and showing it: `[text](url)` links, and `![alt](url)` shows.
Each of the short links above follows it too.
What goes before its brackets is a URL, for a markdown link or image, and the link's words stand for the brackets:

| You write | Means |
| --- | --- |
| `yt:v/FcWl8WgKP8E[Body scan]` | a link, with the site's mark |
| `[Body scan](yt:v/FcWl8WgKP8E)` | the same link, as a markdown link |
| `![Body scan](yt:v/FcWl8WgKP8E)` | what it links to, on the page |
| `[plowshares](scripture:isaiah/2/1-5)` | the same as `scripture:isaiah/2/1-5[plowshares]` |
| `[Isaiah 2:1-5](scripture:)` | the same as `scripture:[Isaiah 2:1-5]` |

Each kind of link decides what it shows.
Until one has something to show, `![]()` is just the link, its alt text the words, so nothing breaks.
Videos come first; a passage's text, an issue's card or an RFC's section may follow.
Elsewhere, a markdown reader can't load `![alt](yt:...)` as an image, so it shows the alt text, and the file still reads as plain text.

::: tabs
+++ Source
```markdown
- Breathe with [a body scan](yt:v/FcWl8WgKP8E).
- ![The 404](rfc:9110#section-15.5), and [the ticket](gh:jzheaux/reader#196).
```
+++ Rendered
- Breathe with [a body scan](yt:v/FcWl8WgKP8E).
- ![The 404](rfc:9110#section-15.5), and [the ticket](gh:jzheaux/reader#196).
:::

### Videos

`![alt](yt:v/<id>)` puts a YouTube video on the page, from `youtube-nocookie.com`.
A channel, `![](yt:jzheaux)`, is still a link.

What it is depends on whether the page is being written or run:

| Where | What it is |
| --- | --- |
| Edit | a card: the video's thumbnail, the alt text as its caption; press it and the player takes its place and starts |
| Work, and a slide | YouTube's player from the start, stopped; one press on its own play button plays it, with sound |
| the overview, the speaker view | the card |
| an exported page | the card, as a link to the video on YouTube |

In Edit the page is drawn again at each keystroke, so nothing is asked of YouTube's player until the card is pressed, by a click or with Enter or Space; the thumbnail is an image, as any image on the web is.
Safari won't start a video with sound from a press on the card, so there it starts muted, to be turned up in the player.
Typing above it while it plays leaves it playing, in a browser that can move it without loading it again (Chrome, Edge and the desktop app); elsewhere it's put back, stopped.

Work and a deck are shown a page or a slide at a time, so YouTube is asked for a video only once its page is turned to.
A video that's no longer on the page, a line taken out or another slide, stops.

As a radio or task item, the box is named for the video and still records the choice in the file; playing is the video's own business, and writes nothing.
So a video plays in a record that can no longer be worked (`open-until:`), and on a slide, where boxes can't be ticked.

::: tabs
+++ Source
```markdown
- ( ) ![Body scan · 5 minutes](yt:v/FcWl8WgKP8E)
- ( ) ![Morning stretch](yt:v/w6iG0mNHK28)
```
+++ Rendered
- ( ) ![Body scan · 5 minutes](yt:v/FcWl8WgKP8E)
- ( ) ![Morning stretch](yt:v/w6iG0mNHK28)
:::

In Edit, Rendered shows two cards; press `⌘.` for Work and each is the player.

A link to an image, `![](photo.jpg)`, is drawn as it always was, and so is a definition's `!term`: `![` starts an image, never a term.

## Other files

A relative link to another markdown file opens it in reader, as a link
does on the web. `⌘`-click or `⇧`-click still opens it in a tab of its own,
as text, and so does a link on a slide, so the deck doesn't give way to
another file. Images and links in a note resolve relative to that note, so
`![](photo.jpg)` next to the file works.

```markdown
→ [Spring Security 7](spring-security-7.md)
```

## Images, on hover

A link to an image (`.png`, `.jpg`, `.gif`, `.webp`, `.svg`, `.avif`) shows
the image while you hover it, on a slide and in the rendered page:

```markdown
- Hi, I'm [Josh Cummings](images/bio-me.jpg)
```
