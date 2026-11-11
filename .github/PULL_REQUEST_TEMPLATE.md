<!-- Title: a Conventional Commits subject, such as "fix: count every prompt when several arrive at once". Pull requests are squash-merged, so the title becomes the commit. -->

## Problem

<!-- What was wrong or missing, and what it cost. Link the issue: "Closes #123". -->

## Changes

<!-- What changed, as a short list. -->

## Verification

<!-- How you checked it: tests added, manual steps, the Claude Code version you ran. -->

- [ ] `claude plugin validate .` and `claude plugin test .` pass
- [ ] A test covers every change in what ydaa answers or shows
- [ ] `CHANGELOG.md` has an entry under `Unreleased` for a change users will notice
- [ ] If ydaa now answers more than before, this description says why that is safe
