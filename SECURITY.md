# Security policy

ydaa answers permission prompts for you, so a flaw in it can let a tool call run that you meant to review. Reports of such flaws are welcome and are handled in private until a fix is released.

## Supported versions

Fixes are released for the latest version only. Update with `claude plugin update ydaa` before you report, in case the problem is already fixed.

## Reporting a vulnerability

Do not open a public issue. Report it through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**, or go straight to [the report form](https://github.com/rmyndharis/ydaa/security/advisories/new).

Include:

- the ydaa version and the Claude Code version (`claude --version`);
- the permission mode the session was in;
- the steps to reproduce, starting from `/ydaa on`;
- what ydaa answered, and what it should have done instead.

## Scope

In scope:

- ydaa answering a prompt the README says is left to you: while it is off, in a mode it stays out of, or for `AskUserQuestion` and `ExitPlanMode`;
- ydaa taking a mode switch, or saving a grant the dialog did not offer;
- ydaa staying on, or answering, after `/ydaa off`, `/clear` or `/resume`.

Out of scope:

- ydaa approving what Claude asks to do while it is on. That is what it is for; see [Before you turn it on](README.md#before-you-turn-it-on).
- Flaws in Claude Code itself, such as in permission rules, modes or the hooks API. Report those to [Anthropic](https://github.com/anthropics/claude-code/security).
