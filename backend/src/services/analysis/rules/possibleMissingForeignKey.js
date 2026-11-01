/**
 * possibleMissingForeignKey.js — Rule R003: Possible Missing Foreign Key
 *
 * Heuristic analysis to detect columns that likely represent relationships
 * to other tables but lack a declared foreign key constraint.
 *
 * Heuristics used:
 *   1. Column name ends with `_id` (e.g. `department_id`, `customer_id`).
 *   2. Column is NOT already part of a declared foreign key.
 *   3. Column is NOT the primary key of its own table.
 *   4. Candidate target table exists whose name matches the prefix or entity name:
 *        `department_id` -> `departments` (or `department`)
 *        `customer_id`   -> `customers`   (or `customer`)
 *   5. Candidate target column is a primary key or unique key in the target table.
 *   6. Data types are compatible.
 *
 * Targets in test database:
 *   - students.department_id  -> candidate: departments.department_id
 *   - orders.customer_id      -> candidate: customers.customer_id
 */

const RULE_ID = 'R003'
const CATEGORY = 'RELATIONSHIPS'
const SEVERITY = 'MEDIUM'

/**
 * Checks whether a table defines a primary key.
 * Tables without a PK (e.g. raw logs) are excluded from FK heuristics.
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
 * Generates candidate table names from an `*_id` column name.
 * e.g. "department_id" -> ["departments", "department"]
 *      "customer_id"   -> ["customers", "customer"]
 *
 * @param {string} colName
 * @returns {string[]}
 */
function getCandidateTableNames(colName) {
  if (!colName.toLowerCase().endsWith('_id')) return []
  const base = colName.slice(0, -3).toLowerCase()
  const candidates = [
    base,
    `${base}s`,
    `${base}es`,
  ]
  if (base.endsWith('y')) {
    candidates.push(`${base.slice(0, -1)}ies`)
  }
  return candidates
}

/**
 * Checks if two SQL data types are fundamentally compatible for foreign keys.
 *
 * @param {string} typeA
 * @param {string} typeB
 * @returns {boolean}
 */
function areTypesCompatible(typeA, typeB) {
  if (!typeA || !typeB) return true
  const normA = typeA.toUpperCase().replace(/\(.*\)/, '').trim()
  const normB = typeB.toUpperCase().replace(/\(.*\)/, '').trim()

  const integerTypes = ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT']
  if (integerTypes.includes(normA) && integerTypes.includes(normB)) {
    return true
  }

  const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'VARCHAR2']
  if (stringTypes.includes(normA) && stringTypes.includes(normB)) {
    return true
  }

  return normA === normB
}

/**
 * Analyze schema for possible missing foreign keys.
 *
 * @param {object} schema - Normalized database schema
 * @returns {Array<object>} List of detected R003 issues
 */
function analyze(schema) {
  const issues = []
  const tables = schema.tables || []

  // Build table lookup map (case-insensitive)
  const tableMap = new Map()
  for (const table of tables) {
    const tName = (table.name || table.id || '').toLowerCase()
    tableMap.set(tName, table)
  }

  for (const table of tables) {
    const tableName = table.name || table.id
    const tNameLower = tableName.toLowerCase()

    // Skip append-only logs / tables without primary keys
    if (tNameLower.endsWith('_log') || !hasPrimaryKey(table)) {
      continue
    }

    const columns = table.columns || []
    const pkSet = new Set(
      (table.primaryKeys || []).map((k) => k.toLowerCase())
    )

    // Build set of columns that already have declared foreign keys
    const declaredFkCols = new Set()
    if (Array.isArray(table.foreignKeys)) {
      for (const fk of table.foreignKeys) {
        if (fk.column) declaredFkCols.add(fk.column.toLowerCase())
      }
    }
    for (const col of columns) {
      if (col.foreignKey || col.fk) {
        declaredFkCols.add(col.name.toLowerCase())
      }
    }

    for (const col of columns) {
      const colName = col.name
      const colNameLower = colName.toLowerCase()

      // Skip own primary key or already declared foreign key
      if (pkSet.has(colNameLower) || col.primaryKey || col.pk || declaredFkCols.has(colNameLower)) {
        continue
      }

      // Check if column name follows *_id pattern
      if (!colNameLower.endsWith('_id')) {
        continue
      }

      const candidateNames = getCandidateTableNames(colNameLower)
      let matchedTargetTable = null
      let matchedTargetColumn = null

      for (const candidateName of candidateNames) {
        if (candidateName === tNameLower) continue // don't match self

        const targetTable = tableMap.get(candidateName)
        if (!targetTable) continue

        const targetCols = targetTable.columns || []
        const targetPks = targetTable.primaryKeys || []

        // Look for matching PK column in candidate table
        // 1. Direct match with PK name (e.g. department_id == department_id)
        let foundCol = targetCols.find(
          (tc) =>
            tc.name.toLowerCase() === colNameLower &&
            (tc.primaryKey || tc.pk || targetPks.includes(tc.name))
        )

        // 2. Or target table's single PK (e.g. id)
        if (!foundCol && targetPks.length === 1) {
          const singlePkName = targetPks[0].toLowerCase()
          foundCol = targetCols.find((tc) => tc.name.toLowerCase() === singlePkName)
        }

        if (foundCol && areTypesCompatible(col.type, foundCol.type)) {
          matchedTargetTable = targetTable.name || targetTable.id
          matchedTargetColumn = foundCol.name
          break
        }
      }

      if (matchedTargetTable && matchedTargetColumn) {
        issues.push({
          ruleId: RULE_ID,
          category: CATEGORY,
          severity: SEVERITY,
          table: tableName,
          column: colName,
          candidateReference: `${matchedTargetTable}.${matchedTargetColumn}`,
          candidateTargetTable: matchedTargetTable,
          candidateTargetColumn: matchedTargetColumn,
          metadata: {
            candidateTable: matchedTargetTable,
            candidateColumn: matchedTargetColumn,
          },
          title: 'Possible Missing Foreign Key',
          evidence: `Column '${tableName}.${colName}' matches the primary key of table '${matchedTargetTable}' (${matchedTargetColumn}), but no foreign key constraint is declared.`,
          recommendation: `Review whether ${tableName}.${colName} should reference ${matchedTargetTable}.${matchedTargetColumn}.`,
        })
      }
    }
  }

  return issues
}

module.exports = {
  ruleId: RULE_ID,
  category: CATEGORY,
  severity: SEVERITY,
  analyze,
  getCandidateTableNames,
  areTypesCompatible,
}
