import type { Ledger, LedgerRow, LedgerStatus, LedgerView } from '../types'

// Pure helpers for the ledger view: no `$`, no I/O, so the tests call them directly.

const STATUSES: readonly LedgerStatus[] = ['open', 'active', 'awaiting', 'blocked', 'done', 'dropped']
// DECISION: header keys match case-sensitively at the start of a line, as the
// orchestrate skill writes them; the first occurrence of each wins.
const HEADER = /^(Job|Vehicle|Callback|Review mode):[ \t]*(.*?)\s*$/
const HEADER_KEYS = { Job: 'job', Vehicle: 'vehicle', Callback: 'callback', 'Review mode': 'review' } as const
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
 * Reads the orchestrate skill's ledger format: `Job:`, `Vehicle:`, `Callback:` and
 * `Review mode:` header lines, and every table whose header row names `Task ID` and `Status`.
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
        ledger[HEADER_KEYS[header[1] as keyof typeof HEADER_KEYS]] ??= header[2]
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
  const { job, vehicle, callback, review, rows } = view.ledger
  const lines = [`Autopilot ledger: ${view.path}`]
  if (job !== undefined) lines.push(`Job: ${job}`)
  if (review !== undefined) lines.push(`Review mode: ${review}`)
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

// Terminal cell widths. East Asian wide and fullwidth characters and most emoji take two
// cells; combining marks, zero-width characters and variation selectors take none.
const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{20000}-\u{3FFFD}]/u
const ZERO_WIDTH = /[\p{Mn}\p{Me}​-‏⁠︀-️]/u

export function charWidth(char: string): number {
  if (ZERO_WIDTH.test(char)) return 0
  return WIDE.test(char) ? 2 : 1
}

export function displayWidth(text: string): number {
  let width = 0
  for (const char of text) width += charWidth(char)
  return width
}

/** Cuts `text` to `width` terminal cells, an ellipsis marking the cut; '' at width 0. */
export function truncate(text: string, width: number): string {
  if (displayWidth(text) <= width) return text
  if (width <= 0) return ''
  let kept = ''
  let used = 0
  for (const char of text) {
    const w = charWidth(char)
    if (used + w > width - 1) break
    kept += char
    used += w
  }
  return `${kept}…`
}

// Splits text into words, runs of spaces (as ' '), and single wide characters, which may
// break anywhere since CJK text has no spaces between words. Each token keeps its offset.
function tokensOf(text: string): { text: string; start: number }[] {
  const tokens: { text: string; start: number }[] = []
  let word = ''
  let wordStart = 0
  let offset = 0
  const endWord = () => {
    if (word !== '') tokens.push({ text: word, start: wordStart })
    word = ''
  }
  for (const char of text) {
    if (/\s/.test(char)) {
      endWord()
      if (tokens.at(-1)?.text !== ' ') tokens.push({ text: ' ', start: offset })
    } else if (charWidth(char) === 2) {
      endWord()
      tokens.push({ text: char, start: offset })
    } else {
      if (word === '') wordStart = offset
      word += char
    }
    offset += char.length
  }
  endWord()
  return tokens
}

/**
 * Word-wraps `text` into at most `maxLines` lines of `width` cells. A word longer than
 * a line is broken; when text is left over, the last line takes as much of it as fits
 * and ends with an ellipsis.
 */
export function wrapLines(text: string, width: number, maxLines: number): string[] {
  const room = Math.floor(width)
  const source = text.trim()
  if (room <= 0 || maxLines <= 0) return []
  const lines: string[] = []
  const starts: number[] = []
  let line = ''
  let used = 0
  let isSpaced = false
  const start = (at: number) => {
    if (line !== '') lines.push(line)
    starts.push(at)
    line = ''
    used = 0
  }

  for (const token of tokensOf(source)) {
    if (lines.length >= maxLines) break
    if (token.text === ' ') {
      isSpaced = line !== ''
      continue
    }
    const tokenWidth = displayWidth(token.text)
    const gap = isSpaced ? 1 : 0
    isSpaced = false
    if (starts.length === 0) starts.push(token.start)
    if (used + gap + tokenWidth <= room) {
      line += (gap ? ' ' : '') + token.text
      used += gap + tokenWidth
    } else if (tokenWidth <= room) {
      start(token.start)
      line = token.text
      used = tokenWidth
    } else {
      if (gap && used + 1 < room) {
        line += ' '
        used += 1
      }
      let at = token.start
      for (const char of token.text) {
        const w = charWidth(char)
        if (used + w > room) start(at)
        line += char
        used += w
        at += char.length
      }
    }
  }
  if (line !== '' && lines.length < starts.length) lines.push(line)
  if (lines.length <= maxLines && starts.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines - 1)
  const rest = source.slice(starts[maxLines - 1]).replace(/\s+/g, ' ')
  kept.push(truncate(rest, room))
  return kept
}

const EFFORT = /\b(low|medium|high|xhigh|max)\b/i

// DECISION: "opus (frontmatter high)" shows as "opus·high"; a parenthesis without an
// effort word is dropped ("opus (session)" -> "opus"); anything else shows as written.
export function compactModel(text: string): string {
  const match = /^([^\s(]+)\s*\((.*)\)\s*$/.exec(text.trim())
  if (match === null) return text.trim()
  const [, alias = '', detail = ''] = match
  const effort = EFFORT.exec(detail)?.[1]?.toLowerCase()
  return effort === undefined ? alias : `${alias}·${effort}`
}

/** The first word of a header value: "agent-tool (sc absent ...)" -> "agent-tool". */
export function firstWord(text: string): string {
  return /^[^\s(;,.]+/.exec(text.trim())?.[0] ?? text.trim()
}

const LIVE_ORDER: readonly LedgerStatus[] = ['active', 'awaiting', 'blocked', 'open']

/** Rows still in play, by status then ledger order, and the done and dropped ones. */
export function splitRows(rows: readonly LedgerRow[]): { live: LedgerRow[]; settled: LedgerRow[] } {
  const live = LIVE_ORDER.flatMap(status => rows.filter(row => row.status === status))
  const settled = rows.filter(row => row.status === 'done' || row.status === 'dropped')
  return { live, settled }
}

/** "✓ 2 done: A, B  ✗ 1 dropped: C", empty parts left out. */
export function settledLine(rows: readonly LedgerRow[]): string {
  const part = (status: LedgerStatus, mark: string) => {
    const ids = rows.filter(row => row.status === status).map(row => row.taskId)
    return ids.length === 0 ? '' : `${mark} ${ids.length} ${status}: ${ids.join(', ')}`
  }
  return [part('done', '✓'), part('dropped', '✗')].filter(text => text !== '').join('  ')
}

/** Done tasks against the tasks that count (dropped ones do not), and the live counts. */
export function progressText(ledger: Ledger): { done: number; total: number; text: string } {
  const done = countOf(ledger, 'done')
  const total = ledger.rows.length - countOf(ledger, 'dropped')
  const live = LIVE_ORDER.map(status => [status, countOf(ledger, status)] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
  return { done, total, text: [`${done}/${total} done`, ...live].join(' · ') }
}

/** Filled and empty cells of a bar `width` wide. */
export function barCells(done: number, total: number, width: number): { filled: number; empty: number } {
  const cells = Math.max(0, Math.floor(width))
  const filled = total <= 0 ? 0 : Math.round((Math.min(done, total) / total) * cells)
  return { filled, empty: cells - filled }
}

/** Cell widths of the pane's table; 0 hides a column. `notesBelow` puts Notes on lines of their own. */
export type LedgerLayout = {
  taskId: number
  status: number
  role: number
  modelUsed: number
  notes: number
  notesBelow: boolean
}

export const STATUS_WIDTH = 10 // a marker, a space and "awaiting"
export const NOTES_INDENT = 2
export const NOTE_LINES = 3
const GAP = 1
const NOTES_INLINE_MIN = 40

function widest(header: string, values: readonly string[], cap: number): number {
  return Math.min(cap, Math.max(displayWidth(header), ...values.map(displayWidth)))
}

// DECISION: Task ID and Status always show; Role (up to 17, so security-engineer fits),
// then Model, join while they fit. Notes sit beside the row when at least 40 cells remain,
// else under it indented by 2; either way they wrap to NOTE_LINES lines.
export function layoutColumns(rows: readonly LedgerRow[], bodyColumns: number): LedgerLayout {
  const room = Math.max(1, Math.floor(bodyColumns))
  const taskId = Math.min(widest('ID', rows.map(row => row.taskId), 12), Math.max(1, room - GAP - STATUS_WIDTH))
  let used = taskId + GAP + STATUS_WIDTH

  const roleWanted = widest('Role', rows.map(row => row.role), 17)
  const role = used + GAP + roleWanted <= room ? roleWanted : 0
  if (role > 0) used += GAP + role

  const modelWanted = widest('Model', rows.map(row => compactModel(row.modelUsed)), 16)
  const modelUsed = used + GAP + modelWanted <= room ? modelWanted : 0
  if (modelUsed > 0) used += GAP + modelUsed

  const inline = room - used - GAP
  return inline >= NOTES_INLINE_MIN
    ? { taskId, status: STATUS_WIDTH, role, modelUsed, notes: inline, notesBelow: false }
    : { taskId, status: STATUS_WIDTH, role, modelUsed, notes: Math.max(0, room - NOTES_INDENT), notesBelow: true }
}
