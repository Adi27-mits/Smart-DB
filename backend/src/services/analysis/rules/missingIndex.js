/**
 * missingIndex.js — Rule R004: Index Review Recommended
 *
 * Analyzes extracted index metadata to identify relationship, join,
 * or filter columns that may benefit from an index but currently lack one.
 *
 * Checks:
 *   1. Relational join columns (declared foreign keys or heuristic *_id columns
 *      pointing to entity tables).
 *   2. Whether any index on the table covers this column (particularly as the
 *      leading column of an index).
 *   3. If unindexed, flags with severity LOW and cautious wording.
 *
 * Targets in test database:
 *   - students.department_id
 *   - orders.customer_id
 */

const RULE_ID = 'R004'
const CATEGORY = 'INDEXES'
const SEVERITY = 'LOW'

/**
 * Checks whether a column is covered by any existing index in the table.
 *
 * @param {Array<object>} indexes - Array of index objects from schema
 * @param {string} columnName
 * @returns {boolean}
 */
function isColumnIndexed(indexes, columnName) {
  if (!Array.isArray(indexes)) return false
  const colLower = columnName.toLowerCase()

  for (const idx of indexes) {
    const cols = idx.columns || []
    // If the column is in the index (especially leading position)
    if (cols.some((c) => c.toLowerCase() === colLower)) {
      return true
    }
  }
  return false
}

/**
 * Checks if a table has a primary key (skips append-only raw logs).
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
 * Analyze schema for columns that should be reviewed for indexing.
 *
 * @param {object} schema - Normalized database schema
 * @returns {Array<object>} List of detected R004 issues
 */
function analyze(schema) {
  const issues = []
  const tables = schema.tables || []

  // Collect all known table names (for detecting *_id entity join columns)
  const knownTableBases = new Set()
  for (const t of tables) {
    const base = (t.name || t.id || '').toLowerCase()
    knownTableBases.add(base)
    if (base.endsWith('s')) knownTableBases.add(base.slice(0, -1))
    if (base.endsWith('es')) knownTableBases.add(base.slice(0, -2))
  }

  for (const table of tables) {
    const tableName = table.name || table.id
    const tNameLower = tableName.toLowerCase()

    // Skip log tables or tables without primary keys
    if (tNameLower.endsWith('_log') || !hasPrimaryKey(table)) {
      continue
    }

    const columns = table.columns || []
    const indexes = table.indexes || []
    const pkSet = new Set(
      (table.primaryKeys || []).map((k) => k.toLowerCase())
    )

    for (const col of columns) {
      const colName = col.name
      const colNameLower = colName.toLowerCase()

      // Skip own primary key (primary keys are automatically indexed)
      if (pkSet.has(colNameLower) || col.primaryKey || col.pk) {
        continue
      }

      // Check if this column is a join/foreign key candidate:
      // a) Declared foreign key
      const isDeclaredFk = Boolean(
        col.foreignKey ||
          col.fk ||
          (Array.isArray(table.foreignKeys) &&
            table.foreignKeys.some((fk) => fk.column?.toLowerCase() === colNameLower))
      )

      // b) Suffix *_id representing entity relationship
      let isCandidateFk = false
      if (colNameLower.endsWith('_id')) {
        const entityPrefix = colNameLower.slice(0, -3)
        if (knownTableBases.has(entityPrefix)) {
          isCandidateFk = true
        }
      }

      if (isDeclaredFk || isCandidateFk) {
        // Check if an index exists covering this column
        const indexed = isColumnIndexed(indexes, colName)

        if (!indexed) {
          issues.push({
            ruleId: RULE_ID,
            category: CATEGORY,
            severity: SEVERITY,
            table: tableName,
            column: colName,
            title: 'Index Review Recommended',
            evidence: `Column '${tableName}.${colName}' is a foreign-key or relationship column without an index.`,
            recommendation: `Review whether an index on ${tableName}.${colName} would improve join or filtering performance.`,
          })
        }
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
  isColumnIndexed,
}
