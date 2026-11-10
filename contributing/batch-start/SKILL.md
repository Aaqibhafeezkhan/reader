---
name: batch-start
description: Check a batch of reader issues before any work on them starts. Use when Josh hands over a batch, an overnight run, or a review/YYYY.MM.DD branch's issues, before the first commit, and again for any issue that joins a batch already under way, such as one filed during a release review or a review round.
---

# Start a batch

## 1. Check, don't remember

```sh
node ~/code/jzheaux/reader/.claude/tools/batch-start.mjs <milestone> 221,237,240 --day <review date, YYYY-MM-DD>
```

For each issue it lists its milestone, a `good first issue` label, and open PRs that mention it. It also reads the newest `meetings/<date>/retro.md` (or `--retro <file>`) and lists, as `OWED`, each card whose last `Outcome:` says "waiting on me". It exits 1 if anything needs a look.

With `--day`, it also writes each issue's title, link and body into `meetings/<day>/batch.md`, under a `## [ ] gh-N` box meaning "the wording's right", and lists as `WORD` each box still unticked. An issue already in the file is left as it is, so Josh's asides stay; one that joins later is added at the end. Without `--day` it says the wording isn't checked, and won't say "ready to start".

- **Owed from the retro:** do it before the batch, or, if it can't be done now, file it as an issue and tell Josh. Either way, add a later `A (Claude):` to that card with an `Outcome:` saying what happened (`Outcome: done, <what>` or `Outcome: gh-N filed`), so it stops being listed. Never start the batch with one still owed.

- **An open PR:** read it. If it covers the issue, leave the issue out of the batch and say so; the contributor's work comes first (see the contributor-prs memory).
- **`good first issue`, and no PR covers it:** remove the label before starting, so no one picks it up meanwhile. The command is printed; it's outward, so run it on its own.
- **Outside the milestone asked for:** leave it out, and say so, rather than run ahead.
- **Closed already:** leave it out.
- **Wording not ticked:** tell Josh `batch.md` is ready, and wait. He changes an issue on GitHub himself, or asks in an aside there, in which case edit the issue on GitHub before the work starts and say under his aside what changed, so the issue stays the record. Answer his asides as in `review-round`. For an overnight run, this is done as he hands it over, before he goes.

## When an issue joins later

An issue can join a batch already under way: one filed during the release review, or in a review round, or one Josh adds. Before its first commit, run the same check on it alone, with the batch's milestone:

```sh
node ~/code/jzheaux/reader/.claude/tools/batch-start.mjs <milestone> 267 --day <review date>
```

The checks are the same, so it's the same script, not a step of its own. An issue I filed that day can't have a PR yet, but its milestone can be wrong, and the retro's owed outcomes still apply. Say in the review's index which issues joined later, and that they were checked.

## 2. Then lay out the work

The branch is `review/YYYY.MM.DD`, named for its review date, in a worktree under `.claude/worktrees/`. Each issue goes on `issue/gh-N`, commits say `See gh-N`, and each merges `--no-ff` with `Closes gh-N`. Nothing is pushed. See the review-branches and commit-conventions memories.

When the batch is merged, use `review-open`.
