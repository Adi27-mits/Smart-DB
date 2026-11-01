/**
 * dataService.js — Row-level CRUD operations on tables
 *
 * Provides:
 *  - getTableData: Paginated reading of rows with total row count
 *  - getTableMetadata: Primary keys and column metadata for form generation
 *  - insertRow: Safe parameterized INSERT
 *  - updateRow: Safe parameterized UPDATE with required criteria (prevents full-table update)
 *  - deleteRow: Safe parameterized DELETE with required criteria (prevents full-table deletion)
 */

const { getTableDetails } = require('./schemaService')

/**
 * Sanitizes and formats a single column value for MySQL.
 * Converts ISO-8601 date strings to MySQL 'YYYY-MM-DD HH:MM:SS' format.
 * Converts empty strings to null.
 */
function sanitizeSqlValue(val) {
  if (val === '' || val === undefined) return null
  if (val instanceof Date) {
    return val.toISOString().slice(0, 19).replace('T', ' ')
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    // Match ISO-8601 strings e.g. 2026-10-19T15:37:29.000Z or 2026-10-19T15:37:29
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/i.test(trimmed)) {
      const d = new Date(trimmed)
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 19).replace('T', ' ')
      }
    }
    return trimmed
  }
  return val
}

/**
 * Validates that an identifier contains only safe alphanumeric/underscore characters.
 *
 * @param {string} identifier
 */
function assertSafeIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string' || !/^[a-zA-Z0-9_]+$/.test(identifier)) {
    const err = new Error(`Invalid column or table name: '${identifier}'`)
    err.code = 'INVALID_IDENTIFIER'
    throw err
  }
}

/**
 * Fetch rows from a specific table with basic pagination.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @param {string} tableName
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<{ rows: Array<object>, totalCount: number }>}
 */
async function getTableData(pool, dbName, tableName, limit = 50, offset = 0) {
  assertSafeIdentifier(tableName)

  // 1. Get total row count
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as total FROM \`${dbName}\`.\`${tableName}\``
  )
  const totalCount = countRows[0].total

  // 2. Fetch rows with limit and offset
  const [rows] = await pool.execute(
    `SELECT * FROM \`${dbName}\`.\`${tableName}\` LIMIT ? OFFSET ?`,
    [Number(limit), Number(offset)]
  )

  return { rows, totalCount }
}

/**
 * Retrieves metadata for a table to inform CRUD forms (primary keys, nullable, types, auto-increment).
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @param {string} tableName
 * @returns {Promise<object>}
 */
async function getTableMetadata(pool, dbName, tableName) {
  assertSafeIdentifier(tableName)
  const details = await getTableDetails(pool, dbName, tableName)
  return {
    tableName: details.tableName,
    columns: details.columns || [],
    primaryKeys: details.primaryKeys || [],
    foreignKeys: details.foreignKeys || [],
  }
}

/**
 * Inserts a new record into a table.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @param {string} tableName
 * @param {object} rowData - Key-value map of column names to values
 * @returns {Promise<{ insertId: number | null, affectedRows: number }>}
 */
async function insertRow(pool, dbName, tableName, rowData) {
  assertSafeIdentifier(tableName)

  if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
    const err = new Error('Row data must be a valid key-value object.')
    err.code = 'INVALID_ROW_DATA'
    throw err
  }

  // Filter out undefined and extract keys
  const keys = Object.keys(rowData).filter((k) => rowData[k] !== undefined)
  if (keys.length === 0) {
    const err = new Error('Row data cannot be empty.')
    err.code = 'EMPTY_ROW_DATA'
    throw err
  }

  // Validate all column names
  for (const key of keys) {
    assertSafeIdentifier(key)
  }

  const values = keys.map((k) => sanitizeSqlValue(rowData[k]))
  const columnList = keys.map((k) => `\`${k}\``).join(', ')
  const placeholders = keys.map(() => '?').join(', ')

  const sql = `INSERT INTO \`${dbName}\`.\`${tableName}\` (${columnList}) VALUES (${placeholders})`
  const [result] = await pool.execute(sql, values)

  return {
    insertId: result.insertId || null,
    affectedRows: result.affectedRows || 0,
  }
}

/**
 * Updates an existing record matching primary key / criteria.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @param {string} tableName
 * @param {object} criteria - Condition identifying the row (e.g. { task_id: 1 })
 * @param {object} updateData - Key-value map of columns to update
 * @returns {Promise<{ affectedRows: number, changedRows: number }>}
 */
async function updateRow(pool, dbName, tableName, criteria, updateData) {
  assertSafeIdentifier(tableName)

  if (!criteria || typeof criteria !== 'object' || Object.keys(criteria).length === 0) {
    const err = new Error('Update criteria is required to prevent accidental full-table update.')
    err.code = 'CRITERIA_REQUIRED'
    throw err
  }

  if (!updateData || typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
    const err = new Error('No update fields provided.')
    err.code = 'NO_UPDATE_DATA'
    throw err
  }

  const critKeys = Object.keys(criteria).filter((k) => criteria[k] !== undefined)
  if (critKeys.length === 0) {
    const err = new Error('Update criteria cannot be empty.')
    err.code = 'CRITERIA_REQUIRED'
    throw err
  }

  // Omit criteria keys from SET clause if their values match criteria values (e.g. primary keys)
  const setKeys = Object.keys(updateData).filter(
    (k) => updateData[k] !== undefined && (!critKeys.includes(k) || updateData[k] !== criteria[k])
  )

  if (setKeys.length === 0) {
    return {
      affectedRows: 1,
      changedRows: 0,
      message: 'No fields were modified.',
    }
  }

  // Validate column names
  for (const k of setKeys) assertSafeIdentifier(k)
  for (const k of critKeys) assertSafeIdentifier(k)

  const setClause = setKeys.map((k) => `\`${k}\` = ?`).join(', ')
  const whereClause = critKeys.map((k) => `\`${k}\` = ?`).join(' AND ')

  const setValues = setKeys.map((k) => sanitizeSqlValue(updateData[k]))
  const critValues = critKeys.map((k) => criteria[k])

  const sql = `UPDATE \`${dbName}\`.\`${tableName}\` SET ${setClause} WHERE ${whereClause}`
  const [result] = await pool.execute(sql, [...setValues, ...critValues])

  return {
    affectedRows: result.affectedRows || 0,
    changedRows: result.changedRows !== undefined ? result.changedRows : result.affectedRows,
  }
}

/**
 * Deletes a record matching primary key / criteria.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @param {string} tableName
 * @param {object} criteria - Condition identifying the row (e.g. { task_id: 1 })
 * @returns {Promise<{ affectedRows: number }>}
 */
async function deleteRow(pool, dbName, tableName, criteria) {
  assertSafeIdentifier(tableName)

  if (!criteria || typeof criteria !== 'object' || Object.keys(criteria).length === 0) {
    const err = new Error('Delete criteria is required to prevent accidental full-table deletion.')
    err.code = 'CRITERIA_REQUIRED'
    throw err
  }

  const critKeys = Object.keys(criteria).filter((k) => criteria[k] !== undefined)
  if (critKeys.length === 0) {
    const err = new Error('Delete criteria cannot be empty.')
    err.code = 'CRITERIA_REQUIRED'
    throw err
  }

  for (const k of critKeys) assertSafeIdentifier(k)

  const whereClause = critKeys.map((k) => `\`${k}\` = ?`).join(' AND ')
  const critValues = critKeys.map((k) => criteria[k])

  const sql = `DELETE FROM \`${dbName}\`.\`${tableName}\` WHERE ${whereClause}`
  const [result] = await pool.execute(sql, critValues)

  return {
    affectedRows: result.affectedRows || 0,
  }
}

module.exports = {
  getTableData,
  getTableMetadata,
  insertRow,
  updateRow,
  deleteRow,
  assertSafeIdentifier,
}
