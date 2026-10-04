/** Builders for the SQL-equivalent text shown in the Database Console. */
export const lit = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return `'${String(v).replace(/'/g, "''")}'`
}

export const eq = (column: string, value: unknown) => `${column} = ${lit(value)}`

export const insertSql = (table: string, row: Record<string, unknown>) => {
  const keys = Object.keys(row)
  return `INSERT INTO ${table} (${keys.join(', ')})\nVALUES (${keys.map(k => lit(row[k])).join(', ')});`
}

export const updateSql = (table: string, row: Record<string, unknown>, where: string) =>
  `UPDATE ${table}\nSET ${Object.keys(row).map(k => `${k} = ${lit(row[k])}`).join(', ')}\nWHERE ${where};`

export const deleteSql = (table: string, where: string) => `DELETE FROM ${table}\nWHERE ${where};`

export const selectSql = (columns: string, from: string, opts: { where?: string; groupBy?: string; orderBy?: string; limit?: number; offset?: number } = {}) =>
  `SELECT ${columns}\nFROM ${from}` +
  (opts.where ? `\nWHERE ${opts.where}` : '') +
  (opts.groupBy ? `\nGROUP BY ${opts.groupBy}` : '') +
  (opts.orderBy ? `\nORDER BY ${opts.orderBy}` : '') +
  (opts.limit !== undefined ? `\nLIMIT ${opts.limit}` : '') +
  (opts.offset ? ` OFFSET ${opts.offset}` : '') + ';'
