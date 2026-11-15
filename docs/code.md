---
title: Code
---

← [Contents](index.md)

## Highlighting

A code fence is highlighted for its language (`c`, `bash`, `asciidoc`,
`js`, and the rest highlight.js knows); a fence in a language it doesn't
know, or none, is left plain.

## Copying

A copy button in a fence's bottom-right corner, the same icon as the
files list's Make a copy, shown when the fence is pointed at or the
button is reached by Tab, copies its code as typed: without line numbers
or callouts' `<1>` marks. A tick shows in its place for a moment after. An `output` fence has none, and there's none on a slide, on
paper or in an exported page.

## Picking out lines

Braces after the language pick out lines, counted from 1 inside the fence:
`{3,5-7}` makes them stand out and the rest fade, and `{numbers}` numbers
every line. Ranges separated by `|` take turns: on a slide, the first stands
out when the fence appears, and each `n` moves on to the next.

::: tabs
+++ Source
````markdown
```c {numbers 2|4-5}
#include <stdio.h>
int main(void) {
  printf("hi\n");
  return 0;
}
```
````
+++ Rendered
```c {numbers 2|4-5}
#include <stdio.h>
int main(void) {
  printf("hi\n");
  return 0;
}
```
:::

## Callouts

A line can carry a note, as AsciiDoc's callouts do: `<1>` at the end of
the line, after a space or in a comment of its own (`// <1>`), and the
note right after the fence. The marker becomes a numbered badge, and the
notes a list under the code; hovering a note marks its line, and the
other way round.

::: tabs
+++ Source
````markdown
```java
numbers.stream()
  .gather(Gatherers.scan(() -> 0, Integer::sum)) <1>
  .forEach(System.out::println); // <2>
```
<1> `scan()` emits the running sum so far
<2> one line per running sum
````
+++ Rendered
```java
numbers.stream()
  .gather(Gatherers.scan(() -> 0, Integer::sum)) <1>
  .forEach(System.out::println); // <2>
```
<1> `scan()` emits the running sum so far
<2> one line per running sum
:::

On a slide, the code appears with none of its lines picked out, and each
`n` moves to the next callout, showing its note. Braces that pick out lines
take over the steps, and each note shows when its line first stands out.

## Output

What the code prints goes in an `output` fence right after it. It's
drawn attached under the code, tinted and bold, and a callout can mark
its lines too, with the notes after both fences.

::: tabs
+++ Source
````markdown
```java
numbers.stream().gather(Gatherers.scan(() -> 0, Integer::sum)).forEach(System.out::println);
```
```output
1
3
6
```
````
+++ Rendered
```java
numbers.stream().gather(Gatherers.scan(() -> 0, Integer::sum)).forEach(System.out::println);
```
```output
1
3
6
```
:::

On a slide, the output appears with the first callout in it, or as a step
of its own after the code's. Output longer than 12 lines is cut short, with
a link to show all of it; on a slide or on paper, it's whole.

## More than one language

The same code in more than one language goes in a `tabs` block; see
[Layout](layout.md).
