/**
 * GridFlow Explainable AI SQL Mentor
 *
 * Provides intelligent, pedagogically sound diagnostic analysis for SQL errors,
 * automatic syntax correction suggestions, and an interactive side-chat drawer
 * to resolve student doubts and reinforce DBMS concepts.
 */

import { type SandboxTables } from './sandboxStore'

export type AiErrorDiagnosis = {
  errorTitle: string
  plainEnglishExplanation: string
  suggestedFixSql: string
  educationalConcept: string
  quickActionLabel: string
}

export class AiSqlMentor {
  /**
   * Analyzes a failed SQL query and returns an explainable breakdown
   */
  static diagnoseError(failedSql: string, errorMessage: string, tables: SandboxTables): AiErrorDiagnosis {
    const lowerSql = failedSql.toLowerCase().trim()
    const lowerErr = errorMessage.toLowerCase()

    // 1. Missing FROM clause
    if (lowerSql.startsWith('select') && !lowerSql.includes('from') && !lowerSql.includes('version()') && !lowerSql.includes('now()') && !lowerSql.match(/select\s+\d+/i)) {
      return {
        errorTitle: 'Missing "FROM" Clause',
        plainEnglishExplanation: 'In SQL, when you want to retrieve data from a table, you must tell the database engine which table to read from using the FROM keyword.',
        suggestedFixSql: `SELECT * FROM consumers LIMIT 10;`,
        educationalConcept: 'DQL (Data Query Language) queries follow the fundamental structure: SELECT <columns> FROM <table_name> WHERE <conditions>;',
        quickActionLabel: 'Add FROM consumers'
      }
    }

    // 2. Unknown table name
    const tableMissingMatch = errorMessage.match(/table "([^"]+)" (?:does not exist|not found)/i)
    if (tableMissingMatch) {
      const wrongTable = tableMissingMatch[1]
      const available = Object.keys(tables)
      const closest = available.find(t => t.startsWith(wrongTable.slice(0, 3))) || 'consumers'
      return {
        errorTitle: `Unknown Relation "${wrongTable}"`,
        plainEnglishExplanation: `The database engine looked for a relation named "${wrongTable}", but could not find it in your active personal sandbox.`,
        suggestedFixSql: failedSql.replace(new RegExp(wrongTable, 'gi'), closest),
        educationalConcept: `Available tables in your sandbox are: ${available.join(', ')}. In PostgreSQL, table names are case-insensitive unless quoted.`,
        quickActionLabel: `Replace with "${closest}"`
      }
    }

    // 3. Unknown column name
    const colMissingMatch = errorMessage.match(/column "([^"]+)" (?:does not exist|not found)/i)
    if (colMissingMatch) {
      const wrongCol = colMissingMatch[1]
      return {
        errorTitle: `Column "${wrongCol}" Not Found`,
        plainEnglishExplanation: `The column "${wrongCol}" does not exist in the referenced table. This often happens due to a spelling mistake or referencing a field under a different name (e.g. "full_name" vs "name").`,
        suggestedFixSql: failedSql.replace(new RegExp(wrongCol, 'gi'), 'name'),
        educationalConcept: 'Run "DESCRIBE <table_name>;" in the console to inspect all valid column names and data types before constructing your query.',
        quickActionLabel: 'Fix column name'
      }
    }

    // 4. Aggregates without GROUP BY
    if (/(count|sum|avg|min|max)\s*\(/i.test(failedSql) && !lowerSql.includes('group by') && /select\s+([a-zA-Z0-9_]+)\s*,/i.test(failedSql)) {
      const matchCol = failedSql.match(/select\s+([a-zA-Z0-9_]+)\s*,/i)
      const groupCol = matchCol ? matchCol[1] : 'zone'
      return {
        errorTitle: 'Non-Aggregated Column without GROUP BY',
        plainEnglishExplanation: `You are projecting column "${groupCol}" alongside an aggregate function (such as COUNT or SUM). SQL requires non-aggregated columns in the SELECT clause to be listed in a GROUP BY clause so it knows how to partition the rows.`,
        suggestedFixSql: `${failedSql.replace(/;+\s*$/, '')} GROUP BY ${groupCol};`,
        educationalConcept: 'In relational algebra, aggregate functions collapse multiple rows into a single scalar value. To compute aggregates across categories, you must partition rows using GROUP BY <category_column>.',
        quickActionLabel: `Add GROUP BY ${groupCol}`
      }
    }

    // 5. Unclosed quotes or strings
    const singleQuotesCount = (failedSql.match(/'/g) || []).length
    if (singleQuotesCount % 2 !== 0) {
      return {
        errorTitle: 'Unterminated String Literal',
        plainEnglishExplanation: 'There is an odd number of single quotes (\'). In SQL, text string literals must be enclosed in pairs of single quotes.',
        suggestedFixSql: `${failedSql}'`,
        educationalConcept: 'Always enclose string values in paired single quotes: \'Active\', \'Coimbatore\'. Double quotes (") are reserved for column or table identifiers.',
        quickActionLabel: 'Close trailing quote'
      }
    }

    // 6. UPDATE without SET
    if (lowerSql.startsWith('update') && !lowerSql.includes('set')) {
      return {
        errorTitle: 'Missing "SET" Keyword in UPDATE',
        plainEnglishExplanation: 'The UPDATE statement must be followed by the SET keyword specifying which columns to modify and their new values.',
        suggestedFixSql: `UPDATE consumers SET plan = 'Commercial' WHERE id = 'GF-101';`,
        educationalConcept: 'UPDATE syntax: UPDATE <table_name> SET <col1> = <val1>, <col2> = <val2> WHERE <condition>;',
        quickActionLabel: 'Provide valid SET clause'
      }
    }

    // 7. INSERT without VALUES
    if (lowerSql.startsWith('insert') && !lowerSql.includes('values') && !lowerSql.includes('select')) {
      return {
        errorTitle: 'Missing "VALUES" Keyword in INSERT',
        plainEnglishExplanation: 'An INSERT statement needs the VALUES keyword followed by the tuple data in parentheses.',
        suggestedFixSql: `INSERT INTO consumers (name, account, zone, plan, usage, status) VALUES ('New Customer', 'GF-9000', 'Chennai Central', 'Residential', 150, 'Active');`,
        educationalConcept: 'INSERT syntax: INSERT INTO <table> (<col1>, <col2>) VALUES (<val1>, <val2>);',
        quickActionLabel: 'Insert with VALUES'
      }
    }

    // Generic fallback diagnosis
    return {
      errorTitle: 'SQL Syntax or Relational Constraint Error',
      plainEnglishExplanation: errorMessage,
      suggestedFixSql: `SELECT * FROM consumers LIMIT 10;`,
      educationalConcept: 'Check that every keyword is spelled correctly, clauses appear in valid sequence (SELECT -> FROM -> JOIN -> WHERE -> GROUP BY -> HAVING -> ORDER BY -> LIMIT), and commas separate items.',
      quickActionLabel: 'Test simple query'
    }
  }

  /**
   * Generates a context-aware pedagogical reply to a student question
   */
  static respondToChatQuestion(
    studentMessage: string,
    editorSql: string,
    lastError?: string
  ): { reply: string; suggestedQuery?: string } {
    const q = studentMessage.toLowerCase().trim()

    // 1. Asking about JOINs
    if (q.includes('join') || q.includes('inner join') || q.includes('left join')) {
      return {
        reply: `**Inner Join vs. Left Join Explained:**\n\n- **INNER JOIN**: Only returns records when there is a match in *both* tables. For example, consumers who currently have an installed meter.\n- **LEFT JOIN**: Returns *all* records from the left table (consumers), even if there is no corresponding row in the right table (meters). Missing fields are filled with \`NULL\`.\n\nHere is a query you can run to see this in action:`,
        suggestedQuery: `SELECT c.name, c.account, m.serial, m.status AS meter_status\nFROM consumers c\nLEFT JOIN meters m ON c.id = m.consumerId\nORDER BY c.name ASC;`
      }
    }

    // 2. Asking about WHERE vs HAVING
    if (q.includes('having') || q.includes('where vs having')) {
      return {
        reply: `**WHERE vs. HAVING:**\n\n- **WHERE** filters individual rows *before* any grouping or aggregation takes place.\n- **HAVING** filters grouped rows *after* the \`GROUP BY\` aggregate computation is completed.\n\n*Rule of thumb:* If you are filtering on an aggregate function (e.g. \`COUNT(*) > 5\` or \`SUM(usage) > 1000\`), use **HAVING**; if filtering by column values like \`status = 'Active'\`, use **WHERE**.`,
        suggestedQuery: `SELECT zone, COUNT(*) AS consumer_count, SUM(usage) AS total_kwh\nFROM consumers\nGROUP BY zone\nHAVING COUNT(*) >= 2;`
      }
    }

    // 3. Asking about transactions / rollback
    if (q.includes('rollback') || q.includes('transaction') || q.includes('commit') || q.includes('undo')) {
      return {
        reply: `**Transactions & Rollback in GridFlow:**\n\nTransactions let you bundle database operations safely under the **ACID** principle (Atomicity, Consistency, Isolation, Durability):\n\n1. Run \`BEGIN;\` to initiate a transaction checkpoint.\n2. Perform modifications (\`UPDATE\`, \`DELETE\`, \`INSERT\`).\n3. If anything went wrong, run \`ROLLBACK;\` to discard all changes since BEGIN!\n4. If satisfied, run \`COMMIT;\` to make them permanent.\n\nYou can also click the **Reset Sandbox** button in the topbar at any time to restore your database back to factory seed data!`,
        suggestedQuery: `BEGIN;\nUPDATE consumers SET status = 'Suspended' WHERE usage < 50;\n-- Check results, then run:\nROLLBACK;`
      }
    }

    // 4. Asking about fixing the current error
    if (q.includes('fix') || q.includes('error') || q.includes('why') || q.includes('mistake') || q.includes('solve')) {
      if (lastError) {
        const diagnosis = this.diagnoseError(editorSql, lastError, {} as SandboxTables)
        return {
          reply: `**Error Analysis:**\n\n${diagnosis.plainEnglishExplanation}\n\n**Educational Tip:** ${diagnosis.educationalConcept}`,
          suggestedQuery: diagnosis.suggestedFixSql
        }
      }
      return {
        reply: `Your query looks good or hasn't run yet! If you execute a query and run into an error, I'll automatically break down the mistake and suggest the exact fix. What SQL topic would you like to practice?`,
        suggestedQuery: `SELECT * FROM consumers LIMIT 5;`
      }
    }

    // 5. Asking about tables / columns
    if (q.includes('table') || q.includes('schema') || q.includes('column') || q.includes('field')) {
      return {
        reply: `**GridFlow Database Tables:**\n\n1. \`consumers\`: Customer accounts, plans, addresses, and monthly kWh usage.\n2. \`meters\`: Smart meter hardware serial numbers, IoT signals, and live readings.\n3. \`bills\`: Invoices, tariff rates, billed amounts (₹), and payment statuses.\n4. \`technicians\`: Field service crews, assigned zones, and maintenance jobs.\n5. \`zones\`: Geographic utility regions (Chennai, Coimbatore, Madurai, etc.).\n6. \`tariffs\`: Electricity pricing rates per kWh.\n\nTry running \`SHOW TABLES;\` or \`DESCRIBE consumers;\` in the editor!`,
        suggestedQuery: `SHOW TABLES;`
      }
    }

    // Default conversational response
    return {
      reply: `I am your AI SQL Mentor for the GridFlow DBMS Lab. I can help explain relational queries, diagnose syntax or logical mistakes, and demonstrate complex queries like multi-table joins and aggregations.\n\nFeel free to ask me questions like:\n- *"How do I calculate average bill by zone?"*\n- *"What is the difference between INNER and LEFT JOIN?"*\n- *"How do I write an INSERT query?"*`,
      suggestedQuery: editorSql.trim() || `SELECT * FROM consumers LIMIT 5;`
    }
  }
}
