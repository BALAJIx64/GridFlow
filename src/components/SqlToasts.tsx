import { useEffect, useRef, useState } from 'react'
import { useOpEntries, useShowOps, type OpEntry } from '../lib/opLogger'
import { SqlBlock } from './SqlBlock'

/** "Show Database Operations" overlay: a SQL card for every operation while the topbar toggle is on. */
export function SqlToasts() {
  const entries = useOpEntries()
  const show = useShowOps()
  const [items, setItems] = useState<OpEntry[]>([])
  const seen = useRef<string | null>(entries[0]?.id ?? null)

  useEffect(() => {
    if (!entries.length) { seen.current = null; return }
    const fresh: OpEntry[] = []
    for (const e of entries) { if (e.id === seen.current) break; fresh.push(e) }
    seen.current = entries[0].id
    if (!show || !fresh.length) return
    setItems(a => [...fresh, ...a].slice(0, 4))
    fresh.forEach(e => window.setTimeout(() => setItems(a => a.filter(x => x.id !== e.id)), 6500))
  }, [entries, show])

  if (!show || !items.length) return null
  return (
    <div className="sql-toast-stack" aria-live="polite" aria-label="Database operations">
      {items.map(e => (
        <div key={e.id} className={`sql-toast ${e.ok ? '' : 'sql-toast-fail'}`}>
          <div className="sql-toast-head"><b>{e.type}</b><span>{e.table}</span><i>{e.ms} ms</i></div>
          <SqlBlock sql={e.sql} />
          <small>{e.ok ? '✓' : '✕'} {e.response}</small>
        </div>
      ))}
    </div>
  )
}
