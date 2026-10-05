/**
 * GridFlow SQL Learner Console — In-Browser SQL Execution Engine
 *
 * Implements a high-precision, client-side relational SQL parser and execution engine
 * that safely operates against the user's isolated personal sandbox database.
 * Supports DQL (SELECT, JOINs, Aggregates, GROUP BY, WHERE, ORDER BY, LIMIT),
 * DML (INSERT, UPDATE, DELETE), DDL (CREATE TABLE, DROP TABLE, ALTER, TRUNCATE),
 * and Transaction simulation (BEGIN, COMMIT, ROLLBACK).
 */

import { type SandboxTables } from './sandboxStore'

export type SqlQueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL' | 'TRANSACTION' | 'UTILITY'

export type SqlErrorDetail = {
  message: string
  code: string
  hint?: string
  position?: number
  expected?: string
}

export type SqlExecutionResult = {
  status: 'SUCCESS' | 'ERROR'
  queryType: SqlQueryType
  columns: string[]
  rows: Record<string, unknown>[]
  rowsAffected: number
  executionTimeMs: number
  message?: string
  error?: SqlErrorDetail
}

// In-memory transaction stack for rollback simulation
const transactionSnapshots = new Map<string, SandboxTables>()

export class SqlEngine {
  /**
   * Main entry point to execute an arbitrary SQL statement against sandbox tables
   */
  static execute(sql: string, tables: SandboxTables, userEmail = 'student'): { result: SqlExecutionResult; updatedTables?: SandboxTables } {
    const startTime = performance.now()
    const trimmed = sql.trim().replace(/;+\s*$/, '').trim()

    if (!trimmed) {
      return {
        result: {
          status: 'ERROR',
          queryType: 'UTILITY',
          columns: [],
          rows: [],
          rowsAffected: 0,
          executionTimeMs: 0,
          error: {
            message: 'Empty query. Please type a valid SQL query to execute.',
            code: '42601',
            hint: 'Example: SELECT * FROM consumers LIMIT 10;'
          }
        }
      }
    }

    try {
      const firstWord = trimmed.split(/\s+/)[0].toUpperCase()

      // 1. Transaction handling
      if (firstWord === 'BEGIN' || firstWord === 'START') {
        transactionSnapshots.set(userEmail, JSON.parse(JSON.stringify(tables)))
        return {
          result: {
            status: 'SUCCESS',
            queryType: 'TRANSACTION',
            columns: ['status'],
            rows: [{ status: 'TRANSACTION STARTED' }],
            rowsAffected: 0,
            executionTimeMs: Math.round(performance.now() - startTime),
            message: 'Transaction started. Modifications can be committed with COMMIT or undone with ROLLBACK.'
          }
        }
      }

      if (firstWord === 'COMMIT') {
        const hasTx = transactionSnapshots.has(userEmail)
        transactionSnapshots.delete(userEmail)
        return {
          result: {
            status: 'SUCCESS',
            queryType: 'TRANSACTION',
            columns: ['status'],
            rows: [{ status: hasTx ? 'TRANSACTION COMMITTED' : 'NO TRANSACTION ACTIVE' }],
            rowsAffected: 0,
            executionTimeMs: Math.round(performance.now() - startTime),
            message: hasTx ? 'Transaction changes committed permanently to your personal sandbox.' : 'Notice: No active transaction was open.'
          }
        }
      }

      if (firstWord === 'ROLLBACK') {
        const snapshot = transactionSnapshots.get(userEmail)
        if (snapshot) {
          transactionSnapshots.delete(userEmail)
          return {
            result: {
              status: 'SUCCESS',
              queryType: 'TRANSACTION',
              columns: ['status'],
              rows: [{ status: 'TRANSACTION ROLLED BACK' }],
              rowsAffected: 0,
              executionTimeMs: Math.round(performance.now() - startTime),
              message: 'Transaction rolled back! All changes made since BEGIN have been reverted.'
            },
            updatedTables: snapshot
          }
        }
        return {
          result: {
            status: 'ERROR',
            queryType: 'TRANSACTION',
            columns: [],
            rows: [],
            rowsAffected: 0,
            executionTimeMs: Math.round(performance.now() - startTime),
            error: {
              message: 'No active transaction to roll back.',
              code: '25P01',
              hint: 'Run BEGIN before making modifications to test transactions.'
            }
          }
        }
      }

      // 2. Utility commands (SHOW TABLES, DESCRIBE / \d)
      if (firstWord === 'SHOW' || firstWord === 'EXPLAIN' || trimmed.startsWith('\\d')) {
        return this.handleUtility(trimmed, tables, startTime)
      }
      if (firstWord === 'DESC' || firstWord === 'DESCRIBE') {
        return this.handleDescribe(trimmed, tables, startTime)
      }

      // 3. DDL (CREATE, DROP, ALTER, TRUNCATE)
      if (firstWord === 'CREATE') {
        return this.handleCreate(trimmed, tables, startTime)
      }
      if (firstWord === 'DROP') {
        return this.handleDrop(trimmed, tables, startTime)
      }
      if (firstWord === 'ALTER') {
        return this.handleAlter(trimmed, tables, startTime)
      }
      if (firstWord === 'TRUNCATE') {
        return this.handleTruncate(trimmed, tables, startTime)
      }

      // 4. DML (INSERT, UPDATE, DELETE)
      if (firstWord === 'INSERT') {
        return this.handleInsert(trimmed, tables, startTime)
      }
      if (firstWord === 'UPDATE') {
        return this.handleUpdate(trimmed, tables, startTime)
      }
      if (firstWord === 'DELETE') {
        return this.handleDelete(trimmed, tables, startTime)
      }

      // 5. DQL (SELECT)
      if (firstWord === 'SELECT' || firstWord === 'WITH') {
        return this.handleSelect(trimmed, tables, startTime)
      }

      throw new Error(`Unsupported SQL command starting with "${firstWord}". Supported statements: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, DROP TABLE, ALTER TABLE, TRUNCATE, SHOW TABLES, DESCRIBE, BEGIN, COMMIT, ROLLBACK.`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        result: {
          status: 'ERROR',
          queryType: 'UTILITY',
          columns: [],
          rows: [],
          rowsAffected: 0,
          executionTimeMs: Math.round(performance.now() - startTime),
          error: {
            message,
            code: '42000',
            hint: this.generateErrorHint(message, sql)
          }
        }
      }
    }
  }

  // =========================================================================
  // UTILITY COMMANDS (SHOW TABLES, DESCRIBE)
  // =========================================================================

  private static handleUtility(trimmed: string, tables: SandboxTables, startTime: number) {
    const upper = trimmed.toUpperCase()
    if (upper.includes('TABLES')) {
      const rows = Object.keys(tables).map(t => ({
        table_name: t,
        table_type: 'BASE TABLE',
        row_count: Array.isArray(tables[t]) ? tables[t].length : 0
      }))
      return {
        result: {
          status: 'SUCCESS' as const,
          queryType: 'UTILITY' as const,
          columns: ['table_name', 'table_type', 'row_count'],
          rows,
          rowsAffected: rows.length,
          executionTimeMs: Math.round(performance.now() - startTime),
          message: `Found ${rows.length} tables in active sandbox.`
        }
      }
    }

    if (trimmed.startsWith('\\d') || upper.startsWith('DESC')) {
      return this.handleDescribe(trimmed, tables, startTime)
    }

    throw new Error(`Unknown utility command: "${trimmed}". Use "SHOW TABLES;" or "DESCRIBE <table_name>;"`)
  }

  private static handleDescribe(trimmed: string, tables: SandboxTables, startTime: number) {
    const parts = trimmed.split(/\s+/)
    const tableName = (parts[1] || '').replace(/;$/, '').trim()
    const target = this.resolveTable(tableName, tables)
    if (!target) {
      throw new Error(`Table "${tableName}" does not exist in your sandbox. Run SHOW TABLES to see available tables.`)
    }
    const sample = (target.data[0] || {}) as Record<string, unknown>
    const columns = Object.keys(sample).map(col => {
      const val = sample[col]
      let dataType = 'text'
      if (typeof val === 'number') dataType = Number.isInteger(val) ? 'integer' : 'numeric'
      else if (typeof val === 'boolean') dataType = 'boolean'
      else if (col.endsWith('_at') || col.endsWith('Date') || col === 'due') dataType = 'timestamp'
      return {
        column_name: col,
        data_type: dataType,
        nullable: col === 'id' ? 'NO' : 'YES',
        sample_value: val !== undefined && val !== null ? String(val) : 'NULL'
      }
    })

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'UTILITY' as const,
        columns: ['column_name', 'data_type', 'nullable', 'sample_value'],
        rows: columns,
        rowsAffected: columns.length,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: `Schema for table "${target.name}": ${columns.length} columns.`
      }
    }
  }

  // =========================================================================
  // DDL (CREATE, DROP, ALTER, TRUNCATE)
  // =========================================================================

  private static handleCreate(sql: string, tables: SandboxTables, startTime: number) {
    const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(([\s\S]+)\)/i)
    if (!match) {
      throw new Error('Invalid CREATE TABLE syntax. Example: CREATE TABLE lab_experiments (id serial, title text, score integer);')
    }
    const tableName = match[1].toLowerCase()
    if (tables[tableName] && !sql.toUpperCase().includes('IF NOT EXISTS')) {
      throw new Error(`Relation "${tableName}" already exists in sandbox.`)
    }

    const updated = { ...tables }
    if (!updated[tableName]) {
      updated[tableName] = []
    }

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'DDL' as const,
        columns: ['result'],
        rows: [{ result: `Table "${tableName}" created successfully.` }],
        rowsAffected: 0,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: `CREATE TABLE: table "${tableName}" is ready.`
      },
      updatedTables: updated
    }
  }

  private static handleDrop(sql: string, tables: SandboxTables, startTime: number) {
    const match = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i)
    if (!match) {
      throw new Error('Invalid DROP TABLE syntax. Example: DROP TABLE IF EXISTS custom_data;')
    }
    const tableName = match[1].toLowerCase()
    const target = this.resolveTable(tableName, tables)
    if (!target) {
      if (sql.toUpperCase().includes('IF EXISTS')) {
        return {
          result: {
            status: 'SUCCESS' as const,
            queryType: 'DDL' as const,
            columns: ['result'],
            rows: [{ result: `Notice: table "${tableName}" does not exist, skipping.` }],
            rowsAffected: 0,
            executionTimeMs: Math.round(performance.now() - startTime),
            message: `Table "${tableName}" does not exist.`
          }
        }
      }
      throw new Error(`Table "${tableName}" does not exist in sandbox.`)
    }

    const updated = { ...tables }
    delete updated[target.name]

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'DDL' as const,
        columns: ['result'],
        rows: [{ result: `Table "${target.name}" dropped from sandbox.` }],
        rowsAffected: 0,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: `DROP TABLE: table "${target.name}" removed.`
      },
      updatedTables: updated
    }
  }

  private static handleAlter(sql: string, tables: SandboxTables, startTime: number) {
    const match = sql.match(/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+(?:COLUMN\s+)?([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)/i)
    if (!match) {
      throw new Error('Invalid ALTER TABLE syntax. Example: ALTER TABLE consumers ADD COLUMN notes text;')
    }
    const tableName = match[1]
    const colName = match[2]
    const target = this.resolveTable(tableName, tables)
    if (!target) throw new Error(`Table "${tableName}" not found.`)

    const updatedRows = (target.data as Record<string, unknown>[]).map(r => ({
      ...r,
      [colName]: null
    }))

    const updated = {
      ...tables,
      [target.name]: updatedRows
    }

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'DDL' as const,
        columns: ['result'],
        rows: [{ result: `Column "${colName}" added to table "${target.name}".` }],
        rowsAffected: updatedRows.length,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: `ALTER TABLE: column "${colName}" added.`
      },
      updatedTables: updated
    }
  }

  private static handleTruncate(sql: string, tables: SandboxTables, startTime: number) {
    const match = sql.match(/TRUNCATE\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)/i)
    if (!match) throw new Error('Invalid TRUNCATE TABLE syntax. Example: TRUNCATE TABLE bills;')
    const tableName = match[1]
    const target = this.resolveTable(tableName, tables)
    if (!target) throw new Error(`Table "${tableName}" not found.`)

    const count = target.data.length
    const updated = {
      ...tables,
      [target.name]: []
    }

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'DDL' as const,
        columns: ['result'],
        rows: [{ result: `Table "${target.name}" truncated. ${count} rows removed.` }],
        rowsAffected: count,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: `TRUNCATE TABLE: all ${count} records deleted.`
      },
      updatedTables: updated
    }
  }

  // =========================================================================
  // DML (INSERT, UPDATE, DELETE)
  // =========================================================================

  private static handleInsert(sql: string, tables: SandboxTables, startTime: number) {
    const match = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]+)/i)
    if (!match) {
      throw new Error("Invalid INSERT syntax. Example: INSERT INTO consumers (name, account, zone, plan, usage, status) VALUES ('Kavitha', 'GF-9999', 'Chennai Central', 'Residential', 250, 'Active');")
    }

    const tableName = match[1]
    const target = this.resolveTable(tableName, tables)
    if (!target) throw new Error(`Table "${tableName}" not found in sandbox.`)

    const colString = match[2]
    const valuesPart = match[3].trim()

    // Parse column names if given, else derive from existing table schema
    let colNames: string[] = []
    if (colString) {
      colNames = colString.split(',').map(c => c.trim().toLowerCase())
    } else {
      const sample = (target.data[0] || {}) as Record<string, unknown>
      colNames = Object.keys(sample)
    }

    // Split multiple value sets: (val1, val2), (val3, val4)
    const rowTuples = this.splitTupleValues(valuesPart)
    if (!rowTuples.length) throw new Error('No VALUES tuples found in INSERT statement.')

    const newRows: Record<string, unknown>[] = []

    for (const tuple of rowTuples) {
      const parsedValues = this.parseValueList(tuple)
      const newObj: Record<string, unknown> = {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      }

      colNames.forEach((col, idx) => {
        const val = parsedValues[idx]
        newObj[col] = val !== undefined ? val : null
      })

      // Normalize field aliases (e.g. full_name vs name)
      if (newObj.full_name && !newObj.name) newObj.name = newObj.full_name
      if (newObj.name && !newObj.full_name) newObj.full_name = newObj.name
      if (newObj.account_number && !newObj.account) newObj.account = newObj.account_number
      if (newObj.usage_kwh !== undefined && newObj.usage === undefined) newObj.usage = newObj.usage_kwh

      newRows.push(newObj)
    }

    const updated = {
      ...tables,
      [target.name]: [...(target.data as Record<string, unknown>[]), ...newRows]
    }

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'INSERT' as const,
        columns: ['rows_inserted', 'table'],
        rows: [{ rows_inserted: newRows.length, table: target.name }],
        rowsAffected: newRows.length,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: `INSERT 0 ${newRows.length}: Added ${newRows.length} row(s) to "${target.name}".`
      },
      updatedTables: updated
    }
  }

  private static handleUpdate(sql: string, tables: SandboxTables, startTime: number) {
    const match = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i)
    if (!match) {
      throw new Error("Invalid UPDATE syntax. Example: UPDATE consumers SET status = 'Inactive' WHERE usage < 50;")
    }

    const tableName = match[1]
    const setClause = match[2]
    const whereClause = match[3]

    const target = this.resolveTable(tableName, tables)
    if (!target) throw new Error(`Table "${tableName}" not found.`)

    // Parse SET pairs: col1 = val1, col2 = val2
    const setAssignments = this.parseSetClause(setClause)

    let rowsAffected = 0
    const updatedRows = (target.data as Record<string, unknown>[]).map(row => {
      if (!whereClause || this.evaluateWhere(row, whereClause)) {
        rowsAffected++
        const updated = { ...row }
        for (const [col, val] of Object.entries(setAssignments)) {
          // Resolve standard alias mappings
          const key = this.findMatchingColumn(col, row)
          updated[key] = val
          if (key === 'status') updated.status = String(val)
          if (key === 'usage' || key === 'usage_kwh') {
            updated.usage = Number(val)
            updated.usage_kwh = Number(val)
          }
        }
        return updated
      }
      return row
    })

    const updated = {
      ...tables,
      [target.name]: updatedRows
    }

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'UPDATE' as const,
        columns: ['rows_updated', 'table'],
        rows: [{ rows_updated: rowsAffected, table: target.name }],
        rowsAffected,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: `UPDATE ${rowsAffected}: ${rowsAffected} row(s) updated in "${target.name}".`
      },
      updatedTables: updated
    }
  }

  private static handleDelete(sql: string, tables: SandboxTables, startTime: number) {
    const match = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+))?$/i)
    if (!match) {
      throw new Error("Invalid DELETE syntax. Example: DELETE FROM consumers WHERE status = 'Inactive';")
    }

    const tableName = match[1]
    const whereClause = match[2]

    const target = this.resolveTable(tableName, tables)
    if (!target) throw new Error(`Table "${tableName}" not found.`)

    let rowsAffected = 0
    const remainingRows: Record<string, unknown>[] = []

    for (const row of target.data as Record<string, unknown>[]) {
      if (!whereClause || this.evaluateWhere(row, whereClause)) {
        rowsAffected++
      } else {
        remainingRows.push(row)
      }
    }

    const updated = {
      ...tables,
      [target.name]: remainingRows
    }

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'DELETE' as const,
        columns: ['rows_deleted', 'table'],
        rows: [{ rows_deleted: rowsAffected, table: target.name }],
        rowsAffected,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: `DELETE ${rowsAffected}: ${rowsAffected} row(s) deleted from "${target.name}".`
      },
      updatedTables: updated
    }
  }

  // =========================================================================
  // DQL (SELECT, JOINS, AGGREGATES, GROUP BY, ORDER BY, LIMIT)
  // =========================================================================

  private static handleSelect(sql: string, tables: SandboxTables, startTime: number) {
    // Basic regex extraction for main clauses
    const fromMatch = sql.match(/FROM\s+([\s\S]+?)(?:\s+WHERE|\s+GROUP\s+BY|\s+HAVING|\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|$)/i)
    if (!fromMatch) {
      // Handles SELECT without FROM, e.g. SELECT 1 + 1 AS result, version();
      return this.handleSelectScalar(sql, startTime)
    }

    const selectMatch = sql.match(/SELECT\s+(DISTINCT\s+)?([\s\S]+?)\s+FROM/i)
    if (!selectMatch) throw new Error('Malformed SELECT statement.')

    const isDistinct = !!selectMatch[1]
    const selectFieldsRaw = selectMatch[2].trim()

    // 1. Resolve FROM & JOINs
    const fromAndJoins = fromMatch[1].trim()
    const { primaryTable, primaryAlias, joins } = this.parseFromAndJoins(fromAndJoins)

    const baseTarget = this.resolveTable(primaryTable, tables)
    if (!baseTarget) {
      throw new Error(`Table "${primaryTable}" does not exist in sandbox. Use SHOW TABLES; to view available relations.`)
    }

    // Build the initial working set of tuples
    let workingRows: Record<string, unknown>[] = (baseTarget.data as Record<string, unknown>[]).map(row => {
      const rowWrapped: Record<string, unknown> = { ...row }
      // Alias prefixing for disambiguation
      for (const [k, v] of Object.entries(row)) {
        rowWrapped[`${primaryAlias}.${k}`] = v
        rowWrapped[`${baseTarget.name}.${k}`] = v
      }
      return rowWrapped
    })

    // Apply JOINs
    for (const join of joins) {
      const joinTarget = this.resolveTable(join.table, tables)
      if (!joinTarget) throw new Error(`JOIN target table "${join.table}" not found.`)

      const joinedRows: Record<string, unknown>[] = []
      const rightRows = joinTarget.data as Record<string, unknown>[]

      for (const left of workingRows) {
        let matchedRight = false
        for (const right of rightRows) {
          // Pre-wrap right row
          const combined = { ...left }
          for (const [rk, rv] of Object.entries(right)) {
            combined[rk] = rv
            combined[`${join.alias}.${rk}`] = rv
            combined[`${joinTarget.name}.${rk}`] = rv
          }

          if (this.evaluateJoinOn(combined, join.onClause)) {
            joinedRows.push(combined)
            matchedRight = true
          }
        }

        // LEFT JOIN null padding
        if (!matchedRight && join.type === 'LEFT') {
          const nullPadded = { ...left }
          const sampleRight = rightRows[0] || {}
          for (const rk of Object.keys(sampleRight)) {
            nullPadded[rk] = null
            nullPadded[`${join.alias}.${rk}`] = null
            nullPadded[`${joinTarget.name}.${rk}`] = null
          }
          joinedRows.push(nullPadded)
        }
      }

      workingRows = joinedRows
    }

    // 2. WHERE clause
    const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:\s+GROUP\s+BY|\s+HAVING|\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|$)/i)
    if (whereMatch) {
      const whereCondition = whereMatch[1].trim()
      workingRows = workingRows.filter(row => this.evaluateWhere(row, whereCondition))
    }

    // 3. GROUP BY and Aggregations
    const groupByMatch = sql.match(/GROUP\s+BY\s+([\s\S]+?)(?:\s+HAVING|\s+ORDER\s+BY|\s+LIMIT|\s+OFFSET|$)/i)
    const hasAggregates = /(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(selectFieldsRaw)

    if (groupByMatch || hasAggregates) {
      const groupByFields = groupByMatch ? groupByMatch[1].split(',').map(s => s.trim()) : []
      workingRows = this.applyGroupByAndAggregates(workingRows, selectFieldsRaw, groupByFields)
    } else {
      // Standard column projection
      workingRows = this.projectColumns(workingRows, selectFieldsRaw)
    }

    // 4. DISTINCT
    if (isDistinct) {
      const seen = new Set<string>()
      workingRows = workingRows.filter(row => {
        const key = JSON.stringify(row)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    // 5. ORDER BY
    const orderByMatch = sql.match(/ORDER\s+BY\s+([\s\S]+?)(?:\s+LIMIT|\s+OFFSET|$)/i)
    if (orderByMatch) {
      workingRows = this.applyOrderBy(workingRows, orderByMatch[1].trim())
    }

    // 6. LIMIT & OFFSET
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
    const offsetMatch = sql.match(/OFFSET\s+(\d+)/i)

    const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : workingRows.length

    const finalRows = workingRows.slice(offset, offset + limit)
    const columns = finalRows.length > 0 ? Object.keys(finalRows[0]) : this.extractSelectHeaders(selectFieldsRaw)

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'SELECT' as const,
        columns,
        rows: finalRows,
        rowsAffected: finalRows.length,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: `Query returned ${finalRows.length} row(s).`
      }
    }
  }

  private static handleSelectScalar(sql: string, startTime: number) {
    const raw = sql.replace(/^SELECT\s+/i, '').trim()
    const parts = raw.split(',').map(p => p.trim())
    const row: Record<string, unknown> = {}

    for (const part of parts) {
      const aliasMatch = part.match(/^(.*?)\s+AS\s+([a-zA-Z0-9_]+)$/i)
      const expr = aliasMatch ? aliasMatch[1].trim() : part
      const colName = aliasMatch ? aliasMatch[2].trim() : part.replace(/[^a-zA-Z0-9_]/g, '_')

      if (/^version\(\)$/i.test(expr)) {
        row[colName] = 'PostgreSQL 15.4 (GridFlow SQL Sandbox v2.0)'
      } else if (/^now\(\)$|^current_timestamp$/i.test(expr)) {
        row[colName] = new Date().toISOString()
      } else {
        try {
          // Safe arithmetic evaluator
          const sanitized = expr.replace(/[^0-9+\-*/().]/g, '')
          // eslint-disable-next-line no-eval
          row[colName] = sanitized ? Function(`'use strict'; return (${sanitized})`)() : expr
        } catch {
          row[colName] = expr
        }
      }
    }

    return {
      result: {
        status: 'SUCCESS' as const,
        queryType: 'SELECT' as const,
        columns: Object.keys(row),
        rows: [row],
        rowsAffected: 1,
        executionTimeMs: Math.round(performance.now() - startTime),
        message: '1 row returned.'
      }
    }
  }

  // =========================================================================
  // HELPER PARSERS & CLAUSE EVALUATORS
  // =========================================================================

  private static resolveTable(name: string, tables: SandboxTables): { name: string; data: unknown[] } | null {
    const clean = name.trim().toLowerCase()
    // Exact or plural/singular tolerance
    const direct = Object.keys(tables).find(k => k.toLowerCase() === clean)
    if (direct) return { name: direct, data: tables[direct] as unknown[] }

    // Variations
    if (clean === 'consumer') return tables.consumers ? { name: 'consumers', data: tables.consumers } : null
    if (clean === 'meter') return tables.meters ? { name: 'meters', data: tables.meters } : null
    if (clean === 'bill') return tables.bills ? { name: 'bills', data: tables.bills } : null
    if (clean === 'technician') return tables.technicians ? { name: 'technicians', data: tables.technicians } : null
    if (clean === 'zone') return tables.zones ? { name: 'zones', data: tables.zones } : null
    if (clean === 'tariff') return tables.tariffs ? { name: 'tariffs', data: tables.tariffs } : null

    return null
  }

  private static parseFromAndJoins(fromClause: string) {
    const tokens = fromClause.split(/\s+(INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|JOIN)\s+/i)
    const basePart = tokens[0].trim()
    const baseParts = basePart.split(/\s+(?:AS\s+)?/i)
    const primaryTable = baseParts[0].trim()
    const primaryAlias = baseParts[1] ? baseParts[1].trim() : primaryTable

    const joins: { type: 'INNER' | 'LEFT'; table: string; alias: string; onClause: string }[] = []

    for (let i = 1; i < tokens.length; i += 2) {
      const joinTypeStr = tokens[i].toUpperCase()
      const joinBody = tokens[i + 1] ? tokens[i + 1].trim() : ''

      const onSplit = joinBody.split(/\s+ON\s+/i)
      const tableAndAlias = onSplit[0].trim().split(/\s+(?:AS\s+)?/i)
      const joinTable = tableAndAlias[0].trim()
      const joinAlias = tableAndAlias[1] ? tableAndAlias[1].trim() : joinTable
      const onClause = onSplit[1] ? onSplit[1].trim() : '1=1'

      joins.push({
        type: joinTypeStr.includes('LEFT') ? 'LEFT' : 'INNER',
        table: joinTable,
        alias: joinAlias,
        onClause
      })
    }

    return { primaryTable, primaryAlias, joins }
  }

  private static evaluateJoinOn(row: Record<string, unknown>, onClause: string): boolean {
    const parts = onClause.split('=')
    if (parts.length !== 2) return true
    const leftVal = this.resolveValue(row, parts[0].trim())
    const rightVal = this.resolveValue(row, parts[1].trim())
    return String(leftVal).toLowerCase() === String(rightVal).toLowerCase()
  }

  private static evaluateWhere(row: Record<string, unknown>, condition: string): boolean {
    const orClauses = condition.split(/\s+OR\s+/i)
    return orClauses.some(orClause => {
      const andClauses = orClause.split(/\s+AND\s+/i)
      return andClauses.every(andClause => this.evaluateSingleCondition(row, andClause.trim()))
    })
  }

  private static evaluateSingleCondition(row: Record<string, unknown>, expr: string): boolean {
    const cleanExpr = expr.replace(/^\(+|\)+$/g, '').trim()

    // 1. IS NULL / IS NOT NULL
    if (/IS\s+NOT\s+NULL/i.test(cleanExpr)) {
      const col = cleanExpr.split(/\s+IS\s+NOT\s+NULL/i)[0].trim()
      const val = this.resolveValue(row, col)
      return val !== null && val !== undefined
    }
    if (/IS\s+NULL/i.test(cleanExpr)) {
      const col = cleanExpr.split(/\s+IS\s+NULL/i)[0].trim()
      const val = this.resolveValue(row, col)
      return val === null || val === undefined
    }

    // 2. LIKE / ILIKE
    const likeMatch = cleanExpr.match(/^(.+?)\s+(NOT\s+)?(I?LIKE)\s+['"](.+?)['"]$/i)
    if (likeMatch) {
      const col = likeMatch[1].trim()
      const isNot = !!likeMatch[2]
      const pattern = likeMatch[4]
      const val = String(this.resolveValue(row, col) || '')
      const regexStr = '^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$'
      const regex = new RegExp(regexStr, 'i')
      const matches = regex.test(val)
      return isNot ? !matches : matches
    }

    // 3. IN / NOT IN
    const inMatch = cleanExpr.match(/^(.+?)\s+(NOT\s+)?IN\s*\(([^)]+)\)$/i)
    if (inMatch) {
      const col = inMatch[1].trim()
      const isNot = !!inMatch[2]
      const items = inMatch[3].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
      const val = String(this.resolveValue(row, col) || '').toLowerCase()
      const included = items.includes(val)
      return isNot ? !included : included
    }

    // 4. Comparison operators: >=, <=, !=, <>, =, >, <
    const compMatch = cleanExpr.match(/^(.+?)\s*(>=|<=|!=|<>|=|>|<)\s*(.+)$/)
    if (compMatch) {
      const col = compMatch[1].trim()
      const op = compMatch[2]
      const rawTarget = compMatch[3].trim()
      const targetVal = this.parseLiteralOrCol(row, rawTarget)
      const actualVal = this.resolveValue(row, col)

      if (typeof targetVal === 'number' && typeof actualVal === 'number') {
        if (op === '=') return actualVal === targetVal
        if (op === '!=' || op === '<>') return actualVal !== targetVal
        if (op === '>') return actualVal > targetVal
        if (op === '<') return actualVal < targetVal
        if (op === '>=') return actualVal >= targetVal
        if (op === '<=') return actualVal <= targetVal
      }

      // String/Date comparisons
      const a = String(actualVal || '').toLowerCase()
      const b = String(targetVal || '').toLowerCase()

      if (op === '=') return a === b
      if (op === '!=' || op === '<>') return a !== b
      if (op === '>') return a > b
      if (op === '<') return a < b
      if (op === '>=') return a >= b
      if (op === '<=') return a <= b
    }

    return true
  }

  private static resolveValue(row: Record<string, unknown>, colExpr: string): unknown {
    const clean = colExpr.trim().replace(/['"`]/g, '')

    // Check direct match
    if (clean in row) return row[clean]

    // Check case-insensitive match
    const lower = clean.toLowerCase()
    const foundKey = Object.keys(row).find(k => k.toLowerCase() === lower)
    if (foundKey) return row[foundKey]

    // Check without table prefix (e.g. c.name -> name)
    if (clean.includes('.')) {
      const fieldOnly = clean.split('.')[1].toLowerCase()
      const directField = Object.keys(row).find(k => k.toLowerCase() === fieldOnly)
      if (directField) return row[directField]
    }

    // Aliases normalization
    if (lower === 'name' && 'full_name' in row) return row.full_name
    if (lower === 'full_name' && 'name' in row) return row.name
    if (lower === 'account' && 'account_number' in row) return row.account_number
    if (lower === 'usage' && 'usage_kwh' in row) return row.usage_kwh
    if (lower === 'serial' && 'serial_number' in row) return row.serial_number
    if (lower === 'consumer_id' && 'consumerId' in row) return row.consumerId

    return undefined
  }

  private static parseLiteralOrCol(row: Record<string, unknown>, raw: string): unknown {
    const trimmed = raw.trim()
    if (/^['"].*['"]$/.test(trimmed)) {
      return trimmed.slice(1, -1)
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed)
    }
    if (/^true$/i.test(trimmed)) return true
    if (/^false$/i.test(trimmed)) return false
    if (/^null$/i.test(trimmed)) return null

    // Might be another column
    return this.resolveValue(row, trimmed)
  }

  private static projectColumns(rows: Record<string, unknown>[], selectFields: string): Record<string, unknown>[] {
    if (selectFields.trim() === '*') {
      // Exclude internal alias prefixes like c.name from displaying twice
      return rows.map(r => {
        const clean: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(r)) {
          if (!k.includes('.')) clean[k] = v
        }
        return Object.keys(clean).length > 0 ? clean : r
      })
    }

    const fieldDefs = this.parseSelectFields(selectFields)
    return rows.map(row => {
      const out: Record<string, unknown> = {}
      for (const f of fieldDefs) {
        out[f.alias] = this.resolveValue(row, f.expression)
      }
      return out
    })
  }

  private static applyGroupByAndAggregates(
    rows: Record<string, unknown>[],
    selectFieldsRaw: string,
    groupByFields: string[]
  ): Record<string, unknown>[] {
    const fieldDefs = this.parseSelectFields(selectFieldsRaw)
    const groups = new Map<string, Record<string, unknown>[]>()

    // Partition rows into buckets
    for (const r of rows) {
      const groupKey = groupByFields.map(f => String(this.resolveValue(r, f))).join('||')
      if (!groups.has(groupKey)) groups.set(groupKey, [])
      groups.get(groupKey)!.push(r)
    }

    // If no GROUP BY but aggregate, entire dataset is one group
    if (groups.size === 0) groups.set('__all__', rows)

    const aggregatedResult: Record<string, unknown>[] = []

    for (const [, bucket] of groups) {
      const outRow: Record<string, unknown> = {}

      for (const f of fieldDefs) {
        const expr = f.expression.trim()
        const aggMatch = expr.match(/^(COUNT|SUM|AVG|MIN|MAX)\s*\((.*?)\)$/i)

        if (aggMatch) {
          const fn = aggMatch[1].toUpperCase()
          const colName = aggMatch[2].trim()

          if (fn === 'COUNT') {
            if (colName === '*' || colName === '1') {
              outRow[f.alias] = bucket.length
            } else {
              outRow[f.alias] = bucket.filter(b => this.resolveValue(b, colName) !== null).length
            }
          } else {
            const values = bucket
              .map(b => Number(this.resolveValue(b, colName)))
              .filter(v => !isNaN(v) && v !== null)

            if (fn === 'SUM') {
              outRow[f.alias] = values.reduce((a, b) => a + b, 0)
            } else if (fn === 'AVG') {
              outRow[f.alias] = values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0
            } else if (fn === 'MIN') {
              outRow[f.alias] = values.length ? Math.min(...values) : 0
            } else if (fn === 'MAX') {
              outRow[f.alias] = values.length ? Math.max(...values) : 0
            }
          }
        } else {
          // Standard grouped column
          outRow[f.alias] = bucket[0] ? this.resolveValue(bucket[0], expr) : null
        }
      }

      aggregatedResult.push(outRow)
    }

    return aggregatedResult
  }

  private static applyOrderBy(rows: Record<string, unknown>[], orderByStr: string): Record<string, unknown>[] {
    const orders = orderByStr.split(',').map(o => {
      const parts = o.trim().split(/\s+/)
      return {
        col: parts[0],
        desc: parts[1] ? parts[1].toUpperCase() === 'DESC' : false
      }
    })

    return [...rows].sort((a, b) => {
      for (const order of orders) {
        const vA = this.resolveValue(a, order.col)
        const vB = this.resolveValue(b, order.col)

        if (vA === vB) continue
        if (vA === null || vA === undefined) return 1
        if (vB === null || vB === undefined) return -1

        let cmp = 0
        if (typeof vA === 'number' && typeof vB === 'number') {
          cmp = vA - vB
        } else {
          cmp = String(vA).localeCompare(String(vB))
        }

        if (cmp !== 0) return order.desc ? -cmp : cmp
      }
      return 0
    })
  }

  private static parseSelectFields(raw: string): { expression: string; alias: string }[] {
    const results: { expression: string; alias: string }[] = []
    const tokens = this.splitByCommaIgnoringParens(raw)

    for (const token of tokens) {
      const aliasMatch = token.match(/^(.*?)\s+(?:AS\s+)?([a-zA-Z0-9_]+)$/i)
      if (aliasMatch && !/^(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(aliasMatch[2])) {
        results.push({
          expression: aliasMatch[1].trim(),
          alias: aliasMatch[2].trim()
        })
      } else {
        const clean = token.trim()
        const colOnly = clean.includes('.') ? clean.split('.')[1] : clean
        results.push({
          expression: clean,
          alias: colOnly.replace(/[^a-zA-Z0-9_]/g, '_')
        })
      }
    }
    return results
  }

  private static extractSelectHeaders(selectRaw: string): string[] {
    if (selectRaw.trim() === '*') return ['id', 'name', 'status']
    return this.parseSelectFields(selectRaw).map(f => f.alias)
  }

  private static splitByCommaIgnoringParens(str: string): string[] {
    const parts: string[] = []
    let current = ''
    let depth = 0

    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if (char === '(') depth++
      else if (char === ')') depth--

      if (char === ',' && depth === 0) {
        parts.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    if (current.trim()) parts.push(current.trim())
    return parts
  }

  private static splitTupleValues(valuesPart: string): string[] {
    const tuples: string[] = []
    let inParen = false
    let current = ''

    for (let i = 0; i < valuesPart.length; i++) {
      const char = valuesPart[i]
      if (char === '(') {
        inParen = true
        current = ''
      } else if (char === ')') {
        inParen = false
        tuples.push(current)
      } else if (inParen) {
        current += char
      }
    }
    return tuples
  }

  private static parseValueList(tupleStr: string): unknown[] {
    const items = this.splitByCommaIgnoringParens(tupleStr)
    return items.map(it => {
      const trimmed = it.trim()
      if (/^['"].*['"]$/.test(trimmed)) return trimmed.slice(1, -1)
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed)
      if (/^true$/i.test(trimmed)) return true
      if (/^false$/i.test(trimmed)) return false
      if (/^null$/i.test(trimmed)) return null
      return trimmed
    })
  }

  private static parseSetClause(setClause: string): Record<string, unknown> {
    const pairs = this.splitByCommaIgnoringParens(setClause)
    const result: Record<string, unknown> = {}
    for (const pair of pairs) {
      const [col, val] = pair.split('=').map(s => s.trim())
      result[col] = this.parseLiteralOrCol({}, val)
    }
    return result
  }

  private static findMatchingColumn(col: string, row: Record<string, unknown>): string {
    const lower = col.toLowerCase()
    return Object.keys(row).find(k => k.toLowerCase() === lower) || col
  }

  /**
   * Generates helpful educational hints when syntax or schema errors happen
   */
  private static generateErrorHint(errorMsg: string, sql: string): string {
    const lower = sql.toLowerCase()
    if (errorMsg.includes('does not exist') || errorMsg.includes('not found')) {
      return 'Check the table or column spelling. Type "SHOW TABLES;" or "DESCRIBE consumers;" to view exact schema names.'
    }
    if (lower.startsWith('select') && !lower.includes('from') && !lower.includes('(')) {
      return 'Did you forget the FROM clause? Example: SELECT * FROM consumers;'
    }
    if (lower.startsWith('insert') && !lower.includes('values')) {
      return 'INSERT statements require the VALUES keyword: INSERT INTO table (col) VALUES (\'value\');'
    }
    if (lower.startsWith('update') && !lower.includes('set')) {
      return 'UPDATE statements require SET: UPDATE table SET column = value WHERE condition;'
    }
    if (lower.startsWith('delete') && !lower.includes('from')) {
      return 'DELETE statements require FROM: DELETE FROM table WHERE condition;'
    }
    return 'Verify SQL syntax, commas between column names, and quote strings with single quotes (\'text\').'
  }
}
