---
name: review-close
description: Bring a finished review of reader work to main. Use when the contributor says a review is ready to merge, or asks whether anything's left before merging.
---

# Close a review

## 1. Check, don't remember

```sh
node scripts/review-close.mjs <day folder> <worktree>
```

It checks that the worktree is clean, main matches origin and fast-forwards, every issue has a merge saying `Closes gh-N`, tests and lint pass, no boxes, choices or asides are left waiting, each item has its `## Closing` (older days: `### Issue or PR`) with a choice picked, and every criterion in its **Acceptance Criteria** is ticked and every `Try:` tried, and no `<fill>` is left. Do what each item's choice says: a PR, or a closing comment. Also look at these yourself:

- **Issue titles:** they become release notes. Do they still say what shipped? Behaviour, no version numbers, "should" only for bugs.
- **Parent issues:** would this close their last child?
- **Docs:** do they describe what shipped, with no leftover mentions of what was dropped?
- **Unverified browsers:** say which are unticked, and whether that should hold it up.

If they ask "anything else?", answer from this, with a recommendation for each.

**If main has moved on,** bring the branch up to it with `git rebase --rebase-merges main`, never a plain rebase, which flattens the `Merge issue/gh-N` commits and drops their `Closes gh-N`. Then update any hashes the review files cite, as they've all changed.

## 2. Say what the record needs

Issues tell the community what happened, and `review.md` holds the reasoning.

- An issue that no longer describes what shipped gets a PR: its description says what shipped, why, and what was turned down, ending `Closes gh-N`. The PR takes the issue's place in the release notes, so a design that moved on doesn't mislead anyone.
- An issue whose work moved on without a PR: a closing comment with what shipped, why, and what was turned down. Leave its description as written.
- If design moved elsewhere for good, a pointer to where.
- `Discussed in:` waits until the maintainers decide about checking review files in.

## 3. Outward steps go separately

Pushing, closing, renaming and commenting are outward, so each needs a clear yes for that step, not a yes to something nearby. Keep them in their own commands, apart from local work, so that one refusal doesn't stop the rest. If a permission check refuses one, stop and explain; don't work around it.

Local work first:

```sh
git -C <main checkout> merge --ff-only review/<Y.M.D>
```

Then, after their yes: `git -C <main checkout> push origin main`, then issue changes. Check the result: a command pasted in a terminal can break a title across lines.

Commits: `git commit -s`, `See gh-N` on issue branches, `Closes gh-N` on the `--no-ff` merge, `Polish gh-N` for follow-ups, nothing on a contributor's commit but their trailers.

## 4. After

- Tick "Then: fast-forward `main`, push."
- Finish contributors' PRs: rebase theirs on what landed, then comment.
- Offer the retro.
