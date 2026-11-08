<h1 align="center">ydaa</h1>

<p align="center"><strong>Yes, and don't ask again.</strong></p>

<p align="center">A Claude Code plugin that answers permission prompts for you, the way you would have answered them yourself.</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v0.1.0-blue" alt="v0.1.0">
  <img src="https://img.shields.io/badge/Claude_Code-plugin-D97757?logo=claude&logoColor=white" alt="Claude Code plugin">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="Zero dependencies">
  <img src="https://img.shields.io/badge/license-MIT-111111" alt="MIT">
  <img src="https://img.shields.io/github/stars/rmyndharis/ydaa?style=social" alt="GitHub Stars">
  <a href="https://buymeacoffee.com/rmyndharis"><img src="https://img.shields.io/badge/Buy_Me_a_Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee"></a>
</p>

> **Read [Before you turn it on](#before-you-turn-it-on) first.** While ydaa is on, Claude runs what it asks to run without waiting for you. Your deny rules still stop it. The prompt no longer does.

## TL;DR

```text
/plugin install ydaa --marketplace rmyndharis/ydaa
/ydaa on
```

For the rest of the session, each permission prompt is answered "Yes, and don't ask again" when the prompt offers that option, and "Yes" when it does not. Questions Claude asks you and plan approval still wait for you. `/ydaa off` hands the prompts back, and `/ydaa stats` shows what ydaa has saved you so far.

## The problem

Claude Code asks before it edits a file, runs a shell command, or fetches a URL. On a long task those prompts are where the work stops: you come back after lunch to find Claude waiting on a dialog you would have approved in a second. Most of the time you pick the same answer anyway: "Yes, and don't ask again".

The built-in ways around the prompt each give something up:

| Option | At a prompt | Saved for next time |
| --- | --- | --- |
| Default mode | Asks you, and waits | What you choose to save |
| `acceptEdits` mode | Accepts file edits; everything else still asks | Nothing |
| `auto` mode | A model classifier approves or denies | Nothing |
| `bypassPermissions` (`--dangerously-skip-permissions`) | Skips every permission check | Nothing |
| **ydaa** | Picks "Yes, and don't ask again", else "Yes" | What the prompt offered to save |

ydaa sits between being asked and not being checked at all. It clicks the button you would have clicked, so the rules that build up are the ones Claude Code itself offered: plain permission rules in your settings that you can read and remove. Your deny rules keep working, it never changes your permission mode, and the dialogs that need a person keep waiting for one.

## Install

ydaa needs a Claude Code release that supports function hooks in plugins. It is tested with Claude Code 2.1.319. The hooks-module API is in early access and can change between releases.

In a Claude Code session:

```text
/plugin install ydaa --marketplace rmyndharis/ydaa
```

Answer `y` to add the marketplace, then choose a scope (user scope is listed first; press Enter). Claude Code confirms with `Installed ydaa. Plugin is now active.`

From a shell:

```sh
claude plugin install ydaa --marketplace rmyndharis/ydaa
```

In the desktop app, click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `rmyndharis/ydaa`, then **Add plugin**.

ydaa installs switched off. Nothing changes until you run `/ydaa on`.

## Usage

| Command | Effect |
| --- | --- |
| `/ydaa on` | Answer permission prompts for you, for the rest of this session |
| `/ydaa off` | Stop answering; prompts reach you again (rules already saved stay) |
| `/ydaa` | Show whether ydaa is on |
| `/ydaa stats` | Show how many prompts ydaa has answered, and the time that saved you |

While ydaa is on, the status line under the prompt reads `auto-answering permission prompts`.

`/ydaa off` takes effect at once, even while Claude is in the middle of a turn, so you can take the prompts back without waiting for the turn to finish.

### What ydaa saved you

```text
> /ydaa stats
ydaa has answered 1284 permission prompts for you.
That's about 43 min of reading and answering you didn't have to do (2 s a prompt), and 1284 stops Claude didn't have to make.
```

The count is kept across sessions. Time is estimated at 2 seconds a prompt, about what it takes to read one and pick an answer. That is the floor, not the full saving: a prompt that arrives while you are away holds Claude until you come back, and those waits are not counted.

## How it works

ydaa hooks the moment Claude Code is about to show a permission dialog (the `PermissionRequest` event). Your allow and deny rules have already been applied by then, so ydaa only ever sees calls that were going to ask you.

1. **Off:** the dialog shows as usual.
2. **On:** ydaa answers in place of the dialog, and counts the answer for `/ydaa stats`.
   - When the dialog offers "Yes, and don't ask again" (a rule for this command or tool, or access to a folder), ydaa picks it. The grant is saved exactly where that option would save it, often the project's `.claude/settings.local.json`, so the same call does not prompt again.
   - When it offers no such option, ydaa answers a plain "Yes" for this one call.
   - An offer to change your permission mode, such as "switch to auto mode" or "allow all edits", is never taken.
3. **Always yours:** `AskUserQuestion` (a question Claude asks you) and `ExitPlanMode` (approving a plan) go to you whether ydaa is on or off.

Hooks from your organization's managed settings run before ydaa and can still refuse a call. `PermissionRequest` hooks in your own settings, such as one that sends a notification when Claude is waiting, do not run for a prompt ydaa has answered, since nobody is waiting.

The whole plugin is about 50 lines in [`hooks/register.ts`](hooks/register.ts). It is kept short so you can read all of it before you turn it on.

## Before you turn it on

- **ydaa approves what Claude asks to do.** Shell commands, file edits, network requests and MCP tool calls that would have prompted you now run without you. If Claude reads something hostile (a web page, an issue, a file in a dependency) and is steered by it, no prompt is left to stop it. Use ydaa in projects you trust, ideally inside a container or a throwaway VM.
- **Deny rules are your hard stops.** A call a deny rule refuses never reaches ydaa. Put what must never run without you in `~/.claude/settings.json`:

  ```json
  {
    "permissions": {
      "deny": ["Bash(git push:*)", "Bash(curl:*)", "Read(./.env)"]
    }
  }
  ```

  Deny rules match a call as it is written, so `Bash(git push:*)` does not catch every way to push. Treat them as a seatbelt, not a sandbox.
- **The switch covers one session.** `/ydaa on` holds until you run `/ydaa off` or close the session. A new session, another terminal, or a reload of the plugin (after an update, for example) starts with ydaa off, and ydaa answers nothing there until you type `/ydaa on` in it.
- **Rules ydaa saved are shared, and they stay.** They are ordinary permission rules, in the same settings files as the ones you save by hand, so they hold after `/ydaa off` and in every other session that reads those settings: a rule saved for `npm test` in one terminal means no prompt for `npm test` in another terminal on the same project. Review and remove them with `/permissions`, or edit the settings file.
- **Confirmation prompts from hooks are answered too.** A plugin or settings hook that asks you to confirm a call (for example a `PreToolUse` hook that returns `ask`) raises the same dialog, and ydaa answers it like any other. If a hook exists to make you look at something, have it deny instead, or keep ydaa off.

## Uninstall

From a shell:

```sh
claude plugin uninstall ydaa
```

Permission rules ydaa saved are part of Claude Code's settings, not of the plugin, and stay until you remove them with `/permissions`. To pause ydaa without uninstalling it, `/ydaa off` is enough.

## Development

ydaa is one hooks module with no dependencies.

| Path | Purpose |
| --- | --- |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `.claude-plugin/marketplace.json` | Makes this repository installable as a marketplace |
| `hooks/hooks.json` | Names the hooks module |
| `hooks/register.ts` | The plugin |
| `tests/ydaa.test.ts` | Tests, run by `claude plugin test` |

Load your working copy into a session, for that session only:

```sh
claude --plugin-dir .
```

Check the manifest and hooks, then run the tests:

```sh
claude plugin validate .
claude plugin test .
```

## Contributing

Issues and pull requests are welcome. Keep changes small, add a test for any change in what ydaa answers, and run `claude plugin validate .` and `claude plugin test .` before you open a pull request.

A change that lets ydaa answer more than it does today (a new kind of grant, a mode switch, a dialog meant for a person) should explain in the pull request why it is safe.

## Support

If ydaa saves you a few clicks a day, you can support its development by buying me a coffee.

<a href="https://buymeacoffee.com/rmyndharis"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="50"/></a>

## License

Released under the [MIT License](LICENSE).

Claude Code is a product of Anthropic. ydaa is an independent project and is not affiliated with or endorsed by Anthropic.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/rmyndharis">Yudhi Armyndharis</a> &amp; ydaa contributors
</p>
