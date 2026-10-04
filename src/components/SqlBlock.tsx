import React from 'react'

const TOKEN = /(--[^\n]*)|('(?:[^']|'')*')|\b(SELECT|FROM|WHERE|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|LEFT JOIN|JOIN|ON|GROUP BY|ORDER BY|LIMIT|OFFSET|COUNT|SUM|COALESCE|DISTINCT|AND|OR|AS|BEGIN|COMMIT|UNION ALL|FILTER|ILIKE|CAST|TEXT|NULL|TRUE|FALSE|NOW|IN|DESC|ASC|CURRENT_DATE|date_trunc|CALL)\b|\b(\d+(?:\.\d+)?)\b/g

/** Lightweight SQL syntax highlighter for the console and SQL toasts. */
export function SqlBlock({ sql, className = '' }: { sql: string; className?: string }) {
  const nodes: React.ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of sql.matchAll(TOKEN)) {
    const at = m.index ?? 0
    if (at > last) nodes.push(sql.slice(last, at))
    const cls = m[1] ? 'sql-cm' : m[2] ? 'sql-str' : m[3] ? 'sql-kw' : 'sql-num'
    nodes.push(<span key={i++} className={cls}>{m[0]}</span>)
    last = at + m[0].length
  }
  if (last < sql.length) nodes.push(sql.slice(last))
  return <pre className={`sql-code ${className}`}>{nodes}</pre>
}
