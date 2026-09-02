# Keeping deliverables alive

Sessions run in throwaway containers. The repo is cloned fresh at start and the
container is reclaimed after inactivity, so a generated file — a brochure PDF, a
deck, an export — exists only until then. If it was never committed and pushed,
it is unrecoverable. Not "hard to find": gone.

This has already cost us one file. An Aug 2026 session built an RHLC brochure
PDF, finished with "PDF rebuilt: fonts enlarged, layout fills space end-to-end",
and never pushed its branch. There is no PR, no branch on origin, and no copy in
Drive or email. The PDF is unrecoverable.

## Saving something

```sh
scripts/save-deliverable.sh brochure.pdf --note "print-ready v4"
```

It copies the files into `deliverables/<date>-<slug>/`, writes a `manifest.json`
(sizes, SHA-256s, originating branch and session), appends a row to
`deliverables/index.md`, commits, and pushes the current branch.

| Flag | Effect |
| --- | --- |
| `--slug NAME` | Name the folder. Defaults to the branch name, then the filename. |
| `--note TEXT` | What this is. Shows up in the manifest and the index. |
| `--no-push` | Commit only. |
| `--dry-run` | Show what would be saved. |

Re-running with the same slug on the same day overwrites in place, so a rebuilt
file replaces its predecessor instead of piling up copies.

## The safety net

`scripts/check-unsaved-deliverables.sh` runs on the `Stop` hook, wired up in
`.claude/settings.json`. When a turn ends it looks for untracked or modified
files with deliverable-shaped extensions (pdf, pptx, docx, xlsx, png, mp4, …)
and names them, with the command to save them. It stays silent when there is
nothing at risk and never blocks.

`.claude/settings.json` is deliberately **not** gitignored — containers are
cloned fresh, so an untracked hook would never run. Personal overrides belong in
`.claude/settings.local.json`, which is still ignored.
