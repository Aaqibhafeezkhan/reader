---
name: retro
description: Run a retro of a review round in reader-markdown with Josh, one discussion at a time. Use when he asks for a retro, for goods, bads and tries, or to go through retro items.
---

# Run a retro

`retro.md` sits in the day's folder, with the last retro's untried Tries already carried in by `review-open`. If it isn't there, get them with `node ~/code/jzheaux/reader/.claude/tools/retro-carry.mjs <last retro.md>`.

## Write the cards

Before writing, gather evidence rather than going from memory: the review file, the commits, whether earlier Tries really happened. If you've lost part of the conversation, say so at the top of the file.

- Syntax is in `docs/notes.md`: `Good (Claude):`, `Bad (Claude):`, `Try (Claude):`. Answers are `A (Claude):`. Continuation lines carry straight on, with no blank line, and each sentence on its own line. Don't start a continuation line with `Good:`, as each of those is a card of its own.
- Keep code on one line inside a card, since a fence ends it.
- Be honest about your own misses, especially promises from the last retro. Cover what he asks about: the watcher, the back-and-forth, how well what's left is understood, the quality of his input.
- Answer each carried Try: did it happen, how did it go, and what now?

## One discussion at a time

When he says he's answered:

1. Re-read from where you were.
2. Close what's settled, top to bottom: `Good [x] (Claude):`, including any answer the card now needs, such as an outcome or a thing you did. A `+1` or a thumbs-up closes a card.
3. **A Try's `[x]` means tried,** not discussed. A Try we agree on but haven't tried stays unticked, and is carried to the next retro. Reply so that it's clear the discussion is finished.
4. Do what he's agreed to before moving on. File the issue, set the milestone, and put the outcome on the card. Something agreed that can't be done during the retro ends its card with `Outcome: <what>, waiting on me`; `batch-start` lists it until a later `Outcome:` on that card says it's done or filed.
5. At the first card that's still open, write your answer in the file, with numbered proposals, and **stop**. Check what you're saying first: tonight's answers got better every time the code was read before replying.
6. In chat, say what closed and what you've paused on, with the proposals repeated, so that he needn't open the file to answer.

Stay on that discussion until you both feel it's done. Questions he hasn't answered are still open: ask again rather than assuming, or state your assumption on the card.

Agreed conventions go into the skills that use them, so that they apply next time.
