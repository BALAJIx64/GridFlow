import { Fragment, useCallback, useEffect, useState } from 'react'
import { CircleAlert, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { api, type ExplorerPage, type ExplorerTable, type ReportKey } from '../services'
import { DataTable, PageToolbar, SearchControl, SectionHeading, SelectControl } from '../components/ui'
import { SqlBlock } from '../components/SqlBlock'

const PAGE_SIZE = 10
const LAB: { key: ReportKey; title: string; blurb: string }[] = [
  { key: 'counts', title: 'COUNT(*) per entity', blurb: 'Aggregation with conditional counts and UNION ALL' },
  { key: 'zone', title: 'Usage & billing by zone', blurb: 'LEFT JOIN + GROUP BY across consumers and bills' },
  { key: 'tariff', title: 'Revenue by tariff', blurb: 'Three-table JOIN with FILTER aggregates' },
  { key: 'top', title: 'Top consumers by usage', blurb: 'JOIN + GROUP BY + ORDER BY + LIMIT' },
]

const cell = (v: unknown) => v === null || v === undefined ? <span className="explorer-null">NULL</span> : typeof v === 'object' ? JSON.stringify(v) : String(v)
const labCell = (k: string, v: unknown) => typeof v === 'number' && k.endsWith('_inr') ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v) : cell(v)

/** Read-only table browser plus a Query Lab of demonstration SQL (joins, group by, aggregates). */
export function DatabaseExplorer() {
  const [mode, setMode] = useState<'tables' | 'lab'>('tables')
  return <div className="entity-page">
    <SectionHeading eyebrow="DBMS WORKBENCH" title="Database Explorer" subtitle="Browse tables and records, and run demonstration queries against live data." />
    <div className="console-tabs">
      <button className={mode === 'tables' ? 'button-primary' : 'button-outline'} onClick={() => setMode('tables')}>Tables & records</button>
      <button className={mode === 'lab' ? 'button-primary' : 'button-outline'} onClick={() => setMode('lab')}>Query lab (JOIN · GROUP BY)</button>
    </div>
    {mode === 'tables' ? <TableBrowser /> : <QueryLab />}
  </div>
}

function TableBrowser() {
  const [tables, setTables] = useState<ExplorerTable[]>([])
  const [table, setTable] = useState('')
  const [search, setSearch] = useState(''), [debounced, setDebounced] = useState('')
  const [order, setOrder] = useState(''), [desc, setDesc] = useState(false), [offset, setOffset] = useState(0)
  const [data, setData] = useState<ExplorerPage | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)

  const loadTables = useCallback(async () => {
    try { const t = await api.explorerTables(); setTables(t); setTable(cur => cur || t[0]?.table || '') }
    catch (e) { setError(e instanceof Error ? e.message : 'Tables could not be loaded.') }
  }, [])
  useEffect(() => { void loadTables() }, [loadTables])
  useEffect(() => { const t = window.setTimeout(() => { setDebounced(search); setOffset(0) }, 350); return () => window.clearTimeout(t) }, [search])

  const loadRows = useCallback(async () => {
    if (!table) return
    setLoading(true); setError(''); setSelected(null)
    try { setData(await api.explorerRows(table, { limit: PAGE_SIZE, offset, order: order || undefined, desc, search: debounced || undefined })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Rows could not be loaded.'); setData(null) }
    finally { setLoading(false) }
  }, [table, offset, order, desc, debounced])
  useEffect(() => { void loadRows() }, [loadRows])

  const pick = (t: string) => { setTable(t); setOffset(0); setOrder(''); setDesc(false); setSearch(''); setDebounced('') }
  const total = data?.total ?? 0
  const columns = data?.columns ?? []

  return <div className="explorer-layout">
    <div className="panel explorer-tables" role="list" aria-label="Tables">
      {tables.map(t => <button key={t.table} className={t.table === table ? 'selected' : ''} onClick={() => pick(t.table)}><span>{t.table}</span><small>{t.rows}</small></button>)}
      {!tables.length && !error && <div className="console-empty">Loading tables…</div>}
    </div>
    <div className="panel table-panel">
      <PageToolbar>
        <h3>{table || 'Select a table'}</h3>
        <SearchControl value={search} onChange={setSearch} placeholder="Search rows (ILIKE)" />
        <SelectControl value={order} onChange={v => { setOrder(v); setOffset(0) }} options={[{ value: '', label: 'Default order' }, ...columns.map(c => ({ value: c.name, label: `Sort by ${c.name}` }))]} />
        <SelectControl value={desc ? 'desc' : 'asc'} onChange={v => { setDesc(v === 'desc'); setOffset(0) }} options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]} />
        <button className="button-outline" onClick={() => { void loadTables(); void loadRows() }} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </PageToolbar>
      {error && <div className="form-error" style={{ margin: '0 16px 12px' }}><CircleAlert size={14} />{error}</div>}
      <DataTable headers={columns.map(c => c.name)}>
        {(data?.rows ?? []).map((r, i) => <tr key={i} className="console-row" onClick={() => setSelected(r)}>{columns.map(c => <td key={c.name}><span className="explorer-cell" title={String(r[c.name] ?? '')}>{cell(r[c.name])}</span></td>)}</tr>)}
      </DataTable>
      {!loading && data && data.rows.length === 0 && <div className="console-empty">{debounced ? 'No rows match this search.' : `The ${table} table is empty.`}</div>}
      {loading && <div className="console-empty">Running query…</div>}
      {selected && <div className="explorer-detail"><SqlBlock sql={JSON.stringify(selected, null, 2)} /></div>}
      <div className="table-footer">
        <span>Showing <b>{total ? offset + 1 : 0}–{Math.min(offset + PAGE_SIZE, total)}</b> of <b>{total}</b> rows</span>
        <div className="pagination">
          <button disabled={offset === 0} aria-label="Previous page" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={15} /></button>
          <button className="page-active">{Math.floor(offset / PAGE_SIZE) + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</button>
          <button disabled={offset + PAGE_SIZE >= total} aria-label="Next page" onClick={() => setOffset(offset + PAGE_SIZE)}><ChevronRight size={15} /></button>
        </div>
      </div>
    </div>
  </div>
}

function QueryLab() {
  const [key, setKey] = useState<ReportKey | null>(null)
  const [result, setResult] = useState<{ rows: Record<string, unknown>[]; sql: string } | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState('')

  const run = async (k: ReportKey) => {
    setKey(k); setLoading(true); setError('')
    try { setResult(await api.report(k)) } catch (e) { setError(e instanceof Error ? e.message : 'Query failed.'); setResult(null) } finally { setLoading(false) }
  }
  const headers = result?.rows[0] ? Object.keys(result.rows[0]) : []

  return <>
    <div className="lab-grid">{LAB.map(l => <button key={l.key} className={key === l.key ? 'selected' : ''} onClick={() => void run(l.key)}><b>{l.title}</b><span>{l.blurb}</span></button>)}</div>
    <div className="panel table-panel">
      {result && <div className="lab-sql"><SqlBlock sql={result.sql} /></div>}
      {error && <div className="form-error" style={{ margin: '0 16px 12px' }}><CircleAlert size={14} />{error}</div>}
      {loading && <div className="console-empty">Running query…</div>}
      {result && headers.length > 0 && <DataTable headers={headers}>{result.rows.map((r, i) => <Fragment key={i}><tr>{headers.map(h => <td key={h}>{labCell(h, r[h])}</td>)}</tr></Fragment>)}</DataTable>}
      {result && headers.length === 0 && <div className="console-empty">The query ran but returned no rows. Add data and run it again.</div>}
      {!result && !loading && !error && <div className="console-empty">Pick a query above. Each run is also logged in the Database Console.</div>}
    </div>
  </>
}
