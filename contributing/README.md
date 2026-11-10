# Working in batches, with an AI

The skills here take a batch of issues from start to merge with an AI that reads the open [Agent Skills](https://agentskills.io/specification) format: each folder is one skill, its `SKILL.md` and its `scripts/`.
They're optional.

- `batch-start`: check a batch's issues before work starts.
- `review-open`: lay out the review of a finished batch, in reader-markdown.
- `review-round`: answer each round of the review.
- `review-close`: check that nothing's left, then merge.
- `retro`: a retro of how the review went.

## Set up

```sh
node contributing/link.mjs
```

This links each skill into the git-ignored `.claude/skills/` (Claude Code) and `.agents/skills/` (Codex and others).

## Config

Each setting is the first of: `contributing/config.local.json` (git-ignored), an environment variable, what git or `gh` says, and a default.
None needs setting.

| Setting | Variable | Otherwise |
|---|---|---|
| `meetings`: the folder of day folders, one per review date | `READER_MEETINGS` | `.meetings/` in the main checkout |
| `repo`: where the issues are | `READER_REPO` | `gh repo set-default --view`, else `jzheaux/reader` |
| `contributor`: your name in the review files | `READER_CONTRIBUTOR` | the first word of `git config user.name` |
| `ai`: the AI's name in them | `READER_AI` | `Claude` |

```json
{ "meetings": "~/Documents/reader/meetings" }
```

`node contributing/lib/config.mjs` prints what's in use.
`READER_CONFIG` names a file to read in place of `config.local.json`.
