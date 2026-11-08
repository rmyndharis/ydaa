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

test('/ydaa on and /ydaa off flip the switch', async ($, on) => {
  mock.store(on)
  on('classic.PermissionRequest', () => ({}))
  expect(await ydaa($, 'on')).toContain('ydaa is on for this session')
  expect((await $.classic.PermissionRequest(bash([]))).decision).toEqual({ behavior: 'allow' })
  expect(await ydaa($, 'off')).toContain('Rules saved while it was on stay')
  expect((await $.classic.PermissionRequest(bash([]))).decision).toBeUndefined()
})

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
