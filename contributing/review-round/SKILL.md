---
name: review-round
description: Answer a round of Josh's review in reader-markdown files. Use when the Send to Claude watcher fires or he says a review file is ready, and when something gets settled in chat during a review.
---

# Answer a round

A ticked box in `gh-N/review.md` is about everything in `gh-N/`, its try files included; he has probably moved on to another, so don't touch the others, and write to `review.md` only when he's unlikely to be in it. A ticked box in `review.md` is about the whole day.

Both of us write these files. A write can land over his typing, which has cost him a manual merge (gh-218). So read the file again right before writing, change only what you mean to, and if what you expected isn't there, stop and look, since he's probably just edited it. Take his change as the current state.

## For each `~#` aside or waiting card

Find them with `node ~/code/jzheaux/reader/.claude/tools/asides-open.mjs <day folder>`.
He closes a thread with `~# [x]` and his closing words, gh-199's syntax ahead of time; the script takes that as closed, so don't answer it, and treat what it closed as settled.
That only finds asides and retro cards, so always read the whole sent file too: he may have added a section, a box or a note, and a tick with nothing listed is still a tick.

1. **Check before answering.** Does it already work? Say so before filing or building anything. Read the code rather than remembering it, and try it if you can: a claim you checked is worth far more than one you recall.
2. Answer with `~c` directly under it, or `A (Claude):` on a retro card. One sentence per line.
3. **Rewrite the bullet in the same edit,** if the answer changes where things stand. The bullet always says the current state, and the aside stays as the history.
4. If the idea sounds off to you, say so, gently, with why and one or two alternatives, then build what he chooses. Show alternatives only if he asks, or if you're very confident a picture shows something he's missing. He often learns by playing with what he asked for, so this is pushback, not refusal.
5. Give a proposal its own buttons, as `review-open` sets out: `- Q (Claude): …?`, with `- ( ) Yes` and `- ( ) [@ Something else]` indented under it, so that he can answer each one, or say what instead.
   An aside is for the side conversation, not for proposals. When one leads to proposals, end the aside with `Proposals in "<heading>".` and put them under that heading, beneath what they're about. When it ends in a fix instead, the aside names the fix: `Fixed in <hash>.` A changed proposal is rewritten in place. A dropped one is struck and loses its `( )`, then gets `A (Claude): Replaced by "<name>".` A picked choice is an answer, as an aside is, so read for them as well.
6. If a second thread touches a decision open elsewhere, say so right there, and point to it by a name he can search for. Line numbers move, and links can't name a heading until gh-244.

## When something settles

- **Settled in chat:** add `Decision:` under the item right then, with why and what was turned down. Old decisions stay, struck through. Chat is faster, but it's lost in a crash, and the file is the record.
- Tick the staged box's stage, and give a Done item its `Outcome:`.
- When an item is Done, move it to **Done** at the bottom of the index, so that what's open stays at the top. (Until gh-242 folds them.)
- **A thread that gets long:** suggest breaking it out into a file of its own.
- Ask whether a piece exists only to support another before building it: "This warning is here because the icon disappears; should it disappear?"
- Fixes during review are commits ending `Polish gh-N` on the branch. If the server's code changed and he's looking, say so first.
- An issue filed to be done in this batch, as the release review's often are, joins it: run `batch-start` on it before its first commit (see "When an issue joins later" there).

## Finish the round

- Untick his **Send to Claude**, so that he knows it's done.
- Start the watcher again, in the background: `node ~/code/jzheaux/reader/.claude/tools/send-watch.mjs ~/Documents/self/io/reader/meetings 2000 --once`. Don't tell him each time.
- In chat: only what he needs, and what's next.
