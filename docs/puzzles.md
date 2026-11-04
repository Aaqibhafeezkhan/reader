---
title: Puzzles
---

← [Contents](index.md)

A fence named for a puzzle is drawn as the puzzle and can be played right
on the page, in edit, work and present modes alike. The fence's text *is*
the puzzle and the progress made on it: each move is written back into the
file, saved like typing, so it's there next time and reads as plain text
anywhere else. Click a puzzle (or Tab to it) to play; while it has focus it
takes the keys, and `Esc` hands them back, leaving it in focus till `Enter`
takes them again. `?` shows them. A screen reader hears where each key
leaves you: the square you're on and what's in it. A puzzle can sit in a
quote or a list too.

There are five so far: `sudoku`, `tracks`, `wordsearch`, `coord` and
`maze`.

## Starting over

A [Start over](forms.md#starting-over) button puts each puzzle in its section back to its start, in the same edit as the section's boxes and fields, so one undo brings it all back.
The puzzle is fresh: nothing's selected, and it no longer says it's solved.
**Start today's** does the same for a [file started from the latest](files.md).
A puzzle with no moves in it isn't written to.

Each kind keeps its progress in its own text, so each goes back its own way, and keeps what the puzzle gave:

| Kind | What goes | What stays |
| --- | --- | --- |
| `sudoku` | the numbers filled in, so the board reads as the givens again, and `notes:` | the givens |
| `tracks` | the light and half pieces, and every `×`, which become `·` | the heavy pieces, the counts, and A and B |
| `wordsearch` | `found:` and `marks:` | the letters and `words:` |
| `coord` | the points plotted, as `plotted: 0` | the grid and the points |
| `maze` | what's in `path:` and `notes:` | the maze |

A puzzle whose board is kept in a file is only written to in its fence, and its file is never touched.

::: tabs
+++ Source
````markdown
```coord
grid: 6 x 4
(1, 1) (5, 1) (3, 3) (1, 1)
plotted: 3
```

reset:[]
````
+++ Rendered
```coord
grid: 6 x 4
(1, 1) (5, 1) (3, 3) (1, 1)
plotted: 3
```

reset:[]
:::

## Sudoku

::: tabs
+++ Source
````markdown
```sudoku
5 3 . | . 7 . | . . .    5 3 4 | . 7 . | . . .
6 . . | 1 9 5 | . . .    6 . . | 1 9 5 | . . .
. 9 8 | . . . | . 6 .    . 9 8 | . . . | . 6 .
------+-------+------    ------+-------+------
8 . . | . 6 . | . . 3    8 . . | . 6 . | . . 3
4 . . | 8 . 3 | . . 1    4 . . | 8 . 3 | . . 1
7 . . | . 2 . | . . 6    7 . . | . 2 . | . . 6
------+-------+------    ------+-------+------
. 6 . | . . . | 2 8 .    . 6 . | . . . | 2 8 .
. . . | 4 1 9 | . . 5    . . . | 4 1 9 | . . 5
. . . | . 8 . | . 7 9    . . . | . 8 . | . 7 9
notes: r1c4=26 r2c2=47
```
````
+++ Rendered
```sudoku
5 3 . | . 7 . | . . .    5 3 4 | . 7 . | . . .
6 . . | 1 9 5 | . . .    6 . . | 1 9 5 | . . .
. 9 8 | . . . | . 6 .    . 9 8 | . . . | . 6 .
------+-------+------    ------+-------+------
8 . . | . 6 . | . . 3    8 . . | . 6 . | . . 3
4 . . | 8 . 3 | . . 1    4 . . | 8 . 3 | . . 1
7 . . | . 2 . | . . 6    7 . . | . 2 . | . . 6
------+-------+------    ------+-------+------
. 6 . | . . . | 2 8 .    . 6 . | . . . | 2 8 .
. . . | 4 1 9 | . . 5    . . . | 4 1 9 | . . 5
. . . | . 8 . | . 7 9    . . . | . 8 . | . 7 9
notes: r1c4=26 r2c2=47
```
:::

Each row is the puzzle as given, then the board as played; givens can't be
overwritten. Only digits and dots count, so the bars and rules are just for
the eye, and a fresh puzzle can leave the board out. `notes:` holds pencil
marks by row and column. A number repeated in a row, column or box shows
red; a full board with none says so.

| | |
| --- | --- |
| `←` `→` `↑` `↓` | move |
| `1`–`9` | fill in a number (again to erase it) |
| `⇧1`–`⇧9` | pencil mark |
| `n` | pencil marks on / off |
| `⌫` `0` | erase |

## Train tracks

One track from A to B, never branching or crossing itself; the numbers say
how many squares in each column and row it runs through.

::: tabs
+++ Source
````markdown
```tracks
1 2 1 3
━ ┐ · ·  2
· └ · ·  3
· · · ·  1
· · · ·  1
A: left 1  B: bottom 4
```
````
+++ Rendered
```tracks
1 2 1 3
━ ┐ · ·  2
· └ · ·  3
· · · ·  1
· · · ·  1
A: left 1  B: bottom 4
```
:::

The first line is the column counts, then each row of squares with its
count, then the edge (`left`, `right`, `top`, `bottom`) and row or column
where the track comes in and goes out. A square shows its track: heavy
pieces (`━ ┃ ┏ ┓ ┗ ┛`) were given, light ones (`─ │ ┌ ┐ └ ┘`) were laid, a
half piece (`╴ ╵ ╶ ╷`) is track laid in but not yet out, `×` is a square
marked as having none, and `·` is undecided. A count turns green when its
row or column has that many squares of track, red when it has more; a
finished track says so.

| | |
| --- | --- |
| `←` `→` `↑` `↓` | move |
| `⇧` + arrow, or drag | lay track that way; again (or drag back) to pick it up |
| `x`, or double-click | mark a square with no track |
| `⌫` | clear a square |

## Word search

::: tabs
+++ Source
````markdown
```wordsearch
E B E L I E V E X
H O N E S T Q R P
A B L E Z K C U I
words: ABLE, BELIEVE, HONEST
found: BELIEVE r1c2-r1c8, HONEST r2c1-r2c6
marks: NEST r2c3-r2c6
```
````
+++ Rendered
```wordsearch
E B E L I E V E X
H O N E S T Q R P
A B L E Z K C U I
words: ABLE, BELIEVE, HONEST
found: BELIEVE r1c2-r1c8, HONEST r2c1-r2c6
marks: NEST r2c3-r2c6
```
:::

The letters a row to a line (the spaces between them are for the eye), the
words to find, and those found so far, each with the row and column of its
first and last letters. A word runs in a straight line in any of the eight
directions; a space in a word isn't in the grid. A listed word, circled,
is ringed in color and crossed off the list. Anything else circled -- a
word that isn't listed, or the start of one that is -- stays ringed in
gray under `marks:`, and goes when circled again, or when a listed word is
found over it.

| | |
| --- | --- |
| `←` `→` `↑` `↓` | move |
| `Space` or `Enter` | start a word; again at its last letter to circle it |
| drag, or click both ends | circle a word |
| `⌫` | erase gray marks through this letter |
| `Esc` | let go of a word |

## Coordinate graph

A mystery picture, drawn point by point.

::: tabs
+++ Source
````markdown
```coord
grid: 20 x 12
(3, 1) (17, 1) (17, 9) (3, 9) (3, 1)
(2, 9) (10, 11) (18, 9) (2, 9)
plotted: 7
```
````
+++ Rendered
```coord
grid: 20 x 12
(3, 1) (17, 1) (17, 9) (3, 9) (3, 1)
(2, 9) (10, 11) (18, 9) (2, 9)
plotted: 7
```
:::

The grid's width and height, then the points, one pencil stroke to a line
(START to STOP, as the list beside the graph shows them), then how many
have been plotted, counting through the lines in order. Points are plotted
in order: the pencil goes where it's moved, and the next point is drawn
in, joined to the one before it, only if that's where it is. The axis
numbers under the pencil light up, but finding the point is up to you.

| | |
| --- | --- |
| `←` `→` `↑` `↓` | move the pencil; with `⇧`, five at a time |
| `Space` or `Enter`, or click | plot the next point there |
| `⌫` | take back the last point |

## Maze

::: tabs
+++ Source
````markdown
```maze
+--+--+--+--+
|S    |     |
+--+  +  +  +
|     |  |  |
+  +--+  +  +
|        | E|
+--+--+--+--+
path: R D L D R2
```
````
+++ Rendered
```maze
+--+--+--+--+
|S    |     |
+--+  +  +  +
|     |  |  |
+  +--+  +  +
|        | E|
+--+--+--+--+
path: R D L D R2
```
:::

The maze is drawn the way it would be on paper, with `+` at the corners,
`-` across and `|` down, or two characters to a cell, its floor and its
right-hand wall (`_` and `|`). Only the walls are read, so any other
character is open floor. `S` is where the way starts and `E` where it ends:
in a cell, or in place of a wall, for a way in through the edge. A maze
with a shape (a heart, a word) is the same: whatever the start can't get to
is never played. A big maze can be kept in a file of its own, named after
the kind (`mazes/one.maze`, after the fence's name); the fence then holds
only what's been played.

`path:` is the way taken so far from S, as moves Up, Down, Left and Right,
a number after one for more of the same (`D3` is down 3). Stepping back the
way you came takes the step off, so it's the way you're on, not every turn
tried. `notes:` are pencil marks, a row and column each (`r7c1`): wherever
you like, say to rule out a way that dead-ends.

| | |
| --- | --- |
| `←` `→` `↑` `↓` | go that way, on to the next turn-off |
| drag | draw your way (drag back to take it back) |
| `⌫` | take back one step |
| `⇧` + arrow | pencil mark the way that way, or rub it out |
| `x` | pencil mark where you are |
| right-click, `⇧`-click, or hold | pencil mark a spot, or rub it out |
| `Esc` | done for now, till `Enter` |
