---
name: review-open
description: Lay out a review of a finished batch of reader work and hand it to the contributor. Use when a review/YYYY.MM.DD branch's issues are merged and it's ready to look at, or when asked to write up a batch for review.
---

# Open a review

Reviews live in the day folders, `<meetings>/<date>/`, where `<date>` is the branch's review date. `<meetings>` is set in the config (see `contributing/README.md`), and is `.meetings/` in the main checkout unless set.
`<ai>` stands for your name in the config, `Claude` unless set.

The file is the decision of record, and the contributor reads it in reader. Write reader-markdown, and re-read the relevant page of `docs/` for syntax you aren't sure of. One sentence per line, so that an aside can go under any of them.

## 1. Sort the items

- **Please look:** anything you want the contributor to look over, because it's likely to change, or it needs their eye or a decision. Each gets its own file.
- **Done, nothing to look at:** clean-up and anything clearly understood. It stays one line in the index, and its issue is its record.

Before checking any item, ask the contributor once, for the whole batch, to let `browse.mjs --browser safari` run outside the sandbox, where safaridriver can listen. Don't skip Safari to avoid asking. If they say no, Safari is theirs to check, and each item says so.

## 2. Lay it out

```sh
node scripts/review-open.mjs <date> --branch review/<Y.M.D> --tag <milestone> --look 221,237 --done 240,116
```

Give `--look` in the order they should look at them; the index lists them in that order. It writes `review.md` (the index), a folder `gh-N/` for each item to look at, holding its `review.md` and `shots/`, and `retro.md` with the last retro's untried Tries carried in. If the branch's worktree is there, the index's first line already says where it stands, from `scripts/counts.mjs` (`--no-checks` counts without running the tests and lint). Then replace every `<fill>`. `review-close` fails on any that's left.

## 3. Fill in the index, `review.md`

- **The first lines answer "where are we?"**: the branch, counts of issues, commits and tests, whether lint is clean, what's pushed. Run `node scripts/counts.mjs <worktree>` again before handing over, if anything's been committed since.
- **The order** is: where we are and **Send to <ai>**; **Please look**; **Done, nothing to look at**; **Found along the way**; and last, `## [ ] Before merging`, so that the page reads as the merge waiting on everything above it.
- **Before merging** lists what only the contributor can do about the whole batch, as `- [ ]`, then **Waiting on me**, **Waiting on a contributor** and what's left in the milestone, and ends with "Then: push, open the PR, merge it." as its last box. Never a box to look at the items, which their staged boxes and `# [ ] Review` already say, and never a check for one item, which goes in its **Acceptance Criteria**.
- **Please look** items go in the order to look at them, said in a line above them ("Start with gh-237, as …"). Each is a `###` heading named for what it does, so that the outline lists it, with its staged box and one line of status under it.
- An item that needs them to check it in a browser is not **Done, nothing to look at**: it goes under **Please look**, with its browsers in its **Acceptance Criteria**.
- Staged boxes, for **Please look** items only, come from the front matter's `multibox:` / `stages: heard, agreed, done`. Heard: I've explained it. Agreed: we've settled it. Done: it's finished, and it names its outcome.
- Link issues as `gh:<owner>/<repo>#N[gh-N]`, as `review-open.mjs` does.

## 4. Fill in each item, `gh-N/review.md`

Everything about an item lives in its folder: its `review.md`, its try files (`try-<what>.md`) or folders (`try-<what>/`), and `shots/`. A **Done, nothing to look at** item has no folder, **Found along the way** stays in the index, and a retro's side pages go in `retro/`.

Its shape is the one `review-open.mjs` writes: it reads in the order the contributor looks, what it is, trying it, what's left to accept, then closing. Always these headings, in this order:

- **`# [ ] Review`**, with `progress:[]` under it, straight after **Send to <ai>**, so they see at the top whether the item is done. It shows **✓ Done** once everything under it is.
- **`## Changes`** says what someone sees now, with what you decided and anything beyond the issue. Say what any supporting piece is for, and what it costs, and give any **`Contortion:`** here: if making something work took something non-standard, say what, why, and what it might cause, straight away rather than when it breaks, including what agents flagged. Link files on the branch as `[name]($reader/<path>)`, which opens them in the branch's reader, as it runs with `--dev` under `npm run dev`.
- **`## Tries`**: one `Try:` card for each thing to try, `Try: [what it shows](try-<what>.md).`, with a line under it on what to look for. They tick it, `Try [x]:`, once they've tried it, and their threads go under it as asides. Try files and folders sit in the item's folder, named for what they show (`gh-213/try-done-section.md`, or `gh-197/try-daily-journal/` for a series), more than one if it needs them, and targeted rather than a big tour. A try file that shows asides as a sample signs them as a sample reviewer declared in its own front matter (`reviewer m: Maria`, then `~m …`), never as the contributor (`~#`), as `asides-open` counts every `~#` as theirs and waiting on you. Examples are what a reviewer values most: every item that changes what's seen gets a screenshot or a try file, and if it can't, say why. Anything touching colour gets light, dark and contrast side by side. Before and after where it helps. Link every screenshot from the sentence about it (`[shot](shots/nine-pages.png)`, relative to the item's folder), as pictures don't show in reader's file list.
- **`## [ ] Acceptance Criteria`**, with `progress:[]` and "All the following criteria must be accepted for this review to be complete." Then a `1)` list with a box for each criterion, `1) [ ] …`, in this order:
  - **Browsers first,** one each, checked by you, not handed over. Write each try file's steps as a steps file for `browse.mjs`, the presses, picks, typing and Tab the contributor would do, and run it in every browser it applies to, in one go: `--browser all` is Chromium, Firefox, WebKit and Safari Technology Preview, one after another, a browser that can't start said and skipped. If it's about how something looks, add `--theme light,dark`, which chooses reader's own Theme before the first step, so Safari gets it as well, and names each shot for it, `firefox-dark-<name>.png`. It writes `shots/index.md`, each shot under its name, a column to a browser and a row to a theme: link that page from the criterion, or the shots, and tick it. Leave the contributor a `Check` box only for what a shot or a step can't show, such as whether something reads easily or how it feels on their real phone, and say why it's theirs. Tick what you checked yourself and say how: `npm run shots` for Chromium, Firefox, WebKit and phone sizes; `safaridriver -p <port>` with WebDriver for real Safari, which is the real check, as Playwright's WebKit isn't Safari. For clicks, taps, drags and shots in a browser, use `node scripts/browse.mjs <file> --steps <steps.json> --repo <worktree> --browser all [--theme light,dark] [--phone]` (or one browser, `--browser webkit`), never a one-off script; it says on each drag whether the touch was real (Chromium) or made in the page (WebKit), which is worth saying in the criterion. `--browser safari` is Safari Technology Preview, never their own Safari, and only runs outside the sandbox. Say what remains for their real phone (`:iphone:`). Anything new that's seen, a control above all, gets a criterion of its own after the browsers: a shot at 200% zoom (`--zoom 2`) and one in the system's colours (`--forced-colors`), what takes a press at least 24 by 24 pixels (WCAG 2.5.8), and its marks at least 3 to 1 on the paper (1.4.11), each measured, not guessed. Keep only the browsers an item can be checked in, and remove the rest, as a box with nothing to do is noise. A browser you didn't check is an unticked box that says what to do, `2) [ ] Check Firefox: …`, never a box with "not checked", which they'd tick once they had. Name a browser by its mark and its name, `:chrome: Chromium`, `:safari: Safari Technology Preview`, `:firefox: Firefox`.
  - **Each open point,** as a bold name in words (`**A kept day, or a blank one?**`, never "Point 3"), what it's about, then its question: `Q (<ai>): …?`, with `- ( ) Yes` and `- ( ) [@ Something else]` under it, or named options in place of Yes, such as milestones. Never `No, because:`, which has nowhere to type. Related questions for one point are `a)`, `b)` under it. Inside a criterion, `Q (<ai>):` and its choices nest under it, indented.
  - **Things only to make them aware,** with no question.
  - **Settled decisions,** in place of a Decisions section: what was decided, why, and what was turned down (`Turned down: …`). Tick them yourself.
- **A criterion's box means they accept it,** which is apart from picking its choice: picking answers the question, and ticking says the criterion is met. Don't tick one they haven't, unless it's a settled decision or a dropped one.
- **A dropped criterion** is struck, `~~…~~`, with "No longer applies:" and why after it, and ticked. A question that changes is rewritten in place, and the asides keep the history; one replaced by another is struck, its options lose their `( )`, then `A (<ai>): Replaced by "<name>".`, pointing by a name they can search for.
- Once a criterion is settled, say its outcome in the margin, as an aside of yours with the `Outcome` topic (`topic o: Outcome`, which `review-open.mjs` declares), straight under what it settles and never among a question's choices: `~co gh-N filed.`, `~co Fixed in <hash>.`, or `~co No change, because …`. It shows your name and an Outcome pill, and the masthead counts them.
- An answer with its choices under it, `A (<name>): ->` and the `- ( )` lines indented beneath, is fine wherever it draws; inside a criterion, a list item, `Q (<ai>):` with its choices under it draws as a question too.
- **`## Closing`**: compare the issue with what shipped and give your reasoning, then `Q (<ai>): Does gh-N still describe what shipped?` with its four choices: the issue stands; it stands, with this closing comment, the comment drafted as a quote under that choice, so picking it agrees to those words; a PR replaces it; or something else.
- Something only to make them aware gets a plain box, never the three stages: every line under **Done, nothing to look at**, and anything like it in an item.

## 5. Before handing over

- Check every claim against the branch: run tests and lint, count commits, open the screenshots yourself. Look at each shot zoomed in for anything that overlaps, touches or is cut off, not only for whether it's there, and say in its criterion that you did. A subagent's report isn't evidence until you've looked. Don't write a commit's hash before it exists.
- Render the index and an item to be sure boxes and headings came out as boxes and headings.
- `node scripts/asides-open.mjs <day folder>`, and check **Before merging** and each item's **Acceptance Criteria** and **Tries** against its "Waiting on you", which lists every unticked criterion and untried `Try:`.
- PRs: only for an issue that no longer describes what shipped, whether or not it was looked at, as a PR takes the issue's place in the release notes. Compare the issue with what shipped, and give your reasoning, rather than going by which section it's in. It's asked in each item's `## Closing`, with four choices: the issue stands; it stands, with a closing comment on what went beyond it; a PR replaces it; or something else. A **Done, nothing to look at** line says that its issue still describes what shipped; if it doesn't, the item goes under **Please look**. Never ask it in **Before merging**. Its description, finished just before it merges, says what shipped, why, and what was turned down. Pushing is outward, so ask for a clear yes first, on its own.

## 6. Hand over

- Start the watcher as a **background Bash command** (`run_in_background`), not a Monitor, which expires every 30 minutes:
  `node scripts/send-watch.mjs 2000 --once`
  It wakes you at the first ticked box. Use `review-round`.
- Tell them in chat: where it is, the command to run, and what's first. If the change touches the server and they're already running it, say so in the first line.
