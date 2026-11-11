import { expect, mock, test } from 'claude-code/testing'
import type { ClassicFields, Engine } from 'claude-code/testing'

type Ask = ClassicFields<'PermissionRequest'>
type Suggestion = NonNullable<Ask['permission_suggestions']>[number]

const RULE: Suggestion = {
  type: 'addRules',
  rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }],
  behavior: 'allow',
  destination: 'localSettings',
}
const FOLDER: Suggestion = { type: 'addDirectories', directories: ['/tmp/out'], destination: 'session' }
const AUTO_MODE: Suggestion = { type: 'setMode', mode: 'auto', destination: 'session' }

// What the engine stamps on a command the person typed at the prompt.
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const bash = (permission_suggestions: Suggestion[]): Ask => ({
  tool_name: 'Bash',
  tool_input: { command: 'npm test' },
  permission_suggestions,
})

const ydaa = async ($: Engine, args: string) => (await $.command.run({ command: 'ydaa', args, ...TYPED })).text

test('off until /ydaa on in this session, whatever an earlier version stored', async ($, on) => {
  mock.store(on, { on: true })
  on('classic.PermissionRequest', () => ({}))
  expect((await $.classic.PermissionRequest(bash([RULE]))).decision).toBeUndefined()
})

test(`on: picks "Yes, and don't ask again", never a mode switch`, async ($, on) => {
  mock.store(on)
  await ydaa($, 'on')
  const answer = await $.classic.PermissionRequest(bash([RULE, FOLDER, AUTO_MODE]))
  expect(answer.decision).toEqual({ behavior: 'allow', updatedPermissions: [RULE, FOLDER] })
})

test('on, with only "switch to auto mode" offered: plain Yes', async ($, on) => {
  mock.store(on)
  await ydaa($, 'on')
  const answer = await $.classic.PermissionRequest(bash([AUTO_MODE]))
  expect(answer.decision).toEqual({ behavior: 'allow' })
})

test('on: questions and plan approval stay with the person', async ($, on) => {
  mock.store(on)
  on('classic.PermissionRequest', () => ({}))
  await ydaa($, 'on')
  for (const tool_name of ['AskUserQuestion', 'ExitPlanMode']) {
    const answer = await $.classic.PermissionRequest({ tool_name, tool_input: {} })
    expect(answer.decision).toBeUndefined()
  }
})

test('on: pauses in auto, plan, dontAsk, and bypassPermissions; answers in Manual and acceptEdits', async ($, on) => {
  mock.store(on)
  on('classic.PermissionRequest', () => ({}))
  await ydaa($, 'on')
  for (const permission_mode of ['auto', 'plan', 'dontAsk', 'bypassPermissions'] as const) {
    expect((await $.classic.PermissionRequest({ ...bash([RULE]), permission_mode })).decision).toBeUndefined()
  }
  for (const permission_mode of ['default', 'acceptEdits'] as const) {
    const res = await $.classic.PermissionRequest({ ...bash([RULE]), permission_mode })
    expect(res.decision).toEqual({ behavior: 'allow', updatedPermissions: [RULE] })
  }
})

test('subagent prompts keep the parent status line and follow live permission_mode', async ($, on) => {
  let status: string | undefined
  mock.store(on)
  on('ui.status', (_, e) => {
    status = e.text
    return { value: undefined }
  })
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.PermissionRequest', () => ({}))
  await ydaa($, 'on')
  await $.classic.UserPromptSubmit({ prompt: 'go on', permission_mode: 'default' })
  expect(status).toBe('auto-answering permission prompts')
  // A subagent running in auto mode pauses for its own escalations without flipping the session line.
  const autoSub = await $.classic.PermissionRequest({ ...bash([RULE]), agent_id: 'sub-1', permission_mode: 'auto' })
  expect(autoSub.decision).toBeUndefined()
  expect(status).toBe('auto-answering permission prompts')
  await $.classic.UserPromptSubmit({ prompt: 'plan first', permission_mode: 'plan' })
  expect(status).toBe('paused in plan mode')
  const planSub = await $.classic.PermissionRequest({ ...bash([RULE]), agent_id: 'sub-2', permission_mode: 'plan' })
  expect(planSub.decision).toBeUndefined()
  // Once the plan is approved a subagent reports the live mode (`bubble` for a fork under Manual),
  // while the mode the session last reported is still plan.
  const postExitSub = await $.classic.PermissionRequest({ ...bash([RULE]), agent_id: 'sub-3', permission_mode: 'bubble' })
  expect(postExitSub.decision).toEqual({ behavior: 'allow', updatedPermissions: [RULE] })
})

test('the status line follows the mode the session reports', async ($, on) => {
  let status: string | undefined
  mock.store(on)
  on('ui.status', (_, e) => {
    status = e.text
    return { value: undefined }
  })
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.PermissionRequest', () => ({}))
  // Before the first prompt nothing has told ydaa the mode.
  await ydaa($, 'on')
  expect(status).toBe('on, except in auto or plan mode')
  await $.classic.UserPromptSubmit({ prompt: 'go on', permission_mode: 'auto' })
  expect(status).toBe('paused in auto mode (Shift+Tab for Manual)')
  // An event without permission_mode falls back to the last reported session mode.
  expect((await $.classic.PermissionRequest(bash([RULE]))).decision).toBeUndefined()
  await $.classic.UserPromptSubmit({ prompt: 'go on', permission_mode: 'plan' })
  expect(status).toBe('paused in plan mode')
  await $.classic.UserPromptSubmit({ prompt: 'go on', permission_mode: 'acceptEdits' })
  expect(status).toBe('auto-answering permission prompts')
  await $.classic.UserPromptSubmit({ prompt: 'go on', permission_mode: 'default' })
  expect(status).toBe('auto-answering permission prompts')
  await $.classic.PermissionRequest({ ...bash([]), permission_mode: 'auto' })
  expect(status).toBe('paused in auto mode (Shift+Tab for Manual)')
  await ydaa($, 'off')
  expect(status).toBeUndefined()
})

test('/ydaa on and /ydaa off flip the switch', async ($, on) => {
  mock.store(on)
  on('classic.PermissionRequest', () => ({}))
  expect(await ydaa($, 'on')).toContain('ydaa is on for this session')
  expect((await $.classic.PermissionRequest(bash([]))).decision).toEqual({ behavior: 'allow' })
  expect(await ydaa($, 'off')).toContain('Rules saved while it was on stay')
  expect((await $.classic.PermissionRequest(bash([]))).decision).toBeUndefined()
})

// /clear and /resume start another session in the same process: no reload.
for (const reason of ['clear', 'resume'] as const) {
  test(`a session ended by ${reason} takes ydaa and its status line with it`, async ($, on) => {
    let status: string | undefined
    mock.store(on)
    on('classic.PermissionRequest', () => ({}))
    on('ui.status', (_, e) => {
      status = e.text
      return { value: undefined }
    })
    on('classic.UserPromptSubmit', () => ({}))
    on('session.end', (_, e) => ({ sessionId: e.sessionId }))
    await ydaa($, 'on')
    await $.classic.UserPromptSubmit({ prompt: 'go on', permission_mode: 'default' })
    expect(status).toBe('auto-answering permission prompts')
    await $.session.end({ reason, sessionId: 'a', resume: { id: 'a' } })
    expect(status).toBeUndefined()
    expect((await $.classic.PermissionRequest(bash([]))).decision).toBeUndefined()
    // The next session's mode is unknown until its first prompt.
    await ydaa($, 'on')
    expect(status).toBe('on, except in auto or plan mode')
  })
}

test('a mistyped /ydaa shows usage and leaves the switch off', async ($, on) => {
  mock.store(on)
  on('classic.PermissionRequest', () => ({}))
  for (const args of ['of', 'onn', 'yes']) expect(await ydaa($, args)).toBe('Usage: /ydaa on|off|stats')
  expect((await $.classic.PermissionRequest(bash([]))).decision).toBeUndefined()
})

test('/ydaa stats counts only the prompts ydaa answered', async ($, on) => {
  mock.store(on)
  on('classic.PermissionRequest', () => ({}))
  expect(await ydaa($, 'stats')).toContain("ydaa hasn't answered a permission prompt yet.")
  await ydaa($, 'on')
  await $.classic.PermissionRequest(bash([RULE]))
  await $.classic.PermissionRequest({ tool_name: 'AskUserQuestion', tool_input: {} })
  await ydaa($, 'off')
  await $.classic.PermissionRequest(bash([]))
  expect(await ydaa($, 'stats')).toContain('ydaa has answered 1 permission prompt for you.')
})

test('/ydaa stats does not lose counts when parallel calls prompt at once', async ($, on) => {
  mock.store(on)
  await ydaa($, 'on')
  await Promise.all([
    $.classic.PermissionRequest(bash([])),
    $.classic.PermissionRequest(bash([])),
    $.classic.PermissionRequest(bash([])),
    $.classic.PermissionRequest(bash([])),
  ])
  expect(await ydaa($, 'stats')).toContain('ydaa has answered 4 permission prompts for you.')
})

test('/ydaa off stops in-flight and queued prompts before they answer', async ($, on) => {
  let answered = 0
  let markFirstRead!: () => void
  let releaseFirstRead!: () => void
  const firstReadEntered = new Promise<void>(r => (markFirstRead = r))
  const firstReadGate = new Promise<void>(r => (releaseFirstRead = r))
  let reads = 0
  on('ui.status', () => ({ value: undefined }))
  on('store.get', async () => {
    if (++reads === 1) {
      markFirstRead()
      await firstReadGate
    }
    return { value: answered }
  })
  on('store.set', (_, e) => {
    answered = Number(e.value)
    return { value: undefined }
  })
  on('classic.PermissionRequest', () => ({}))
  await ydaa($, 'on')
  const first = $.classic.PermissionRequest(bash([]))
  const second = $.classic.PermissionRequest(bash([]))
  await firstReadEntered
  await ydaa($, 'off')
  releaseFirstRead()
  expect((await first).decision).toBeUndefined()
  expect((await second).decision).toBeUndefined()
  expect(answered).toBe(0)
  expect(reads).toBe(1)
})

test('/ydaa stats, word for word as the README shows it', async ($, on) => {
  mock.store(on, { answered: 1284 })
  expect(await ydaa($, 'stats')).toBe(
    'ydaa has answered 1284 permission prompts for you.\n' +
      "That's about 43 min of reading and answering you didn't have to do (2 s a prompt), and 1284 stops Claude didn't have to make.",
  )
})

for (const [answered, time] of [[1, '2 s'], [30, '1 min'], [2000, '1 h 7 min']] as const) {
  test(`/ydaa stats puts ${answered} answered at about ${time}`, async ($, on) => {
    mock.store(on, { answered })
    expect(await ydaa($, 'stats')).toContain(`about ${time} of`)
  })
}

test('the prompt is answered even when the count cannot be saved', async $ => {
  // No store beneath the plugin: every store call fails.
  await ydaa($, 'on')
  expect((await $.classic.PermissionRequest(bash([]))).decision).toEqual({ behavior: 'allow' })
})
