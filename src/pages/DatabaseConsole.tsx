import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleAlert, Check, Clock3, Download, RefreshCw, Terminal, Trash2 } from 'lucide-react'
import { api } from '../services'
import { opLog, toCsv, useOpEntries } from '../lib/opLogger'
import { DataTable, PageToolbar, Pill, SearchControl, SectionHeading, SelectControl } from '../components/ui'
import { SqlBlock } from '../components/SqlBlock'

type Row = { id: string; ts: string; type: string; table: string; sql: string; rows: number | null; ms: number | null; ok: boolean; response: string; actor?: string | null }
type View = 'live' | 'audit'

const stamp = (iso: string) => {
  const d = new Date(iso), p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

/** MySQL-Workbench-style audit view of every statement GridFlow sends to PostgreSQL. */
export function DatabaseConsole() {
  const live = useOpEntries()
  const [view, setView] = useState<View>('live')
  const [audit, setAudit] = useState<Row[]>([])
  const [auditError, setAuditError] = useState('')
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState(''), [type, setType] = useState('All operations'), [table, setTable] = useState('All tables'), [status, setStatus] = useState('All results')
  const [open, setOpen] = useState<string | null>(null)

  const loadAudit = useCallback(async () => {
    setLoading(true); setAuditError('')
    try {
      const data = await api.operationLogs()
      setAudit(data.map(r => ({ id: `db-${r.id}`, ts: r.created_at, type: r.op_type, table: r.table_name || '—', sql: r.sql_text, rows: r.rows_affected, ms: r.duration_ms, ok: r.success, response: r.success ? `${r.rows_affected ?? 0} row(s) affected` : (r.error_message || 'Failed'), actor: r.actor_email })))
    } catch (e) { setAuditError(e instanceof Error ? e.message : 'Audit log could not be loaded.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (view === 'audit') void loadAudit() }, [view, loadAudit])

  const source: Row[] = view === 'live' ? live : audit
  const tables = useMemo(() => ['All tables', ...Array.from(new Set(source.map(r => r.table))).sort()], [source])
  const rows = source.filter(r =>
    (type === 'All operations' || r.type === type) && (table === 'All tables' || r.table === table) &&
    (status === 'All results' || (status === 'Success') === r.ok) &&
    `${r.sql} ${r.table} ${r.type} ${r.response} ${r.actor || ''}`.toLowerCase().includes(q.toLowerCase()))
  const failed = source.filter(r => !r.ok).length
  const timed = source.filter(r => r.ms !== null)
  const avg = timed.length ? timed.reduce((n, r) => n + Number(r.ms), 0) / timed.length : 0

  const exportCsv = () => {
    const csv = toCsv(rows.map(r => ({ id: r.id, ts: r.ts, type: r.type as never, table: r.table, sql: r.sql, rows: r.rows, ms: Number(r.ms ?? 0), ok: r.ok, response: r.response, persisted: view === 'audit' })))
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), a = document.createElement('a')
    a.href = url; a.download = `gridflow-db-${view}-log.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return <div className="entity-page">
    <SectionHeading eyebrow="DBMS WORKBENCH" title="Database Console" subtitle="Every statement sent to PostgreSQL, with timing, rows affected and result." action={<div className="title-actions">
      {view === 'live' ? <button className="button-outline" onClick={() => opLog.clear()} disabled={!live.length}><Trash2 size={15} /> Clear session</button> : <button className="button-outline" onClick={() => void loadAudit()} disabled={loading}><RefreshCw size={15} /> Refresh</button>}
      <button className="button-primary" onClick={exportCsv} disabled={!rows.length}><Download size={15} /> Export CSV</button></div>} />
    <div className="console-tabs">
      <button className={view === 'live' ? 'button-primary' : 'button-outline'} onClick={() => setView('live')}><Terminal size={15} /> Live session ({live.length})</button>
      <button className={view === 'audit' ? 'button-primary' : 'button-outline'} onClick={() => setView('audit')}><Clock3 size={15} /> Audit log (persisted writes)</button>
    </div>
    <div className="entity-summary-strip">
      <div><span className="summary-icon blue"><Terminal size={17} /></span><span><small>Statements</small><b>{source.length}</b></span></div>
      <div><span className="summary-icon green"><Check size={17} /></span><span><small>Successful</small><b>{source.length - failed}</b></span></div>
      <div><span className="summary-icon red"><CircleAlert size={17} /></span><span><small>Failed</small><b>{failed}</b></span></div>
      <div><span className="summary-icon violet"><Clock3 size={17} /></span><span><small>Avg execution time</small><b>{avg.toFixed(1)} ms</b></span></div>
    </div>
    <div className="panel table-panel">
      <PageToolbar>
        <SearchControl value={q} onChange={setQ} placeholder="Search SQL, table or message" />
        <SelectControl value={type} onChange={setType} options={['All operations', 'SELECT', 'COUNT', 'INSERT', 'UPDATE', 'DELETE', 'RPC']} />
        <SelectControl value={table} onChange={setTable} options={tables} />
        <SelectControl value={status} onChange={setStatus} options={['All results', 'Success', 'Failure']} />
      </PageToolbar>
      {auditError && <div className="form-error" style={{ margin: '0 16px 12px' }}><CircleAlert size={14} />{auditError}</div>}
      <DataTable headers={['#', 'STATUS', 'TIMESTAMP', 'OPERATION', 'TABLE', 'SQL-EQUIVALENT STATEMENT', 'ROWS AFFECTED', 'EXECUTION TIME']}>
        {rows.map((r, i) => <>
          <tr key={r.id} className="console-row" onClick={() => setOpen(open === r.id ? null : r.id)} title="Click to expand">
            <td className="console-seq">{rows.length - i}</td>
            <td><Pill tone={r.ok ? 'green' : 'red'} dot>{r.ok ? 'SUCCESS' : 'FAILURE'}</Pill></td>
            <td className="console-time">{stamp(r.ts)}</td>
            <td><Pill tone="blue">{r.type}</Pill></td>
            <td className="mono-cell">{r.table}</td>
            <td><span className="console-sql">{r.sql.replace(/\s+/g, ' ')}</span></td>
            <td className="console-num">{r.rows ?? '—'}</td>
            <td className="console-num">{r.ms === null ? '—' : `${Number(r.ms).toFixed(2)} ms`}</td>
          </tr>
          {open === r.id && <tr key={`${r.id}-d`} className="console-detail"><td colSpan={8}>
            <SqlBlock sql={r.sql} />
            <div className={`console-response ${r.ok ? '' : 'fail'}`}>{r.ok ? '✓' : '✕'} {r.response}{r.actor ? `  ·  by ${r.actor}` : ''}</div>
          </td></tr>}
        </>)}
      </DataTable>
      {rows.length === 0 && <div className="console-empty">
        {loading ? 'Loading audit log…' : source.length ? 'No statements match the current filters.' : view === 'live' ? 'No statements yet. Use the application and every database call will appear here.' : 'No write operations have been recorded yet.'}
      </div>}
      <div className="console-note">{view === 'live' ? 'Live session: SELECT, COUNT, search and report queries are kept in memory only (last 500).' : 'Audit log: INSERT, UPDATE, DELETE, bill generation, payments and role changes are stored permanently in db_operation_logs.'}</div>
    </div>
  </div>
}
