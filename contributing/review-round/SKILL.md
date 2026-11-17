---
name: review-round
description: Answer a round of the contributor's review in reader-markdown files. Use when the Send watcher fires or they say a review file is ready, and when something gets settled in chat during a review.
---

# Answer a round

`<ai>` stands for your name in the config (see `contributing/README.md`), `Claude` unless set.

A ticked box in `gh-N/review.md` is about everything in `gh-N/`, its try files included; they've probably moved on to another, so don't touch the others, and write to `review.md` only when they're unlikely to be in it. A ticked box in `review.md` is about the whole day.

Both of us write these files. A write can land over their typing, which has cost a manual merge (gh-218). So read the file again right before writing, change only what you mean to, and if what you expected isn't there, stop and look, since they've probably just edited it. Take their change as the current state.

## Several at once

The watcher wakes you for every box ticked since it last looked, and they keep reviewing while you work, so a send mustn't wait behind a build.

- **Do it yourself** when `npm test` and lint are enough to know it's right: answers, asides, issues, tries, outcomes, docs, skills and contributing scripts, a test to update, a one-line fix a unit test covers.
- **Hand it to a fork** (the Agent tool's `fork`, which keeps this conversation) when it's checked with `browse.mjs`, as anything seen or clicked is; when it touches more than one feature; when its cause isn't known yet; or when it builds a whole issue. Reproduce it first yourself, as the answer needs it, and give the fork what you found and the steps. It works in a worktree of its own off the review branch (`.claude/worktrees/`), commits there, checks it in every browser, and reports; it can't ask them anything, so where it's unsure it stops and says so.
- **Something you started that grows** past that line goes to a fork with what you'd found, rather than your finishing it.
- **Only you merge,** one fork's work at a time, onto the review branch, with the tests run, and only you write the index. One job runs for an item at a time: a second send on it waits for the first. Safari Technology Preview runs one session at a time, so its checks take turns.
- Say in the reply what went to a fork, and answer what you can meanwhile; when its work is merged, say so there, and that the page needs reloading.

## For each `~#` aside or waiting card

Find them with `node scripts/asides-open.mjs <day folder>`.
They close a thread with `~# [x]` and their closing words, gh-199's syntax ahead of time; the script takes that as closed, so don't answer it, and treat what it closed as settled.
That only finds asides and retro cards, so always read the whole sent file too: they may have added a section, a box or a note, and a tick with nothing listed is still a tick.

1. **Check before answering.** Does it already work? Say so before filing or building anything. Read the code rather than remembering it, and try it if you can: a claim you checked is worth far more than one you recall.
2. Answer with `~~c` directly under it, a reply in their thread, or `A (<ai>):` on a retro card. Never `~c`, which is an aside of its own: closing their thread leaves it open, and `asides-open` lists it to be made `~~c`. One sentence per line.
   Each line after the first is indented past the `~`, two spaces, as `docs/asides.md` asks; one that isn't reads as the page's text, not the reply (until gh-305 reads the same alias again as the same aside).
3. **Rewrite the bullet in the same edit,** if the answer changes where things stand. The bullet always says the current state, and the aside stays as the history.
4. If the idea sounds off to you, say so, gently, with why and one or two alternatives, then build what they choose. Show alternatives only if they ask, or if you're very confident a picture shows something they're missing. People often learn by playing with what they asked for, so this is pushback, not refusal.
5. Give a proposal its own buttons, as `review-open` sets out: `- Q (<ai>): …?`, with `- ( ) Yes` and `- ( ) [@ Something else]` indented under it, so that they can answer each one, or say what instead.
   An aside is for the side conversation, not for proposals. When one leads to proposals, end the aside with `Proposals in "<heading>".` and put them under that heading, beneath what they're about. When it ends in a fix instead, the aside names the fix: `Fixed in <hash>.` A changed proposal is rewritten in place. A dropped one is struck and loses its `( )`, then gets `A (<ai>): Replaced by "<name>".` A picked choice is an answer, as an aside is, so read for them as well.
6. If a second thread touches a decision open elsewhere, say so right there, and point to it by a name they can search for. Line numbers move, and links can't name a heading until gh-244.

## When something settles

- **Settled in chat:** add `Decision:` under the item right then, with why and what was turned down. Old decisions stay, struck through. Chat is faster, but it's lost in a crash, and the file is the record.
- Tick the staged box's stage, and give a Done item its outcome, as `review-open` says: an aside, `~co …`, in the margin under what it settles, never among its choices.
- When an item is Done, move it to **Done** at the bottom of the index, so that what's open stays at the top. (Until gh-242 folds them.)
- **A criterion added to an item already done reopens it,** so that it's plain there's more to do: in its file, untick `# [ ] Review` and `## [ ] Acceptance Criteria`; in the index, move it back to **Please look**, with none of its stages ticked, and a line under it saying what's new.
- **A thread that gets long:** suggest breaking it out into a file of its own.
- Ask whether a piece exists only to support another before building it: "This warning is here because the icon disappears; should it disappear?"
- Fixes during review are commits ending `Polish gh-N` on the branch. If the server's code changed and they're looking, say so first.
- An issue filed to be done in this batch, as the release review's often are, joins it: run `batch-start` on it before its first commit (see "When an issue joins later" there).

## Finish the round

- Run `asides-open` again, and indent any line of yours it lists under "To check" that's a reply run on; one that's the page carrying on below an aside stays.
- Untick their **Send to <ai>**, so that they know it's done.
- Start the watcher again, in the background: `node scripts/send-watch.mjs 2000 --once`. It watches every day folder. Don't tell them each time.
- In chat: only what they need, and what's next.
