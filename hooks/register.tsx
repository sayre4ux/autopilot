import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, Register } from 'claude-code'

import type { LedgerRow, LedgerStatus, LedgerView } from '../types'
import {
  NOTES_INDENT,
  NOTE_LINES,
  barCells,
  compactModel,
  displayWidth,
  firstWord,
  layoutColumns,
  parseLedger,
  problemLine,
  progressText,
  settledLine,
  splitRows,
  statusLine,
  summaryText,
  truncate,
  wrapLines,
} from './ledger'

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
const SHOW_SETTLED = atom({ plugin: 'autopilot', key: 'showSettled' } as const, false)
const LABEL_WIDTH = 8
const BAR_MAX = 20
const BAR_MIN = 4

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

  // DECISION: the pane leads with the rows still in play (active, awaiting, blocked, open)
  // and folds done and dropped rows into one line that `d` expands. With nothing in play
  // it lists the settled rows outright. Notes wrap to NOTE_LINES lines instead of one.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const view = await read($, LEDGER)
    const showSettled = await read($, SHOW_SETTLED)
    const width = Math.max(1, Math.floor(e.props.bodyColumns))
    const rule = <Text dimColor>{'─'.repeat(width)}</Text>

    const rows = view?.ledger?.rows ?? []
    const { live, settled } = splitRows(rows)
    const canFold = live.length > 0 && settled.length > 0

    // DECISION: the buttons lead the pane so a long ledger never scrolls them away.
    const buttons = (
      <Box flexDirection="row" gap={1}>
        <Button key="refresh" label="Refresh" hotkey="r" onPress={() => refresh($, true)} />
        <Button key="close" label="Close" hotkey="c" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
        {canFold && (
          <Button
            key="settled"
            label={showSettled ? 'Hide done' : `Show done (${settled.length})`}
            hotkey="d"
            onPress={() => update($, SHOW_SETTLED, isShown => !isShown)}
          />
        )}
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

    const { job, vehicle, review } = view.ledger
    const valueWidth = Math.max(1, width - LABEL_WIDTH)
    const lines = (key: string, texts: string[], style: TextStyle = {}) =>
      texts.map((text, index) => (
        <Box key={`${key}-${index}`}>
          <Text wrap="truncate" {...style}>
            {text}
          </Text>
        </Box>
      ))
    const field = (label: string, value: string, maxLines: number) => (
      <Box key={`field-${label}`} flexDirection="row">
        <Box width={LABEL_WIDTH} flexShrink={0}>
          <Text dimColor>{label}</Text>
        </Box>
        <Box flexDirection="column">{lines(label, wrapLines(value, valueWidth, maxLines))}</Box>
      </Box>
    )
    // DECISION: Callback is plumbing for the orchestrator and stays out of the pane;
    // Vehicle and Review mode show as their first word on one "Run" line.
    const run = [
      review === undefined ? '' : `review ${firstWord(review)}`,
      vehicle === undefined ? '' : `via ${firstWord(vehicle)}`,
    ].filter(part => part !== '')

    // DECISION: the bar sits before the counts while both fit, else on a line of its own.
    const progress = progressText(view.ledger)
    const besideWidth = Math.min(BAR_MAX, width - displayWidth(progress.text) - 1)
    const isBeside = besideWidth >= BAR_MIN
    const bar = barCells(progress.done, progress.total, isBeside ? besideWidth : Math.min(BAR_MAX, width))
    const barCellsDrawn = (
      <Box flexDirection="row" flexShrink={0}>
        {bar.filled > 0 && <Text color="green">{'█'.repeat(bar.filled)}</Text>}
        {bar.empty > 0 && <Text dimColor>{'░'.repeat(bar.empty)}</Text>}
      </Box>
    )
    const progressLine =
      rows.length === 0 ? (
        <Text dimColor>No tasks yet.</Text>
      ) : isBeside ? (
        <Box flexDirection="row">
          {barCellsDrawn}
          <Text wrap="truncate"> {progress.text}</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {barCellsDrawn}
          <Text wrap="truncate">{truncate(progress.text, width)}</Text>
        </Box>
      )

    const cols = layoutColumns(rows, width)
    const cell = (cellWidth: number, text: string, style: TextStyle = {}) =>
      cellWidth > 0 && (
        <Box width={cellWidth} flexShrink={0}>
          <Text wrap="truncate" {...style}>
            {truncate(text, cellWidth)}
          </Text>
        </Box>
      )
    const rowOf = (row: LedgerRow, key: string, isSettled: boolean, noteLines: number) => {
      const dim: TextStyle = isSettled ? { dimColor: true } : {}
      const notes = cols.notes > 0 ? wrapLines(row.notes, cols.notes, noteLines) : []
      return (
        <Box key={key} flexDirection="column">
          <Box flexDirection="row" gap={1}>
            {cell(cols.taskId, row.taskId, isSettled ? dim : { bold: true })}
            {cell(cols.status, `${MARKERS[row.status]} ${row.status}`, statusStyle(row.status))}
            {cell(cols.role, row.role, dim)}
            {cell(cols.modelUsed, compactModel(row.modelUsed), dim)}
            {!cols.notesBelow && notes.length > 0 && (
              <Box width={cols.notes} flexShrink={0} flexDirection="column">
                {lines(`${key}-notes`, notes, { dimColor: true })}
              </Box>
            )}
          </Box>
          {cols.notesBelow && notes.length > 0 && (
            <Box paddingLeft={NOTES_INDENT} flexDirection="column">
              {lines(`${key}-notes`, notes, { dimColor: true })}
            </Box>
          )}
        </Box>
      )
    }

    const listed = live.length === 0 ? settled : live
    const isFolded = canFold && !showSettled

    return (
      <Box flexDirection="column">
        {buttons}
        {job !== undefined && field('Job', job, 2)}
        {run.length > 0 && field('Run', run.join(' · '), 1)}
        {progressLine}
        {rows.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Box flexDirection="row" gap={1}>
              {cell(cols.taskId, 'ID', { bold: true })}
              {cell(cols.status, 'Status', { bold: true })}
              {cell(cols.role, 'Role', { bold: true })}
              {cell(cols.modelUsed, 'Model', { bold: true })}
              {!cols.notesBelow && cell(cols.notes, 'Notes', { bold: true })}
            </Box>
            {rule}
            {listed.map((row, index) => rowOf(row, `row-${index}`, live.length === 0, NOTE_LINES))}
            {canFold && rule}
            {isFolded && (
              <Text dimColor wrap="truncate">
                {truncate(settledLine(settled), width)}
              </Text>
            )}
            {canFold && showSettled && settled.map((row, index) => rowOf(row, `settled-${index}`, true, 1))}
          </Box>
        )}
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
