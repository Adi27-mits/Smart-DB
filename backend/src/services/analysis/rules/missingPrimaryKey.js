/**
 * missingPrimaryKey.js — Rule R001: Missing Primary Key
 *
 * For every table:
 *   IF no primary key exists
 *   THEN emit R001 issue with severity HIGH
 *
 * Target in test database: attendance_log
 */

const RULE_ID = 'R001'
const CATEGORY = 'KEYS'
const SEVERITY = 'HIGH'

/**
 * Checks whether a table defines a primary key.
 *
 * @param {object} table - Table object from normalized schema
 * @returns {boolean} true if table has at least one PK column
 */
function hasPrimaryKey(table) {
  if (Array.isArray(table.primaryKeys) && table.primaryKeys.length > 0) {
    return true
  }
  if (Array.isArray(table.columns)) {
    return table.columns.some((col) => col.primaryKey === true || col.pk === true)
  }
  return false
}

/**
 * Analyze schema for tables missing primary keys.
 *
 * @param {object} schema - Normalized database schema
 * @returns {Array<object>} List of detected R001 issues
 */
function analyze(schema) {
  const issues = []
  const tables = schema.tables || []

  for (const table of tables) {
    const tableName = table.name || table.id

    if (!hasPrimaryKey(table)) {
      issues.push({
        ruleId: RULE_ID,
        category: CATEGORY,
        severity: SEVERITY,
        table: tableName,
        column: null,
        title: 'Missing Primary Key',
        evidence: `Table '${tableName}' does not define a primary key.`,
        recommendation:
          'Consider defining a primary key or an appropriate composite primary key.',
      })
    }
  }

  return issues
}

module.exports = {
  ruleId: RULE_ID,
  category: CATEGORY,
  severity: SEVERITY,
  analyze,
}
