import type { On, RenderPropsOf, RenderSurface } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { layoutColumns, parseLedger, statusLine, summaryText, truncate } from './ledger'

const ROOT = '/work/project'
const PATH = `${ROOT}/.autopilot/ledger.md`
const PANE = 'autopilot-ledger'
const DRAWING = ['terminal', 'desktop', 'vscode', 'mobile'] as const

// The live ledger of this job (2026-10-03), trimmed to the header and table.
const SAMPLE = `# Task Ledger

Vehicle: agent-tool (sc absent from PATH; auto-entered, but no delegation-restriction line in this session's system prompt)
Callback: none (harness notification)

Job: add a mod (function hooks) alongside the autopilot plugin. Baseline 2a3ba5d.
Review mode: off (default). User checks in before each major step.

| Task ID | Type | Role | Status | Depends On | Vehicle | Model Used | Notes |
|---|---|---|---|---|---|---|---|
| MOD | code | senior-engineer | done | - | agent-tool (background) | opus (frontmatter high) | brief .autopilot/dispatch/MOD.md; Fable gate + nested-spawn backstop |
| PYHOOK | code | engineer | active | - | agent-tool (background) | opus (frontmatter medium) | brief .autopilot/dispatch/PYHOOK.md; runs parallel to MOD |
| PANE | code | senior-engineer | active | MOD | agent-tool (background) | opus (frontmatter high) | brief .autopilot/dispatch/PANE.md; /autopilot:ledger read-only pane |
| CI | code | orchestrator | open | MOD,PYHOOK,PANE | - | - | claude plugin validate in CI; propose commit |
| VERIFY | verify | verifier | open | MOD,PYHOOK,PANE | - | - | R7.2 one batch over all code |
| SUPERVISE | supervise | supervisor | open | VERIFY | - | - | R8.4 final gate |
`

const QUIET = `Vehicle: sc
Callback: none

| Task ID | Type | Role | Status | Depends On | Vehicle | Model Used | Notes |
|---|---|---|---|---|---|---|---|
| A | code | engineer | done | - | sc | opus | shipped |
| B | code | engineer | open | A | - | - | next |
`

const RUN = {
  command: 'ledger',
  args: '',
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: true, columns: 160 },
}

const paneProps = (bodyColumns: number): RenderPropsOf['Pane'] => ({
  title: 'Autopilot ledger',
  isFocused: false,
  bodyColumns,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
})

type World = {
  ledger?: string
  isUnreadable?: boolean
  surfaces?: readonly RenderSurface[]
  panes?: string[]
}

// The engine beneath the plugin: answers what the ledger view asks and records it.
function world(on: On, w: World) {
  const seen = {
    reads: [] as string[],
    writes: 0,
    statuses: [] as (string | undefined)[],
    opens: [] as { id: string; title?: string }[],
    closes: [] as string[],
    commands: [] as string[],
  }
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.root', () => ({ value: ROOT }))
  on('session.surfaces', () => ({ value: w.surfaces ?? ['terminal'] }))
  on('command.register', ($, e) => {
    seen.commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('fs.read', ($, e) => {
    seen.reads.push(e.path)
    return w.ledger === undefined || w.isUnreadable ? { deny: `ENOENT: ${e.path}` } : { value: w.ledger }
  })
  on('fs.exists', () => ({ value: w.isUnreadable === true }))
  on('fs.write', () => {
    seen.writes++
    return { value: undefined }
  })
  on('ui.status', ($, e) => {
    seen.statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    seen.opens.push({ id: e.id, title: e.title })
    return { value: { isPlaced: true } }
  })
  on('ui.close', ($, e) => {
    seen.closes.push(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: (w.panes ?? []).map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })),
  }))
  return seen
}

const turnOf = (agentId?: string) => ({
  answer: '',
  durationMs: 10,
  isAborted: false,
  turnId: 'turn-1',
  reason: 'answer' as const,
  ...(agentId === undefined ? {} : { agentId }),
})

describe('parseLedger', () => {
  test('reads the header lines and every row of the real ledger', () => {
    const ledger = parseLedger(SAMPLE)
    expect(ledger.job).toBe('add a mod (function hooks) alongside the autopilot plugin. Baseline 2a3ba5d.')
    expect(ledger.vehicle).toStartWith('agent-tool (sc absent from PATH;')
    expect(ledger.callback).toBe('none (harness notification)')
    expect(ledger.rows.map(row => [row.taskId, row.status])).toEqual([
      ['MOD', 'done'],
      ['PYHOOK', 'active'],
      ['PANE', 'active'],
      ['CI', 'open'],
      ['VERIFY', 'open'],
      ['SUPERVISE', 'open'],
    ])
    expect(ledger.rows[0]).toEqual({
      taskId: 'MOD',
      role: 'senior-engineer',
      status: 'done',
      modelUsed: 'opus (frontmatter high)',
      notes: 'brief .autopilot/dispatch/MOD.md; Fable gate + nested-spawn backstop',
    })
  })

  test('takes the leading word of a status with trailing text', () => {
    const ledger = parseLedger(`| Task ID | Role | Status | Model Used | Notes |
|---|---|---|---|---|
| VERIFY | verifier | done — REFUTED on item 6 only (7 stale doc lines) | opus | R7 |
| SUPERVISE | supervisor | Awaiting: callback chat:3 | fable high | R8 |
| X | engineer | blocked, needs a key | - | - |`)
    expect(ledger.rows.map(row => row.status)).toEqual(['done', 'awaiting', 'blocked'])
  })

  test('skips malformed rows and never throws', () => {
    const ledger = parseLedger(`Vehicle:
| Task ID | Type | Role | Status | Depends On | Vehicle | Model Used | Notes |
|---|---|---|---|---|---|---|---|
| SHORT | code | engineer | active |
| BAD | code | engineer | running | - | sc | opus | unknown status |
|  | code | engineer | active | - | sc | opus | no task id |
| OK | code | engineer | awaiting | - | sc | opus | fine |
| this line is not a row
garbage | with | pipes
`)
    expect(ledger.vehicle).toBeUndefined()
    expect(ledger.rows.map(row => row.taskId)).toEqual(['OK'])
    expect(parseLedger('').rows).toEqual([])
    expect(parseLedger('| a | b |\n| c | d |').rows).toEqual([])
  })

  test('keeps escaped and stray pipes in the notes, and reads CRLF', () => {
    const ledger = parseLedger(
      '| Task ID | Role | Status | Model Used | Notes |\r\n|---|---|---|---|---|\r\n' +
        '| A | engineer | active | opus | grep a \\| b |\r\n' +
        '| B | engineer | open | opus | left | right |\r\n',
    )
    expect(ledger.rows.map(row => row.notes)).toEqual(['grep a | b', 'left | right'])
  })

  test('a blank line ends the table', () => {
    const ledger = parseLedger(`| Task ID | Role | Status | Model Used | Notes |
|---|---|---|---|---|
| A | engineer | active | opus | - |

| B | engineer | active | opus | - |`)
    expect(ledger.rows.map(row => row.taskId)).toEqual(['A'])
  })
})

describe('status line and summary', () => {
  test('counts active and awaiting, and clears when there are none', () => {
    expect(statusLine(parseLedger(SAMPLE))).toBe('autopilot: 2 active · 0 awaiting')
    expect(statusLine(parseLedger(QUIET))).toBeUndefined()
    expect(statusLine(null)).toBeUndefined()
  })

  test('summarises a missing and an unreadable ledger in one line', () => {
    expect(summaryText({ path: PATH, ledger: null, problem: 'missing' })).toBe(`No ledger at ${PATH}`)
    expect(summaryText({ path: PATH, ledger: null, problem: 'unreadable' })).toBe(`Cannot read the ledger at ${PATH}`)
  })

  test('truncates by code point with an ellipsis', () => {
    expect(truncate('abcdef', 6)).toBe('abcdef')
    expect(truncate('abcdef', 4)).toBe('abc…')
    expect(truncate('ab', 0)).toBe('')
    expect(truncate('😀😀😀', 2)).toBe('😀…')
  })

  test('lays the columns out inside the body at any width', () => {
    const rows = parseLedger(SAMPLE).rows
    for (const width of [20, 40, 60, 80, 120, 200]) {
      const cols = layoutColumns(rows, width)
      const parts = [cols.taskId, cols.status, cols.role, cols.modelUsed, cols.notesBelow ? 0 : cols.notes]
      const shown = parts.filter(part => part > 0)
      const total = shown.reduce((sum, part) => sum + part, 0) + shown.length - 1
      expect(total <= width || shown.length === 2, `width ${width}`).toBe(true)
      if (cols.notesBelow) expect(cols.notes).toBe(Math.max(0, width - 2))
    }
    expect(layoutColumns(rows, 120).notesBelow).toBe(false)
    expect(layoutColumns(rows, 40).notesBelow).toBe(true)
  })
})

describe('the /ledger command', () => {
  test('registers at session start and sets the status line', async ($, on) => {
    const seen = world(on, { ledger: SAMPLE })
    await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
    expect(seen.commands).toEqual(['ledger'])
    expect(seen.reads).toEqual([PATH])
    expect(seen.statuses).toEqual(['autopilot: 2 active · 0 awaiting'])
  })

  test('session start is silent without a ledger', async ($, on) => {
    const seen = world(on, {})
    await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
    expect(seen.commands).toEqual(['ledger'])
    expect(seen.statuses).toEqual([undefined])
  })

  test('enforcement=off still registers the command', { options: { enforcement: 'off' } }, async ($, on) => {
    const seen = world(on, { ledger: SAMPLE })
    await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
    expect(seen.commands).toEqual(['ledger'])
    const result = await $.command.run(RUN)
    expect(result.text).toBe('Autopilot ledger pane opened.')
    expect(seen.opens).toEqual([{ id: PANE, title: 'Autopilot ledger' }])
  })

  test('opens the pane on a drawing surface', async ($, on) => {
    const seen = world(on, { ledger: SAMPLE, surfaces: ['terminal'] })
    const result = await $.command.run(RUN)
    expect(result.text).toBe('Autopilot ledger pane opened.')
    expect(seen.opens).toEqual([{ id: PANE, title: 'Autopilot ledger' }])
    const ui = await $.ui.mount({ plugin: 'autopilot', surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps(120) })
    expect(await ui.find({ type: 'Text', text: /^Job: add a mod/ })).toBeDefined()
    await ui.unmount()
    expect(seen.writes).toBe(0)
  })

  test('answers in text where nothing draws', async ($, on) => {
    const seen = world(on, { ledger: SAMPLE, surfaces: [] })
    const result = await $.command.run(RUN)
    expect(seen.opens).toEqual([])
    expect(result.text).toStartWith(`Autopilot ledger: ${PATH}\nJob: add a mod`)
    expect(result.text).toContain('6 tasks: 3 open, 2 active, 1 done')
    expect(result.text).toContain('- PANE [active] senior-engineer · opus (frontmatter high) — brief .autopilot/dispatch/PANE.md')
    expect(seen.statuses).toEqual(['autopilot: 2 active · 0 awaiting'])
  })

  test('answers "No ledger at" in text when the file is missing', async ($, on) => {
    world(on, { surfaces: [] })
    expect((await $.command.run(RUN)).text).toBe(`No ledger at ${PATH}`)
  })

  test('says the ledger cannot be read when it exists but the read fails', async ($, on) => {
    world(on, { surfaces: [], isUnreadable: true, ledger: SAMPLE })
    expect((await $.command.run(RUN)).text).toBe(`Cannot read the ledger at ${PATH}`)
  })
})

describe('the ledger pane', () => {
  test('draws the header, the rows and both buttons on every surface', async ($, on) => {
    world(on, { ledger: SAMPLE })
    await $.command.run(RUN)
    for (const surface of DRAWING) {
      const ui = await $.ui.mount({ plugin: 'autopilot', surface, component: 'Pane', requestId: PANE, props: paneProps(140) })
      expect(await ui.find({ type: 'Text', text: /^Job: add a mod/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^Vehicle: agent-tool/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Callback: none (harness notification)' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'SUPERVISE' })).toBeDefined()
      expect((await ui.find({ type: 'Button', key: 'close' }))?.props.role).toBe('dismiss')
      expect(await ui.find({ type: 'Button', key: 'refresh' })).toBeDefined()

      const active = await ui.find({ type: 'Text', text: '● active' })
      const done = await ui.find({ type: 'Text', text: '✓ done' })
      expect(active?.props).toMatchObject({ color: 'green', bold: true })
      expect(done?.props).toMatchObject({ dimColor: true })
      await ui.unmount()
    }
  })

  test('truncates notes to the body width', async ($, on) => {
    const long = 'n'.repeat(300)
    world(on, {
      ledger: `| Task ID | Role | Status | Model Used | Notes |\n|---|---|---|---|---|\n| A | engineer | active | opus | ${long} |\n`,
    })
    await $.command.run(RUN)
    for (const width of [36, 100]) {
      const ui = await $.ui.mount({ plugin: 'autopilot', surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps(width) })
      const notes = await ui.find({ type: 'Text', text: /^n+…$/ })
      expect(notes).toBeDefined()
      expect(Array.from(notes?.text ?? '').length).toBeLessThan(width)
      await ui.unmount()
    }
  })

  test('shows one line when the ledger is missing', async ($, on) => {
    world(on, {})
    await $.command.run(RUN)
    for (const surface of DRAWING) {
      const ui = await $.ui.mount({ plugin: 'autopilot', surface, component: 'Pane', requestId: PANE, props: paneProps(80) })
      const texts = await ui.findAll({ type: 'Text' })
      expect(texts.map(text => text.text)).toEqual([`No ledger at ${PATH}`])
      await ui.unmount()
    }
  })

  test('Refresh re-reads the ledger and Close closes the pane', async ($, on) => {
    const w: World = { ledger: QUIET }
    const seen = world(on, w)
    await $.command.run(RUN)
    const ui = await $.ui.mount({ plugin: 'autopilot', surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps(120) })
    expect(await ui.find({ type: 'Text', text: 'PYHOOK' })).toBeUndefined()

    w.ledger = SAMPLE
    await ui.press({ key: 'refresh' })
    expect(seen.reads).toEqual([PATH, PATH])
    expect(await ui.find({ type: 'Text', text: 'PYHOOK' })).toBeDefined()
    expect(seen.statuses.at(-1)).toBe('autopilot: 2 active · 0 awaiting')

    await ui.press({ key: 'close' })
    expect(seen.closes).toEqual([PANE])
    expect(seen.writes).toBe(0)
    await ui.unmount()
  })
})

describe('turn.complete', () => {
  test('refreshes the status line, and the pane while it is open', async ($, on) => {
    const w: World = { ledger: QUIET, panes: [PANE] }
    const seen = world(on, w)
    await $.command.run(RUN)
    w.ledger = SAMPLE
    await $.turn.complete(turnOf())
    expect(seen.statuses).toEqual([undefined, 'autopilot: 2 active · 0 awaiting'])
    const ui = await $.ui.mount({ plugin: 'autopilot', surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps(120) })
    expect(await ui.find({ type: 'Text', text: 'PYHOOK' })).toBeDefined()
    await ui.unmount()
  })

  test('leaves the pane state alone while the pane is closed', async ($, on) => {
    const w: World = { ledger: QUIET, panes: [] }
    const seen = world(on, w)
    await $.command.run(RUN)
    w.ledger = SAMPLE
    await $.turn.complete(turnOf())
    expect(seen.statuses.at(-1)).toBe('autopilot: 2 active · 0 awaiting')
    const ui = await $.ui.mount({ plugin: 'autopilot', surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps(120) })
    expect(await ui.find({ type: 'Text', text: 'PYHOOK' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'B' })).toBeDefined()
    await ui.unmount()
  })

  test("ignores a subagent's turns", async ($, on) => {
    const seen = world(on, { ledger: SAMPLE, panes: [PANE] })
    await $.turn.complete(turnOf('child-1'))
    expect(seen.reads).toEqual([])
    expect(seen.statuses).toEqual([])
  })
})
