# Contributing to ydaa

Thanks for helping. ydaa is small on purpose: one hooks module of under 120 lines with no dependencies, short enough to read in full before you turn it on. Changes that keep it that way are the easiest to merge.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Issues

- Open an issue with one of the [issue forms](https://github.com/rmyndharis/ydaa/issues/new/choose). Search the existing issues first, and keep to one problem per issue.
- Give the title as a plain sentence that states the problem or the request, such as "Status line stays on plan mode after the plan is approved".
- Do not report a security problem in a public issue. Follow the [security policy](SECURITY.md).
- For a larger change, open an issue before you write code, so the approach is agreed first.

## Development

ydaa has no install step and no build. You need a Claude Code release at or above the one the README names as tested. The commands to load, validate and test a working copy are in the README's [Development](README.md#development) section.

- Add a test for every change in what ydaa answers or shows. Tests live in `tests/ydaa.test.ts` and run with `claude plugin test .`.
- Update the README when a change alters behavior it describes. The README is the specification: what it says ydaa does must stay true.
- A change that lets ydaa answer more than it does today (a new kind of grant, a mode switch, a dialog meant for a person) must explain in the pull request why it is safe.

## Commits

Commit subjects follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type: summary`, with an optional scope as `type(scope): summary`.

| Type | Use it for |
| --- | --- |
| `feat` | A change in what ydaa does for its users |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `test` | Tests only |
| `refactor` | A code change that alters no behavior |
| `ci` | Workflows and their configuration |
| `chore` | Releases and repository upkeep |

- Write the summary in the imperative mood, in lower case, with no trailing period, in about 50 characters: `fix: count every prompt when several arrive at once`.
- Add a body only when the subject is not enough. Wrap it at 72 characters and explain why the change was needed, not what the diff already shows.
- Keep one logical change per commit.

## Pull requests

- Branch from `main` and name the branch `type/short-description`, such as `fix/status-line-after-plan`.
- Use a commit subject as the title. Pull requests are squash-merged, so the title becomes the commit on `main`.
- Fill in the pull request template: the problem, what changed, and how you verified it.
- Add an entry under `Unreleased` in [CHANGELOG.md](CHANGELOG.md) for any change users will notice. One line per change, written for someone who uses ydaa.
- Keep the pull request to one change. CI must pass before it is merged.

## Versioning and releases

ydaa follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Until 1.0, a minor version changes what ydaa answers or adds a feature, and a patch version only fixes bugs.

The version lives in `.claude-plugin/plugin.json`. Claude Code delivers an update to installed copies only when that version changes, so a change in behavior always ships with a new version.

To cut a release, as a maintainer:

1. In `CHANGELOG.md`, turn `Unreleased` into `## [X.Y.Z] - YYYY-MM-DD`, add an empty `Unreleased` above it, and update the links at the bottom of the file.
2. Set `version` in `.claude-plugin/plugin.json`.
3. Commit both as `chore: release X.Y.Z`, push to `main`, and wait for CI to pass.
4. Tag that commit and push the tag on its own: `git tag vX.Y.Z` then `git push origin vX.Y.Z`. The Release workflow checks the tag against `plugin.json` and publishes a GitHub release with that version's section of the changelog.

## The tested Claude Code release

CI installs the Claude Code release set as `CLAUDE_CODE_VERSION` in `.github/workflows/ci.yml` and checks that the README names the same one. To move to a newer release, change both in one commit. A weekly run tests against the newest release, because the hooks-module API is in early access and can change between releases.
