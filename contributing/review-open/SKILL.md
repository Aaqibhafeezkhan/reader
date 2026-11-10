---
name: review-open
description: Lay out a review of a finished batch of reader work and hand it to Josh. Use when a review/YYYY.MM.DD branch's issues are merged and it's ready to look at, or when asked to write up a batch for review.
---

# Open a review

The tools are in the main checkout, `~/code/jzheaux/reader/.claude/tools/`. Reviews live in `~/Documents/self/io/reader/meetings/<date>/`; `.claude/days` is a symlink to it. `<date>` is the branch's review date.

The file is the decision of record, and Josh reads it in reader. Write reader-markdown, and re-read the relevant page of `docs/` for syntax you aren't sure of. One sentence per line, so that an aside can go under any of them.

## 1. Sort the items

- **Please look:** anything you want Josh to look over, because it's likely to change, or it needs his eye or a decision. Each gets its own file.
- **Done, nothing to look at:** clean-up and anything clearly understood. It stays one line in the index, and its issue is its record.

## 2. Lay it out

```sh
node ~/code/jzheaux/reader/.claude/tools/review-open.mjs <date> --branch review/<Y.M.D> --tag <milestone> --look 221,237 --done 240,116
```

Give `--look` in the order he should look at them; the index lists them in that order. It writes `review.md` (the index), a folder `gh-N/` for each item to look at, holding its `review.md` and `shots/`, and `retro.md` with the last retro's untried Tries carried in. Then replace every `<fill>`. `review-close` fails on any that's left.

## 3. Fill in the index, `review.md`

- **The first lines answer "where are we?"**: the branch, counts of issues, commits and tests, whether lint is clean, what's pushed.
- **The order** is: where we are and **Send to Claude**; **Please look**; **Done, nothing to look at**; **Found along the way**; and last, `## [ ] Before merging`, so that the page reads as the merge waiting on everything above it.
- **Before merging** lists what only Josh can do about the whole batch, as `- [ ]`, then **Waiting on me**, **Waiting on a contributor** and what's left in the milestone, and ends with "Then: fast-forward `main`, push." as its last box. Never a box to look at the items, which their staged boxes and `# [ ] Review` already say, and never a check for one item, which goes in its **Acceptance Criteria**.
- **Please look** items go in the order to look at them, said in a line above them ("Start with gh-237, as …"). Each is a `###` heading named for what it does, so that the outline lists it, with its staged box and one line of status under it.
- An item that needs him to check it in a browser is not **Done, nothing to look at**: it goes under **Please look**, with its browsers in its **Acceptance Criteria**.
- Staged boxes, for **Please look** items only, come from the front matter's `multibox:` / `stages: heard, agreed, done`. Heard: I've explained it. Agreed: we've settled it. Done: it's finished, and it names its outcome.
- Link issues as `gh:jzheaux/reader#N[gh-N]`.

## 4. Fill in each item, `gh-N/review.md`

Everything about an item lives in its folder: its `review.md`, its try files (`try-<what>.md`) or folders (`try-<what>/`), and `shots/`. A **Done, nothing to look at** item has no folder, **Found along the way** stays in the index, and a retro's side pages go in `retro/`.

Its shape follows Josh's sample in `meetings/2026-11-08/gh-xxx/review.md`: it reads in the order he looks, what it is, trying it, what's left to accept, then closing. Always these headings, in this order:

- **`# [ ] Review`**, with `progress:[]` under it, straight after **Send to Claude**, so he sees at the top whether the item is done. It shows **✓ Done** once everything under it is.
- **`## Changes`** says what someone sees now, with what you decided and anything beyond the issue. Say what any supporting piece is for, and what it costs, and give any **`Contortion:`** here: if making something work took something non-standard, say what, why, and what it might cause, straight away rather than when it breaks, including what agents flagged. Link files on the branch by their path in backticks until gh-263 gives a link for them.
- **`## Tries`**: one `Try:` card for each thing to try, `Try: [what it shows](try-<what>.md).`, with a line under it on what to look for. He ticks it, `Try [x]:`, once he's tried it, and his threads go under it as asides. Try files and folders sit in the item's folder, named for what they show (`gh-213/try-done-section.md`, or `gh-197/try-daily-journal/` for a series), more than one if it needs them, and targeted rather than a big tour. Examples are what Josh values most: every item that changes what's seen gets a screenshot or a try file, and if it can't, say why. Anything touching colour gets light, dark and contrast side by side. Before and after where it helps. Link every screenshot from the sentence about it (`[shot](shots/nine-pages.png)`, relative to the item's folder), as pictures don't show in reader's file list.
- **`## [ ] Acceptance Criteria`**, with `progress:[]` and "All the following criteria must be accepted for this review to be complete." Then a `1)` list with a box for each criterion, `1) [ ] …`, in this order:
  - **Browsers first,** one each. Tick what you checked yourself and say how: `npm run shots` for Chromium, Firefox, WebKit and phone sizes; `safaridriver -p <port>` with WebDriver for real Safari, which is the real check, as Playwright's WebKit isn't Safari. For clicks, taps, drags and shots in a browser, use `node ~/code/jzheaux/reader/.claude/tools/browse.mjs <file> --steps <steps.json> --repo <worktree> --browser chromium|webkit|safari [--phone]`, never a one-off script; it says on each drag whether the touch was real (Chromium) or made in the page (WebKit), which is worth saying in the criterion. `--browser safari` is Safari Technology Preview, never his own Safari, and only runs outside the sandbox. Say what remains for his real phone (`:iphone:`). Keep only the browsers an item can be checked in, and remove the rest, as a box with nothing to do is noise. Name a browser in words until gh-264 gives `:chrome:` and the rest.
  - **Each open point,** as a bold name in words (`**A kept day, or a blank one?**`, never "Point 3"), what it's about, then its question: `Q (Claude): …?`, with `- ( ) Yes` and `- ( ) [@ Something else]` under it, or named options in place of Yes, such as milestones. Never `No, because:`, which has nowhere to type. Related questions for one point are `a)`, `b)` under it. Inside a criterion, `Q (Claude):` reads as plain text until gh-253 and gh-254 let it nest, though its choices work.
  - **Things only to make him aware,** with no question.
  - **Settled decisions,** in place of a Decisions section: what was decided, why, and what was turned down (`Turned down: …`). Tick them yourself.
- **A criterion's box means he accepts it,** which is apart from picking its choice: picking answers the question, and ticking says the criterion is met. Don't tick one he hasn't, unless it's a settled decision or a dropped one.
- **A dropped criterion** is struck, `~~…~~`, with "No longer applies:" and why after it, and ticked. A question that changes is rewritten in place, and the asides keep the history; one replaced by another is struck, its options lose their `( )`, then `A (Claude): Replaced by "<name>".`, pointing by a name he can search for.
- Add `Outcome:` under a criterion once settled: `Outcome: gh-N filed`, `Outcome: <hash>`, or `Outcome: no change, because …`.
- **`## Closing`**: compare the issue with what shipped and give your reasoning, then `Q (Claude): Does gh-N still describe what shipped?` with its four choices: the issue stands; it stands, with a closing comment on what went beyond it; a PR replaces it; or something else.
- Something only to make him aware gets a plain box, never the three stages: every line under **Done, nothing to look at**, and anything like it in an item.

## 5. Before handing over

- Check every claim against the branch: run tests and lint, count commits, open the screenshots yourself. A subagent's report isn't evidence until you've looked. Don't write a commit's hash before it exists.
- Render the index and an item to be sure boxes and headings came out as boxes and headings.
- `node ~/code/jzheaux/reader/.claude/tools/asides-open.mjs <day folder>`, and check **Before merging** and each item's **Acceptance Criteria** and **Tries** against its "Waiting on you", which lists every unticked criterion and untried `Try:`.
- PRs: only for an issue that no longer describes what shipped, whether or not it was looked at, as a PR takes the issue's place in the release notes. Compare the issue with what shipped, and give your reasoning, rather than going by which section it's in. It's asked in each item's `## Closing`, with four choices: the issue stands; it stands, with a closing comment on what went beyond it; a PR replaces it; or something else. A **Done, nothing to look at** line says that its issue still describes what shipped; if it doesn't, the item goes under **Please look**. Never ask it in **Before merging**. Its description, finished just before it merges, says what shipped, why, and what was turned down. Pushing is outward, so ask for a clear yes first, on its own.

## 6. Hand over

- Start the watcher as a **background Bash command** (`run_in_background`), not a Monitor, which expires every 30 minutes:
  `node ~/code/jzheaux/reader/.claude/tools/send-watch.mjs ~/Documents/self/io/reader/meetings 2000 --once`
  It wakes you at the first ticked box. Use `review-round`.
- Tell him in chat: where it is, the command to run, and what's first. If the change touches the server and he's already running it, say so in the first line.
