import type { Ledger, LedgerRow, LedgerStatus, LedgerView } from '../types'

// Pure helpers for the ledger view: no `$`, no I/O, so the tests call them directly.

const STATUSES: readonly LedgerStatus[] = ['open', 'active', 'awaiting', 'blocked', 'done', 'dropped']
// DECISION: header keys match case-sensitively at the start of a line, as the
// orchestrate skill writes them; the first occurrence of each wins.
const HEADER = /^(Job|Vehicle|Callback):[ \t]*(.*?)\s*$/
const SEPARATOR_CELL = /^:?-+:?$/

// Splits one markdown table line into trimmed cells, honouring `\|` as a literal pipe.
function cellsOf(line: string): string[] {
  let body = line.trim()
  if (body.startsWith('|')) body = body.slice(1)
  if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1)
  const cells: string[] = []
  let cell = ''
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (char === '\\' && body[i + 1] === '|') {
      cell += '|'
      i++
    } else if (char === '|') {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell.trim())
  return cells
}

type Columns = { taskId: number; role: number; status: number; modelUsed: number; notes: number; count: number }

function columnsOf(cells: readonly string[]): Columns | undefined {
  const names = cells.map(cell => cell.toLowerCase())
  const taskId = names.indexOf('task id')
  const status = names.indexOf('status')
  if (taskId < 0 || status < 0) return undefined
  return {
    taskId,
    status,
    role: names.indexOf('role'),
    modelUsed: names.indexOf('model used'),
    notes: names.indexOf('notes'),
    count: cells.length,
  }
}

// DECISION: a row with fewer cells than the header is malformed and skipped; one with
// more keeps the extras joined into the last column, since an unescaped `|` in Notes
// is the usual cause and dropping the row would hide live work from the counts.
function rowOf(cells: string[], columns: Columns): LedgerRow | undefined {
  if (cells.length < columns.count) return undefined
  const fitted = cells.slice(0, columns.count - 1)
  fitted.push(cells.slice(columns.count - 1).join(' | '))
  const at = (index: number) => (index < 0 ? '' : (fitted[index] ?? ''))

  const taskId = at(columns.taskId)
  // DECISION: the status is the cell's leading word, case-insensitive ("done — REFUTED
  // ..." is done); a row whose word is not one of the six statuses is skipped.
  const word = /^[a-z]+/i.exec(at(columns.status))?.[0]?.toLowerCase()
  const status = STATUSES.find(one => one === word)
  if (taskId === '' || status === undefined) return undefined

  return { taskId, role: at(columns.role), status, modelUsed: at(columns.modelUsed), notes: at(columns.notes) }
}

/**
 * Reads the orchestrate skill's ledger format: `Job:`, `Vehicle:` and `Callback:`
 * header lines, and every table whose header row names `Task ID` and `Status`.
 * Never throws; lines it cannot read are skipped.
 */
export function parseLedger(text: string): Ledger {
  const ledger: Ledger = { rows: [] }
  let columns: Columns | undefined

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) {
      columns = undefined
      const header = HEADER.exec(line)
      if (header !== null && header[2] !== '') {
        const key = header[1] === 'Job' ? 'job' : header[1] === 'Vehicle' ? 'vehicle' : 'callback'
        ledger[key] ??= header[2]
      }
      continue
    }

    const cells = cellsOf(line)
    if (columns === undefined) {
      columns = columnsOf(cells)
      continue
    }
    if (cells.every(cell => SEPARATOR_CELL.test(cell))) continue

    const row = rowOf(cells, columns)
    if (row !== undefined) ledger.rows.push(row)
  }

  return ledger
}

export function countOf(ledger: Ledger, status: LedgerStatus): number {
  return ledger.rows.filter(row => row.status === status).length
}

/** The status-line text, or undefined (clears it) when nothing is active or awaiting. */
export function statusLine(ledger: Ledger | null): string | undefined {
  if (ledger === null) return undefined
  const active = countOf(ledger, 'active')
  const awaiting = countOf(ledger, 'awaiting')
  return active + awaiting > 0 ? `autopilot: ${active} active · ${awaiting} awaiting` : undefined
}

export function problemLine(view: LedgerView): string {
  return view.problem === 'unreadable' ? `Cannot read the ledger at ${view.path}` : `No ledger at ${view.path}`
}

/** One line counting the rows per status, in the format's order, zero counts left out. */
export function tallyLine(ledger: Ledger): string {
  const counts = STATUSES.map(status => [status, countOf(ledger, status)] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
  const tasks = ledger.rows.length === 1 ? '1 task' : `${ledger.rows.length} tasks`
  return counts.length === 0 ? tasks : `${tasks}: ${counts.join(', ')}`
}

// DECISION: the plain-text answer for a surface that draws nothing lists every row
// with its notes in full; a headless caller has no pane to look at instead.
export function summaryText(view: LedgerView): string {
  if (view.ledger === null) return problemLine(view)
  const { job, vehicle, callback, rows } = view.ledger
  const lines = [`Autopilot ledger: ${view.path}`]
  if (job !== undefined) lines.push(`Job: ${job}`)
  if (vehicle !== undefined) lines.push(`Vehicle: ${vehicle}`)
  if (callback !== undefined) lines.push(`Callback: ${callback}`)
  lines.push(tallyLine(view.ledger))
  for (const row of rows) {
    const who = [row.role, row.modelUsed].filter(part => part !== '').join(' · ')
    const notes = row.notes === '' ? '' : ` — ${row.notes}`
    lines.push(`- ${row.taskId} [${row.status}]${who === '' ? '' : ` ${who}`}${notes}`)
  }
  return lines.join('\n')
}

/** Cuts `text` to `width` code points, an ellipsis marking the cut; '' at width 0. */
export function truncate(text: string, width: number): string {
  const chars = Array.from(text)
  if (chars.length <= width) return text
  if (width <= 0) return ''
  return `${chars.slice(0, width - 1).join('')}…`
}

/** Cell widths of the pane's table; 0 hides a column. `notesBelow` puts Notes on a line of its own. */
export type LedgerLayout = {
  taskId: number
  status: number
  role: number
  modelUsed: number
  notes: number
  notesBelow: boolean
}

export const STATUS_WIDTH = 10 // a marker, a space and "awaiting"
const GAP = 1
const NOTES_INLINE_MIN = 20
export const NOTES_INDENT = 2

function widest(header: string, values: readonly string[], cap: number): number {
  return Math.min(cap, Math.max(header.length, ...values.map(value => Array.from(value).length)))
}

// DECISION: Task ID and Status always show; Role, then Model Used, join while they fit
// beside them. Notes take the rest of the line when at least 20 cells remain, else a
// line of their own under the row, indented by 2, so a narrow pane still shows them.
export function layoutColumns(rows: readonly LedgerRow[], bodyColumns: number): LedgerLayout {
  const room = Math.max(1, Math.floor(bodyColumns))
  const taskId = Math.min(widest('Task ID', rows.map(row => row.taskId), 12), Math.max(1, room - GAP - STATUS_WIDTH))
  let used = taskId + GAP + STATUS_WIDTH

  const roleWanted = widest('Role', rows.map(row => row.role), 16)
  const role = used + GAP + roleWanted <= room ? roleWanted : 0
  if (role > 0) used += GAP + role

  const modelWanted = widest('Model', rows.map(row => row.modelUsed), 16)
  const modelUsed = used + GAP + modelWanted <= room ? modelWanted : 0
  if (modelUsed > 0) used += GAP + modelUsed

  const inline = room - used - GAP
  return inline >= NOTES_INLINE_MIN
    ? { taskId, status: STATUS_WIDTH, role, modelUsed, notes: inline, notesBelow: false }
    : { taskId, status: STATUS_WIDTH, role, modelUsed, notes: Math.max(0, room - NOTES_INDENT), notesBelow: true }
}
