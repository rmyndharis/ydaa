import type { EngineInterface, Register } from 'claude-code'

// Not permission prompts: Claude's own questions, and plan approval.
const PERSON_ONLY = new Set(['AskUserQuestion', 'ExitPlanMode'])

// Modes whose remaining prompts are escalations, plan blocks, or safety checks meant for a person.
const PAUSED = new Set(['auto', 'plan', 'dontAsk', 'bypassPermissions'])

// Roughly what a person spends reading one prompt and picking an answer.
const SECONDS_PER_PROMPT = 2

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

// The host shows the line as "ydaa: <text>".
function showStatus($: EngineInterface, isOn: boolean, mode: string | undefined): void {
  if (!isOn) return $.ui.status(undefined)
  if (mode === undefined) return $.ui.status('on, except in auto or plan mode')
  if (mode === 'auto') return $.ui.status('paused in auto mode (Shift+Tab for Manual)')
  $.ui.status(PAUSED.has(mode) ? `paused in ${mode} mode` : 'auto-answering permission prompts')
}

// Switching modes raises no event of its own, so the status line follows the
// mode each event reports. Returns the mode to keep.
function follow($: EngineInterface, isOn: boolean, mode: string | undefined, reported: string | undefined) {
  if (reported === undefined || reported === mode) return mode
  showStatus($, isOn, reported)
  return reported
}

export const register: Register = on => {
  // Per session: a new session, another terminal, or this one after a reload
  // keeps asking until /ydaa on is typed there.
  let isOn = false
  // As the last prompt or permission request reported it. A plugin is not
  // told the mode a session starts in, so it is unknown until then.
  let mode: string | undefined
  let counting = Promise.resolve()

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
    mode = undefined
    $.ui.status(undefined)
    return next(e)
  })

  on('classic.UserPromptSubmit', ($, e, next) => {
    mode = follow($, isOn, mode, e.permission_mode)
    return next(e)
  })

  on('command.run', { command: 'ydaa' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'stats') return { text: await stats($) }
    if (arg === 'on' || arg === 'off') {
      isOn = arg === 'on'
      showStatus($, isOn, mode)
    } else if (arg !== '') return { text: 'Usage: /ydaa on|off|stats' }
    return {
      text: isOn
        ? `ydaa is on for this session: permission prompts get "Yes, and don't ask again" when offered, otherwise "Yes", except in auto or plan mode (Shift+Tab switches modes). /ydaa off hands them back.`
        : 'ydaa is off: permission prompts come to you. Rules saved while it was on stay; review them with /permissions.',
    }
  })

  // Answers without next(e): nobody is asked, so settings hooks that report a
  // pending prompt are not run for it. Managed hooks still run above this one.
  on('classic.PermissionRequest', async ($, e, next) => {
    mode = follow($, isOn, mode, e.permission_mode)
    if (!isOn || PAUSED.has(e.permission_mode ?? mode ?? '') || PERSON_ONLY.has(e.tool_name)) return next(e)
    // "Yes, and don't ask again for ..." is the prompt's own rule and folder
    // grants; a mode switch ("switch to auto mode", "allow all edits") is not.
    const grants = (e.permission_suggestions ?? []).filter(
      s => s.type === 'addDirectories' || (s.type === 'addRules' && s.behavior === 'allow'),
    )
    // Serialized in this process; two sessions at once can still lose a count,
    // and a count that fails to save must not leave the prompt unanswered.
    await (counting = counting
      .then(async () => {
        if (!isOn) return
        const n = (Number(await $.store.get('answered')) || 0) + 1
        if (isOn) await $.store.set('answered', n)
      })
      .catch(() => {}))
    if (!isOn) return next(e)
    return { decision: grants.length > 0 ? { behavior: 'allow', updatedPermissions: grants } : { behavior: 'allow' } }
  })
}
