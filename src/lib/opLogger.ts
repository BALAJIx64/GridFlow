import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

export type OpType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COUNT' | 'RPC'
export type OpEntry = {
  id: string
  ts: string
  type: OpType
  table: string
  sql: string
  rows: number | null
  ms: number
  ok: boolean
  /** Response text, in the style of the MySQL Workbench "Action Output" column. */
  response: string
  persisted: boolean
}
type DbError = { message: string; code?: string } | null | undefined
type Result = { data?: unknown; error?: DbError; count?: number | null }
export type TrackMeta = {
  type: OpType
  table: string
  sql: string
  /** Writes are persisted to db_operation_logs; reads stay in the live session only. */
  write?: boolean
  rows?: (res: any) => number | null
  note?: (res: any) => string
  /** Overrides `write` when the outcome decides whether a log row is worth keeping. */
  persistWhen?: (rows: number | null, ok: boolean) => boolean
}

const MAX_ENTRIES = 500
const SHOW_KEY = 'gridflow.showDbOps'
const listeners = new Set<() => void>()
let entries: OpEntry[] = []
let showOps = (() => { try { return localStorage.getItem(SHOW_KEY) === '1' } catch { return false } })()
let actorEmail: string | null = null
let seq = 0
const emit = () => listeners.forEach(l => l())

export const opLog = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
  entries: () => entries,
  clear() { entries = []; emit() },
  showOps: () => showOps,
  setShowOps(v: boolean) { showOps = v; try { localStorage.setItem(SHOW_KEY, v ? '1' : '0') } catch { /* storage unavailable */ } emit() },
  setActor(email: string | null) { actorEmail = email },
}

export const useOpEntries = () => useSyncExternalStore(opLog.subscribe, opLog.entries)
export const useShowOps = () => useSyncExternalStore(opLog.subscribe, opLog.showOps)

const defaultRows = (res: Result): number | null => {
  if (res.error) return 0
  if (Array.isArray(res.data)) return res.data.length
  return res.data === null || res.data === undefined ? 0 : 1
}

/**
 * Runs a Supabase call, measures it and records an entry in the live console.
 * Write operations are additionally appended to public.db_operation_logs.
 */
export async function track<T extends Result>(meta: TrackMeta, run: () => PromiseLike<T>): Promise<T> {
  const started = performance.now()
  let res: T
  try {
    res = await run()
  } catch (e) {
    res = { data: null, error: { message: e instanceof Error ? e.message : 'Request failed' } } as T
  }
  const ms = Math.round((performance.now() - started) * 100) / 100
  const ok = !res.error
  const rows = ok ? (meta.rows ? meta.rows(res) : defaultRows(res)) : 0
  const response = ok
    ? meta.note ? meta.note(res) : `${rows ?? 0} row(s) ${meta.type === 'SELECT' || meta.type === 'COUNT' ? 'returned' : 'affected'}`
    : `Error${res.error?.code ? ` ${res.error.code}` : ''}: ${res.error?.message}`
  const persist = meta.persistWhen ? meta.persistWhen(rows, ok) : !!meta.write
  const entry: OpEntry = { id: `op-${++seq}`, ts: new Date().toISOString(), type: meta.type, table: meta.table, sql: meta.sql, rows, ms, ok, response, persisted: persist }
  entries = [entry, ...entries].slice(0, MAX_ENTRIES)
  emit()
  if (persist && supabase) {
    void Promise.resolve(supabase.from('db_operation_logs').insert({
      actor_email: actorEmail, op_type: entry.type, table_name: entry.table, sql_text: entry.sql,
      rows_affected: entry.rows, duration_ms: entry.ms, success: ok, error_message: ok ? null : response,
    })).catch(() => undefined)
  }
  return res
}

export const toCsv = (rows: OpEntry[]) => {
  const q = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  return ['timestamp,operation,table,sql,rows,duration_ms,status,response',
    ...rows.map(r => [r.ts, r.type, r.table, r.sql, r.rows, r.ms, r.ok ? 'SUCCESS' : 'FAILURE', r.response].map(q).join(','))].join('\r\n')
}
