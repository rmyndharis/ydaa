# Changelog

All notable changes to ydaa are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-11-11

### Changed

- ydaa leaves prompts in `plan`, `dontAsk` and `bypassPermissions` modes to you. An answered plan mode prompt let a call write before the plan was approved.
- The status line names the mode ydaa is paused in, such as `ydaa: paused in plan mode`.

### Fixed

- `/ydaa stats` counts every prompt when several are answered at once.
- `/ydaa off` hands back prompts that were still waiting for an answer.
- A subagent running in its own permission mode no longer changes the session's status line.

## [0.2.0] - 2026-11-09

### Added

- The status line shows when ydaa is paused.

### Changed

- ydaa leaves prompts in auto mode to you.

### Fixed

- `/clear` and `/resume` turn ydaa off, so the next session does not inherit the switch.

## [0.1.0] - 2026-11-08

### Added

- `/ydaa on` answers permission prompts with "Yes, and don't ask again", or "Yes" when the prompt does not offer it. `/ydaa off` hands them back.
- `/ydaa stats` shows how many prompts ydaa has answered and the time that saved.

[Unreleased]: https://github.com/rmyndharis/ydaa/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/rmyndharis/ydaa/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/rmyndharis/ydaa/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rmyndharis/ydaa/releases/tag/v0.1.0
