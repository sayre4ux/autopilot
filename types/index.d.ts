export type LedgerStatus = 'open' | 'active' | 'awaiting' | 'blocked' | 'done' | 'dropped'

export type LedgerRow = {
  taskId: string
  role: string
  status: LedgerStatus
  modelUsed: string
  notes: string
}

export type Ledger = {
  job?: string
  vehicle?: string
  callback?: string
  review?: string
  rows: LedgerRow[]
}

// `ledger` is null when the file could not be read; `problem` says why.
export type LedgerView = {
  path: string
  ledger: Ledger | null
  problem?: 'missing' | 'unreadable'
}

declare module 'claude-code' {
  interface PluginState {
    // showSettled: whether the pane lists done and dropped rows or one summary line.
    autopilot: { ledger: LedgerView; showSettled: boolean }
  }
}
