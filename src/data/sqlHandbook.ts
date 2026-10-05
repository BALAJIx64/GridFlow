/**
 * GridFlow Interactive SQL Handbook
 *
 * Comprehensive reference with runnable SQL queries mapped directly to the
 * GridFlow sandbox database schema (Tamil Nadu utility data).
 * Each example includes runnable SQL, syntax breakdown, and expected outcome.
 */

export type SqlTopicCategory =
  | 'Database Schema'
  | 'DQL: Queries & Filtering'
  | 'Relational Joins'
  | 'Aggregates & Grouping'
  | 'DML: Inserts & Updates'
  | 'DDL: Tables & Schemas'
  | 'Transactions & ACID'
  | 'Diagnostic Utilities'

export type SqlHandbookItem = {
  id: string
  title: string
  category: SqlTopicCategory
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  syntax: string
  description: string
  sql: string
  explanation: string
  tags: string[]
}

export const SQL_HANDBOOK: SqlHandbookItem[] = [
  // =========================================================================
  // 1. DATABASE SCHEMA
  // =========================================================================
  {
    id: 'schema-overview',
    title: 'GridFlow Sandbox Relational Schema',
    category: 'Database Schema',
    level: 'Beginner',
    syntax: 'SHOW TABLES;',
    description: 'Overview of all 7 core utility relations available in your personal isolated database sandbox.',
    sql: 'SHOW TABLES;',
    explanation: 'Lists all available relations in the sandbox: consumers, meters, bills, technicians, zones, tariffs, and service_records.',
    tags: ['schema', 'tables', 'overview', 'metadata']
  },
  {
    id: 'desc-consumers',
    title: 'Consumers Table Structure',
    category: 'Database Schema',
    level: 'Beginner',
    syntax: 'DESCRIBE consumers;',
    description: 'Inspect column definitions, types, and sample data for the consumers table.',
    sql: 'DESCRIBE consumers;',
    explanation: 'Shows column names (id, name, account, address, zone, plan, usage, status, email, phone) and inferenced SQL types.',
    tags: ['describe', 'consumers', 'schema', 'columns']
  },
  {
    id: 'desc-meters',
    title: 'Meters Table Structure',
    category: 'Database Schema',
    level: 'Beginner',
    syntax: 'DESCRIBE meters;',
    description: 'Inspect columns for the smart metering network infrastructure table.',
    sql: 'DESCRIBE meters;',
    explanation: 'Examines columns: serial, consumerId, zone, reading, signal, and status (Online/Offline/Installing).',
    tags: ['describe', 'meters', 'iot', 'hardware']
  },
  {
    id: 'desc-bills',
    title: 'Bills Table Structure',
    category: 'Database Schema',
    level: 'Beginner',
    syntax: 'DESCRIBE bills;',
    description: 'Inspect columns for utility billing and payment tracking.',
    sql: 'DESCRIBE bills;',
    explanation: 'Shows invoice records: period, usage, amount, due date, and payment status (Paid/Pending/Overdue).',
    tags: ['describe', 'bills', 'finance', 'invoices']
  },

  // =========================================================================
  // 2. DQL: QUERIES & FILTERING
  // =========================================================================
  {
    id: 'dql-select-all',
    title: 'Select All Rows & Columns',
    category: 'DQL: Queries & Filtering',
    level: 'Beginner',
    syntax: 'SELECT * FROM table_name LIMIT n;',
    description: 'Retrieve all fields and records from a table with a safe result cap.',
    sql: 'SELECT * FROM consumers LIMIT 10;',
    explanation: 'Uses the asterisk wildcard (*) to project every column in the consumers relation, capped at the first 10 records.',
    tags: ['select', 'wildcard', 'limit', 'basic']
  },
  {
    id: 'dql-column-projection',
    title: 'Column Projection with Aliases',
    category: 'DQL: Queries & Filtering',
    level: 'Beginner',
    syntax: 'SELECT col1 AS alias1, col2 AS alias2 FROM table_name;',
    description: 'Select only the necessary columns and rename them cleanly in the result view.',
    sql: 'SELECT name AS consumer_name, account AS account_id, plan, usage AS kwh_consumed FROM consumers LIMIT 8;',
    explanation: 'Projects specific fields rather than pulling the full row, renaming them using AS aliases for clear reporting.',
    tags: ['select', 'aliases', 'projection', 'clean']
  },
  {
    id: 'dql-where-equality',
    title: 'Filtering by Exact Match (WHERE =)',
    category: 'DQL: Queries & Filtering',
    level: 'Beginner',
    syntax: 'SELECT * FROM table WHERE column = \'value\';',
    description: 'Filter rows where a categorical or status field matches a target value.',
    sql: "SELECT name, account, zone, plan FROM consumers WHERE status = 'Active';",
    explanation: 'Restricts output to consumers whose account status is currently Active.',
    tags: ['where', 'filtering', 'equality', 'status']
  },
  {
    id: 'dql-where-numeric',
    title: 'Numeric Range Comparisons (<, >, >=, <=)',
    category: 'DQL: Queries & Filtering',
    level: 'Beginner',
    syntax: 'SELECT * FROM table WHERE numeric_col >= threshold;',
    description: 'Identify heavy energy consumers exceeding specific kWh consumption benchmarks.',
    sql: 'SELECT name, zone, plan, usage FROM consumers WHERE usage >= 250 ORDER BY usage DESC;',
    explanation: 'Filters for consumers with 250 kWh or more, sorted from highest consumption down to lowest.',
    tags: ['numeric', 'comparison', 'greater-than', 'usage']
  },
  {
    id: 'dql-where-like',
    title: 'Pattern Matching (LIKE & %)',
    category: 'DQL: Queries & Filtering',
    level: 'Intermediate',
    syntax: "SELECT * FROM table WHERE column LIKE 'pattern%';",
    description: 'Search text columns using wildcards (% matches zero or more characters).',
    sql: "SELECT name, account, address, zone FROM consumers WHERE name LIKE 'A%' OR name LIKE 'S%';",
    explanation: 'Finds consumers whose names begin with the letter A or S using the percent wildcard operator.',
    tags: ['like', 'wildcard', 'pattern-matching', 'search']
  },
  {
    id: 'dql-where-in',
    title: 'List Inclusion with IN Operator',
    category: 'DQL: Queries & Filtering',
    level: 'Beginner',
    syntax: 'SELECT * FROM table WHERE column IN (val1, val2, ...);',
    description: 'Match against a defined list of categories without repetitive OR conditions.',
    sql: "SELECT name, zone, plan, usage FROM consumers WHERE plan IN ('Commercial', 'Industrial');",
    explanation: 'Equivalent to (plan = \'Commercial\' OR plan = \'Industrial\'), but concise and scalable.',
    tags: ['in', 'set-membership', 'or-clause', 'categories']
  },
  {
    id: 'dql-order-limit',
    title: 'Sorting & Pagination (ORDER BY + LIMIT + OFFSET)',
    category: 'DQL: Queries & Filtering',
    level: 'Intermediate',
    syntax: 'SELECT * FROM table ORDER BY column DESC LIMIT n OFFSET m;',
    description: 'Sort high-to-low and paginate through records for user interfaces.',
    sql: 'SELECT id, consumer, amount, due, status FROM bills ORDER BY amount DESC LIMIT 5 OFFSET 0;',
    explanation: 'Retrieves the top 5 largest bills in the entire database, ideal for revenue risk audits.',
    tags: ['order-by', 'sorting', 'limit', 'offset', 'pagination']
  },

  // =========================================================================
  // 3. RELATIONAL JOINS
  // =========================================================================
  {
    id: 'join-inner',
    title: 'INNER JOIN: Consumers with Smart Meters',
    category: 'Relational Joins',
    level: 'Intermediate',
    syntax: 'SELECT ... FROM tableA a INNER JOIN tableB b ON a.id = b.foreign_key;',
    description: 'Correlate consumers directly with their assigned physical meter hardware.',
    sql: `SELECT c.name AS customer, c.account, m.serial AS meter_serial, m.status AS meter_status, m.reading AS last_reading
FROM consumers c
INNER JOIN meters m ON c.id = m.consumerId
ORDER BY m.reading DESC;`,
    explanation: 'Only returns rows where a consumer has an active corresponding meter registered.',
    tags: ['inner-join', 'relations', 'hardware', 'correlation']
  },
  {
    id: 'join-left',
    title: 'LEFT JOIN: Preserve All Consumers (Including Unmetered)',
    category: 'Relational Joins',
    level: 'Intermediate',
    syntax: 'SELECT ... FROM tableA a LEFT JOIN tableB b ON a.id = b.foreign_key;',
    description: 'Find all consumers and show meter details if present, or NULL if awaiting installation.',
    sql: `SELECT c.name, c.zone, c.plan, m.serial, m.signal, m.status AS meter_status
FROM consumers c
LEFT JOIN meters m ON c.id = m.consumerId
ORDER BY c.name ASC;`,
    explanation: 'Preserves every row in consumers. If no meter exists, meter fields are safely populated with NULL.',
    tags: ['left-join', 'outer-join', 'null-handling', 'complete-set']
  },
  {
    id: 'join-three-tables',
    title: 'Multi-Table Relational Join (Consumers + Meters + Bills)',
    category: 'Relational Joins',
    level: 'Advanced',
    syntax: 'SELECT ... FROM A a JOIN B b ON ... JOIN C c ON ...;',
    description: 'Join three related tables together to build a consolidated operational audit view.',
    sql: `SELECT c.name AS consumer, c.zone, m.serial AS meter_id, b.amount AS billed_amount, b.status AS bill_status
FROM consumers c
LEFT JOIN meters m ON c.id = m.consumerId
LEFT JOIN bills b ON c.id = b.consumerId
ORDER BY b.amount DESC
LIMIT 10;`,
    explanation: 'Combines consumer profiles, their hardware telemetry, and their financial invoice records in one query.',
    tags: ['multi-table', '3-way-join', 'enterprise', 'audit']
  },

  // =========================================================================
  // 4. AGGREGATES & GROUPING
  // =========================================================================
  {
    id: 'agg-summary',
    title: 'Global Aggregates (COUNT, SUM, AVG, MIN, MAX)',
    category: 'Aggregates & Grouping',
    level: 'Beginner',
    syntax: 'SELECT COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col) FROM table;',
    description: 'Calculate overall statistical metrics across the entire utility dataset.',
    sql: `SELECT 
  COUNT(*) AS total_consumers,
  SUM(usage) AS total_kwh,
  AVG(usage) AS average_kwh,
  MIN(usage) AS lowest_kwh,
  MAX(usage) AS peak_kwh
FROM consumers;`,
    explanation: 'Applies aggregate functions across all consumers without a GROUP BY clause to yield a single executive summary row.',
    tags: ['count', 'sum', 'avg', 'min', 'max', 'summary']
  },
  {
    id: 'agg-group-by-zone',
    title: 'GROUP BY: Regional Grid Load by Zone',
    category: 'Aggregates & Grouping',
    level: 'Intermediate',
    syntax: 'SELECT category_col, COUNT(*), SUM(metric) FROM table GROUP BY category_col;',
    description: 'Aggregate connected consumer counts and cumulative power demand by geographical zone.',
    sql: `SELECT 
  zone,
  COUNT(*) AS total_consumers,
  SUM(usage) AS cumulative_load_kwh,
  AVG(usage) AS avg_consumer_load
FROM consumers
GROUP BY zone
ORDER BY cumulative_load_kwh DESC;`,
    explanation: 'Partitions consumers into distinct zone buckets and computes summary aggregates for each region.',
    tags: ['group-by', 'regional', 'aggregation', 'zones']
  },
  {
    id: 'agg-group-by-plan',
    title: 'GROUP BY: Tariff Plan Distribution',
    category: 'Aggregates & Grouping',
    level: 'Intermediate',
    syntax: 'SELECT plan, COUNT(*) FROM consumers GROUP BY plan;',
    description: 'Analyze how consumer accounts are distributed across Residential, Commercial, and Industrial plans.',
    sql: `SELECT 
  plan,
  COUNT(*) AS total_accounts,
  SUM(usage) AS total_consumption,
  AVG(usage) AS average_usage
FROM consumers
GROUP BY plan
ORDER BY total_accounts DESC;`,
    explanation: 'Groups accounts by electricity rate plan, computing total volume and average usage per plan.',
    tags: ['group-by', 'tariffs', 'plans', 'distribution']
  },
  {
    id: 'agg-bills-by-status',
    title: 'Financial Revenue by Bill Status',
    category: 'Aggregates & Grouping',
    level: 'Intermediate',
    syntax: 'SELECT status, COUNT(*), SUM(amount) FROM bills GROUP BY status;',
    description: 'Calculate total revenue collected vs pending vs overdue in INR.',
    sql: `SELECT 
  status,
  COUNT(*) AS total_invoices,
  SUM(amount) AS total_inr,
  AVG(amount) AS avg_invoice_inr
FROM bills
GROUP BY status
ORDER BY total_inr DESC;`,
    explanation: 'Provides revenue reconciliation showing money collected, pending payment, and overdue delinquent balances.',
    tags: ['bills', 'revenue', 'finance', 'group-by']
  },

  // =========================================================================
  // 5. DML: INSERTS & UPDATES
  // =========================================================================
  {
    id: 'dml-insert-consumer',
    title: 'INSERT: Register a New Consumer',
    category: 'DML: Inserts & Updates',
    level: 'Beginner',
    syntax: 'INSERT INTO table (col1, col2, ...) VALUES (val1, val2, ...);',
    description: 'Safely add a new electricity consumer into your personal sandbox database.',
    sql: `INSERT INTO consumers (name, account, address, zone, plan, usage, status, email, phone)
VALUES ('Sundararajan M', 'GF-7788', '142 Gandhi Road, RS Puram', 'Coimbatore Central', 'Residential', 185, 'Active', 'sundar@example.com', '9842100011');`,
    explanation: 'Adds a new row to the sandbox consumers table. The new consumer will immediately appear in the GridFlow Consumers page!',
    tags: ['insert', 'add-record', 'dml', 'mutation']
  },
  {
    id: 'dml-update-status',
    title: 'UPDATE: Modify Consumer Plan & Status',
    category: 'DML: Inserts & Updates',
    level: 'Intermediate',
    syntax: 'UPDATE table SET col = val WHERE condition;',
    description: 'Update specific fields for records matching a target condition.',
    sql: `UPDATE consumers 
SET plan = 'Commercial', usage = 320 
WHERE account = 'GF-2041';`,
    explanation: 'Modifies the plan and usage values only for the account with ID GF-2041.',
    tags: ['update', 'set', 'modify', 'dml']
  },
  {
    id: 'dml-delete-inactive',
    title: 'DELETE: Remove Outdated Inactive Records',
    category: 'DML: Inserts & Updates',
    level: 'Intermediate',
    syntax: 'DELETE FROM table WHERE condition;',
    description: 'Delete records that match a strict filter. Remember: In student sandbox mode, changes can always be rolled back!',
    sql: `DELETE FROM consumers 
WHERE status = 'Inactive' AND usage = 0;`,
    explanation: 'Deletes inactive accounts with zero consumption. Rollback anytime with the 1-click Reset Sandbox button.',
    tags: ['delete', 'remove', 'cleanup', 'dml']
  },

  // =========================================================================
  // 6. DDL: TABLES & SCHEMAS
  // =========================================================================
  {
    id: 'ddl-create-table',
    title: 'CREATE TABLE: Create a Custom Lab Relation',
    category: 'DDL: Tables & Schemas',
    level: 'Intermediate',
    syntax: 'CREATE TABLE table_name (col1 type, col2 type, ...);',
    description: 'Create a brand new relational table inside your sandbox environment.',
    sql: `CREATE TABLE solar_microgrids (
  id serial,
  substation_name text,
  capacity_kw numeric,
  battery_storage_kwh numeric,
  connected_zone text,
  is_operational boolean
);`,
    explanation: 'Defines and registers a new table named solar_microgrids with structured column types.',
    tags: ['create-table', 'ddl', 'schema-creation', 'custom']
  },
  {
    id: 'ddl-alter-table',
    title: 'ALTER TABLE: Add New Column',
    category: 'DDL: Tables & Schemas',
    level: 'Intermediate',
    syntax: 'ALTER TABLE table_name ADD COLUMN column_name data_type;',
    description: 'Expand an existing relation by appending a new column attribute.',
    sql: 'ALTER TABLE consumers ADD COLUMN emergency_contact text;',
    explanation: 'Adds the emergency_contact column to every consumer record in the sandbox.',
    tags: ['alter-table', 'add-column', 'schema-migration']
  },
  {
    id: 'ddl-truncate',
    title: 'TRUNCATE TABLE: Fast Data Purge',
    category: 'DDL: Tables & Schemas',
    level: 'Advanced',
    syntax: 'TRUNCATE TABLE table_name;',
    description: 'Quickly remove all records from a relation while preserving its column structure.',
    sql: 'TRUNCATE TABLE bills;',
    explanation: 'Empties the bills table completely. Use Reset Sandbox if you want to restore factory seed bills!',
    tags: ['truncate', 'purge', 'ddl', 'fast-clear']
  },
  {
    id: 'ddl-drop-table',
    title: 'DROP TABLE: Remove a Custom Relation',
    category: 'DDL: Tables & Schemas',
    level: 'Intermediate',
    syntax: 'DROP TABLE IF EXISTS table_name;',
    description: 'Permanently remove a table definition and its contents from the sandbox.',
    sql: 'DROP TABLE IF EXISTS solar_microgrids;',
    explanation: 'Removes the solar_microgrids table created during experimentation.',
    tags: ['drop-table', 'ddl', 'cleanup']
  },

  // =========================================================================
  // 7. TRANSACTIONS & ACID
  // =========================================================================
  {
    id: 'tx-begin-rollback',
    title: 'Transaction Safety: BEGIN & ROLLBACK',
    category: 'Transactions & ACID',
    level: 'Advanced',
    syntax: 'BEGIN; ... UPDATE ...; ROLLBACK;',
    description: 'Test destructive operations with 100% safety using transactional checkpoints.',
    sql: `BEGIN;
-- Try updating or deleting records here
-- Then run ROLLBACK to undo everything!`,
    explanation: 'Takes an instant snapshot of your database state. Running ROLLBACK restores the tables to this exact checkpoint.',
    tags: ['transactions', 'acid', 'begin', 'rollback', 'atomicity']
  },
  {
    id: 'tx-commit',
    title: 'Transaction Finalization: COMMIT',
    category: 'Transactions & ACID',
    level: 'Advanced',
    syntax: 'BEGIN; ... modifications ...; COMMIT;',
    description: 'Commit multiple SQL changes together as a single atomic unit of work.',
    sql: 'COMMIT;',
    explanation: 'Commits all updates made during the current transaction session to your personal sandbox.',
    tags: ['commit', 'acid', 'transactions', 'persistence']
  }
]
