import { read } from 'claude-code'
import type { EngineInterface, On, Register } from 'claude-code'

import type { LedgerStatus, LedgerView } from '../types'
import { NOTES_INDENT, layoutColumns, parseLedger, problemLine, statusLine, summaryText, tallyLine, truncate } from './ledger'

const SECURITY_ENGINEER = 'autopilot:security-engineer'
const FABLE = /fable/i
// DECISION: a parent loop counts as an autopilot role when $.agent.list() reports its
// type in the plugin's namespace; a general-purpose agent carrying a role brief is not
// recognised (its type is general-purpose).
const AUTOPILOT_ROLE = /^autopilot:/

const FABLE_REASON =
  'Autopilot: security-engineer is not dispatched from a Fable session; tell the user and recommend restarting the job on opus.'
const NESTED_REASON =
  'Autopilot: autopilot roles never spawn agents; finish your own task and report back, and the orchestrator dispatches any follow-up work.'

type Mode = 'off' | 'advisory' | 'strict'

// DECISION: exact, case-sensitive match on the three values, as guard-bash.py's
// _resolve_mode does; anything else (missing, misspelled, non-string) is advisory.
function modeOf(value: unknown): Mode {
  return value === 'off' || value === 'advisory' || value === 'strict' ? value : 'advisory'
}

// DECISION: each event registration's .catch passes the event through. The engine already
// runs next(e) for a hook that throws or overruns; the handler states fail-open here
// rather than leaving it to that default. The Pane's ui.render hook has none: a drawing
// hook that throws is skipped and the engine draws its own pane.

// The ledger view: read-only, registered whatever the enforcement mode.
// DECISION: CommandSpec names allow letters, digits, `_` and `-` only, so the plugin's
// namespace cannot be part of the name; the person runs this as `/ledger`.
const COMMAND = 'ledger'
const PANE = 'autopilot-ledger'
const TITLE = 'Autopilot ledger'
const LEDGER = { plugin: 'autopilot', key: 'ledger' } as const

const MARKERS: Record<LedgerStatus, string> = {
  open: '○',
  active: '●',
  awaiting: '◐',
  blocked: '■',
  done: '✓',
  dropped: '✗',
}

// DECISION: active and awaiting are bold in color, blocked red, done and dropped dim,
// and each status keeps its marker glyph so the difference survives a colorless surface.
type TextStyle = { color?: string; bold?: boolean; dimColor?: boolean }

function statusStyle(status: LedgerStatus): TextStyle {
  if (status === 'active') return { color: 'green', bold: true }
  if (status === 'awaiting') return { color: 'yellow', bold: true }
  if (status === 'blocked') return { color: 'red' }
  if (status === 'done' || status === 'dropped') return { dimColor: true }
  return {}
}

async function readLedger($: EngineInterface): Promise<LedgerView> {
  const root = (await $.session.root()).replace(/[\\/]+$/, '')
  const path = `${root}/.autopilot/ledger.md`
  try {
    return { path, ledger: parseLedger(await $.fs.read(path)) }
  } catch {
    // DECISION: a failed read is "missing" unless the path exists, so an unreadable or
    // oversized ledger is not reported as absent.
    const exists = await $.fs.exists(path).catch(() => false)
    return { path, ledger: null, problem: exists ? 'unreadable' : 'missing' }
  }
}

// Reads the ledger, updates the status line, and hands the pane the new view when asked.
async function refresh($: EngineInterface, isForPane: boolean): Promise<LedgerView> {
  const view = await readLedger($)
  $.ui.status(statusLine(view.ledger))
  if (isForPane) await $.state.set(LEDGER, view)
  return view
}

function registerLedgerView(on: On) {
  on('session.start', async ($, e, next) => {
    // DECISION: immediate, so the ledger opens while an orchestrator turn is still running;
    // the hook reads only the file and opens the pane, assuming nothing of the turn.
    await $.command.register({
      name: COMMAND,
      description: 'Show the Autopilot task ledger in a read-only pane',
      immediate: true,
    })
    await refresh($, false)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: COMMAND }, async $ => {
    // A plain -p run or an SDK host with nothing attached draws no pane: answer in text.
    if ((await $.session.surfaces()).length === 0) {
      return { text: summaryText(await refresh($, false)) }
    }
    const view = await refresh($, true)
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    return opened.isPlaced
      ? { text: 'Autopilot ledger pane opened.' }
      : { text: `${summaryText(view)}\n\nThe ledger pane waits undrawn: ${opened.reason}` }
  }).catch(($, e, next) => next(e))

  // DECISION: refresh on the main loop's turns only; the orchestrator writes the ledger
  // there, and a subagent's turns would re-read it once per child turn. No polling timer.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const isPaneOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
      await refresh($, isPaneOpen)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const view = await read($, LEDGER)
    const width = e.props.bodyColumns

    // DECISION: the buttons lead the pane so a long ledger never scrolls them away.
    const buttons = (
      <Box flexDirection="row" gap={1}>
        <Button key="refresh" label="Refresh" hotkey="r" onPress={() => refresh($, true)} />
        <Button key="close" label="Close" hotkey="c" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
      </Box>
    )

    if (view === undefined) {
      return (
        <Box flexDirection="column">
          {buttons}
          <Text dimColor>The ledger has not been read yet; press Refresh.</Text>
        </Box>
      )
    }
    if (view.ledger === null) {
      return (
        <Box flexDirection="column">
          {buttons}
          <Text wrap="truncate-middle">{problemLine(view)}</Text>
        </Box>
      )
    }

    const { job, vehicle, callback, rows } = view.ledger
    const cols = layoutColumns(rows, width)
    const cell = (cellWidth: number, text: string, style: TextStyle = {}) =>
      cellWidth > 0 && (
        <Box width={cellWidth} flexShrink={0}>
          <Text wrap="truncate" {...style}>
            {truncate(text, cellWidth)}
          </Text>
        </Box>
      )
    const inlineNotes = (text: string, style: TextStyle = {}) => !cols.notesBelow && cell(cols.notes, text, style)

    return (
      <Box flexDirection="column">
        {buttons}
        {job !== undefined && <Text>Job: {job}</Text>}
        {vehicle !== undefined && <Text>Vehicle: {vehicle}</Text>}
        {callback !== undefined && <Text>Callback: {callback}</Text>}
        <Text dimColor>{tallyLine(view.ledger)}</Text>
        {rows.length > 0 && (
          <Box flexDirection="row" gap={1}>
            {cell(cols.taskId, 'Task ID', { bold: true })}
            {cell(cols.status, 'Status', { bold: true })}
            {cell(cols.role, 'Role', { bold: true })}
            {cell(cols.modelUsed, 'Model', { bold: true })}
            {inlineNotes('Notes', { bold: true })}
          </Box>
        )}
        {rows.map((row, index) => (
          <Box key={`row-${index}`} flexDirection="column">
            <Box flexDirection="row" gap={1}>
              {cell(cols.taskId, row.taskId)}
              {cell(cols.status, `${MARKERS[row.status]} ${row.status}`, statusStyle(row.status))}
              {cell(cols.role, row.role)}
              {cell(cols.modelUsed, row.modelUsed)}
              {inlineNotes(row.notes, { dimColor: true })}
            </Box>
            {cols.notesBelow && row.notes !== '' && cols.notes > 0 && (
              <Box paddingLeft={NOTES_INDENT}>
                <Text dimColor wrap="truncate">
                  {truncate(row.notes, cols.notes)}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )
  })
}

export const register: Register = (on, options) => {
  registerLedgerView(on)

  const mode = modeOf(options.enforcement)
  // DECISION: off disables the enforcement hooks alone; the ledger view above stays.
  if (mode === 'off') return

  // Hides security-engineer from a Fable main session's agent listing and refuses its
  // dispatch there, in advisory and strict alike. AgentOfferInput carries no model, so the
  // main loop's model comes from $.session.model().
  on('agent.offer', { agent: SECURITY_ENGINEER }, async ($, e, next) => {
    const model = await $.session.model()
    return typeof model === 'string' && FABLE.test(model) ? { isOffered: false } : next(e)
  }).catch(($, e, next) => next(e))

  // DECISION: one registration carries both spawn rules, the Fable rule first. Each rule
  // acts before the next is evaluated, so a failure in the agent lookup cannot cancel a
  // Fable deny or warning already given; in strict, a spawn breaking both rules is denied
  // with the Fable reason alone.
  on('agent.spawn', async ($, e, next) => {
    if (
      e.subagentType === SECURITY_ENGINEER &&
      typeof e.parentModel === 'string' &&
      FABLE.test(e.parentModel)
    ) {
      if (mode === 'strict') return { deny: FABLE_REASON }
      $.ui.toast(FABLE_REASON)
    }

    if (typeof e.parentAgentId === 'string' && e.parentAgentId !== '') {
      const agents = await $.agent.list()
      const parent = agents.find(agent => agent.id === e.parentAgentId)
      if (parent !== undefined && typeof parent.type === 'string' && AUTOPILOT_ROLE.test(parent.type)) {
        if (mode === 'strict') return { deny: NESTED_REASON }
        $.ui.toast(NESTED_REASON)
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))
}
