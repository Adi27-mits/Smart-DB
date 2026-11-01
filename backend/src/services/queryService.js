/**
 * queryService.js — Service for SQL Query Execution
 *
 * Responsibilities:
 *  - Validate query structure (single statement vs multiple statements)
 *  - Categorize statement type (SELECT, SHOW, DESCRIBE, EXPLAIN, INSERT, UPDATE, DELETE, DDL)
 *  - Execute query via mysql2 pool
 *  - Record execution duration with high-resolution timer
 *  - Format tabular results or mutation metadata
 *  - Return safe, descriptive errors without leaking backend credentials
 */

/**
 * Checks whether an SQL string contains multiple statements chained by unquoted semicolons.
 * Allows trailing semicolons and semicolons inside quotes or comments.
 *
 * @param {string} sql
 * @returns {boolean} True if multiple statements are detected
 */
function hasMultipleStatements(sql) {
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBacktick = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    const next = sql[i + 1]

    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (ch === '-' && next === '-') {
        inLineComment = true
        i++
        continue
      }
      if (ch === '#') {
        inLineComment = true
        continue
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true
        i++
        continue
      }
    }

    if (ch === "'" && !inDoubleQuote && !inBacktick) {
      if (sql[i - 1] !== '\\') inSingleQuote = !inSingleQuote
      continue
    }
    if (ch === '"' && !inSingleQuote && !inBacktick) {
      if (sql[i - 1] !== '\\') inDoubleQuote = !inDoubleQuote
      continue
    }
    if (ch === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick
      continue
    }

    if (ch === ';' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      const rest = sql.slice(i + 1).trim()
      // Check if there is another non-comment, non-whitespace token after the semicolon
      if (
        rest.length > 0 &&
        !rest.startsWith('--') &&
        !rest.startsWith('#') &&
        !rest.startsWith('/*')
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Strips leading comments and whitespace to discover the primary SQL command keyword.
 *
 * @param {string} sql
 * @returns {string} Uppercase keyword e.g. "SELECT", "SHOW", "INSERT"
 */
function extractLeadingKeyword(sql) {
  // Remove block comments /* ... */
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, ' ')
  // Remove line comments -- ... and # ...
  cleaned = cleaned.replace(/(--|#)[^\n]*/g, ' ')
  cleaned = cleaned.trim()

  const match = cleaned.match(/^([a-zA-Z]+)/)
  return match ? match[1].toUpperCase() : 'OTHER'
}

/**
 * Categorizes the statement into a high-level type.
 *
 * @param {string} keyword
 * @returns {string}
 */
function getStatementCategory(keyword) {
  switch (keyword) {
    case 'SELECT':
    case 'WITH':
      return 'SELECT'
    case 'SHOW':
      return 'SHOW'
    case 'DESCRIBE':
    case 'DESC':
      return 'DESCRIBE'
    case 'EXPLAIN':
      return 'EXPLAIN'
    case 'INSERT':
      return 'INSERT'
    case 'UPDATE':
      return 'UPDATE'
    case 'DELETE':
      return 'DELETE'
    case 'CREATE':
    case 'ALTER':
    case 'DROP':
    case 'TRUNCATE':
    case 'RENAME':
      return 'DDL'
    default:
      return 'OTHER'
  }
}

/**
 * Determines whether a query is read-only (SELECT, SHOW, DESCRIBE, DESC, EXPLAIN, or read-only WITH).
 *
 * @param {string} sql
 * @returns {boolean}
 */
function isReadOnlyQuery(sql) {
  // Strip block comments /* ... */
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, ' ')
  // Strip line comments -- ... and # ...
  cleaned = cleaned.replace(/(--|#)[^\n]*/g, ' ').trim()

  const match = cleaned.match(/^([a-zA-Z]+)/)
  if (!match) return false
  const keyword = match[1].toUpperCase()

  const allowed = ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN']
  if (allowed.includes(keyword)) {
    return true
  }

  if (keyword === 'WITH') {
    const modifyingWords = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|RENAME)\b/i
    return !modifyingWords.test(cleaned)
  }

  return false
}

/**
 * Executes an arbitrary SQL query against the provided MySQL connection pool.
 *
 * @param {import('mysql2/promise').Pool} pool - Active database connection pool
 * @param {string} rawSql - Raw SQL statement
 * @param {object} [options]
 * @param {number} [options.limit=1000] - Maximum rows to return in a result set
 * @returns {Promise<object>}
 */
async function executeSqlQuery(pool, rawSql, options = {}) {
  const limit = options.limit || 1000
  const trimmed = rawSql.trim()

  // 1. Guard against empty query
  if (!trimmed) {
    const err = new Error('SQL query cannot be empty.')
    err.code = 'EMPTY_QUERY'
    throw err
  }

  // 2. Multi-statement security check
  if (hasMultipleStatements(trimmed)) {
    const err = new Error(
      'Executing multiple SQL statements in a single request is disabled for safety. Please execute one statement at a time.'
    )
    err.code = 'MULTIPLE_STATEMENTS_NOT_ALLOWED'
    throw err
  }

  // 3. Remove trailing semicolon for clean mysql execution
  let executableSql = trimmed
  if (executableSql.endsWith(';')) {
    executableSql = executableSql.slice(0, -1).trim()
  }

  // 4. Enforce read-only restriction for Query Console
  if (!isReadOnlyQuery(executableSql)) {
    const err = new Error(
      'The SQL Query Console is read-only. Modifying statements (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE, RENAME) are not permitted.'
    )
    err.code = 'READ_ONLY_QUERY_CONSOLE'
    throw err
  }

  const keyword = extractLeadingKeyword(executableSql)
  const statementType = getStatementCategory(keyword)

  // 5. Measure execution time
  const startTime = process.hrtime.bigint()
  let result, fields

  try {
    const queryResponse = await pool.query(executableSql)
    result = queryResponse[0]
    fields = queryResponse[1]
  } catch (err) {
    // Preserve MySQL code and message while stripping internal paths
    const execErr = new Error(err.sqlMessage || err.message || 'Error executing SQL query.')
    execErr.code = err.code || 'ER_QUERY_FAILED'
    execErr.sqlState = err.sqlState
    execErr.sqlMessage = err.sqlMessage
    throw execErr
  }

  const endTime = process.hrtime.bigint()
  const durationMs = Number(endTime - startTime) / 1e6
  const executionTimeMs = Math.round(durationMs * 100) / 100

  // 5. Format response based on result type
  if (Array.isArray(result)) {
    // Query returned a tabular result set (e.g. SELECT, SHOW, DESCRIBE, EXPLAIN)
    let columns = []
    if (fields && fields.length > 0) {
      columns = fields.map((f) => f.name)
    } else if (result.length > 0) {
      columns = Object.keys(result[0])
    }

    const totalRows = result.length
    const rows = result.slice(0, limit)
    const truncated = totalRows > limit

    return {
      query: trimmed,
      statementType,
      isResultSet: true,
      columns,
      rows,
      rowCount: totalRows,
      truncated,
      executionTimeMs,
      message: `Query returned ${totalRows} row(s) in ${executionTimeMs} ms.${
        truncated ? ` Displaying first ${limit} rows.` : ''
      }`,
    }
  }

  // Mutation or DDL query returning ResultSetHeader
  const affectedRows = result.affectedRows ?? 0
  const insertId = result.insertId ?? null
  const changedRows = result.changedRows ?? null
  const warningStatus = result.warningStatus ?? 0

  let message = `${statementType} executed successfully in ${executionTimeMs} ms. ${affectedRows} row(s) affected.`
  if (insertId) {
    message += ` Insert ID: ${insertId}.`
  }
  if (result.message) {
    message += ` (${result.message})`
  }

  return {
    query: trimmed,
    statementType,
    isResultSet: false,
    columns: [],
    rows: [],
    rowCount: 0,
    affectedRows,
    insertId,
    changedRows,
    warningStatus,
    executionTimeMs,
    message,
  }
}

module.exports = {
  executeSqlQuery,
  hasMultipleStatements,
  extractLeadingKeyword,
  getStatementCategory,
}
