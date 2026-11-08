import type { EngineInterface, Register } from 'claude-code'

// Not permission prompts: Claude's own questions, and plan approval, which
// answered unread would defeat plan mode.
const PERSON_ONLY = new Set(['AskUserQuestion', 'ExitPlanMode'])

// Roughly what a person spends reading one prompt and picking an answer.
const SECONDS_PER_PROMPT = 2

// The store has no atomic increment, so two answers at the same moment
// (parallel subagents, or two sessions) can lose a count. Fine for an estimate.
async function countAnswer($: EngineInterface): Promise<void> {
  await $.store.set('answered', (Number(await $.store.get('answered')) || 0) + 1)
}

// 58 reads "58 s", 2568 reads "43 min", 4000 reads "1 h 7 min".
function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

async function stats($: EngineInterface): Promise<string> {
  const answered = Number(await $.store.get('answered')) || 0
  if (answered === 0) {
    return "ydaa hasn't answered a permission prompt yet. Each one it answers after /ydaa on is counted here."
  }
  const s = answered === 1 ? '' : 's'
  return (
    `ydaa has answered ${answered} permission prompt${s} for you.\n` +
    `That's about ${duration(answered * SECONDS_PER_PROMPT)} of reading and answering you didn't have to do ` +
    `(${SECONDS_PER_PROMPT} s a prompt), and ${answered} stop${s} Claude didn't have to make.`
  )
}

export const register: Register = on => {
  // Per session: a new session, another terminal, or this one after a reload
  // keeps asking until /ydaa on is typed there.
  let isOn = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ydaa',
      description: "Yes, don't ask again: answer permission prompts for you",
      argumentHint: 'on|off|stats',
      immediate: true,
    })
    // A reload starts off, and the host may still show the line the old copy pinned.
    $.ui.status(undefined)
    return next(e)
  })

  // /clear and /resume end the session but keep this copy loaded, so the next
  // session would inherit the switch. Compaction does not end a session.
  on('session.end', ($, e, next) => {
    isOn = false
    $.ui.status(undefined)
    return next(e)
  })

  on('command.run', { command: 'ydaa' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stats') return { text: await stats($) }
    if (arg === 'on' || arg === 'off') {
      isOn = arg === 'on'
      $.ui.status(isOn ? 'auto-answering permission prompts' : undefined)
    } else if (arg !== '') return { text: 'Usage: /ydaa on|off|stats' }
    return {
      text: isOn
        ? `ydaa is on for this session: permission prompts get "Yes, and don't ask again" when offered, otherwise "Yes", except in auto mode (Shift+Tab switches to Manual). /ydaa off hands them back.`
        : 'ydaa is off: permission prompts come to you. Rules saved while it was on stay; review them with /permissions.',
    }
  })

  // Answers without next(e): nobody is asked, so settings hooks that report a
  // pending prompt are not run for it. Managed hooks still run above this one.
  on('classic.PermissionRequest', async ($, e, next) => {
    // Auto mode prompts only for what it means you to decide, such as a call
    // its classifier kept blocking.
    if (!isOn || e.permission_mode === 'auto' || PERSON_ONLY.has(e.tool_name)) return next(e)
    // "Yes, and don't ask again for ..." is the prompt's own rule and folder
    // grants; a mode switch ("switch to auto mode", "allow all edits") is not.
    const grants = (e.permission_suggestions ?? []).filter(
      s => s.type === 'addDirectories' || (s.type === 'addRules' && s.behavior === 'allow'),
    )
    // A count that fails to save must not leave the prompt unanswered.
    await countAnswer($).catch(() => {})
    return {
      decision:
        grants.length > 0 ? { behavior: 'allow', updatedPermissions: grants } : { behavior: 'allow' },
    }
  })
}
