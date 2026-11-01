/**
 * orphanedTable.js — Rule R002: Potential Orphaned Table
 *
 * For each table in the declared foreign key graph:
 *   - calculate incoming relationships (tables referencing this table)
 *   - calculate outgoing relationships (tables referenced by this table)
 *
 * IF incoming === 0 AND outgoing === 0
 * THEN flag as Potential Orphaned Table (Severity: MEDIUM)
 *
 * Note: Tables without a primary key are already flagged under R001 (HIGH);
 * evaluating orphan status on valid tables identifies design isolation without
 * duplicate reporting on tables lacking relational keys.
 *
 * Targets in test database: audit_notes, customers
 */

const RULE_ID = 'R002'
const CATEGORY = 'RELATIONSHIPS'
const SEVERITY = 'MEDIUM'

/**
 * Checks whether a table defines a primary key.
 *
 * @param {object} table
 * @returns {boolean}
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
 * Normalizes source/target table names from various relationship representations.
 *
 * @param {object} rel - Relationship object
 * @returns {{ from: string, to: string }}
 */
function getRelEndpoints(rel) {
  const from = rel.from?.table || rel.sourceTable || ''
  const to = rel.to?.table || rel.targetTable || ''
  return { from, to }
}

/**
 * Analyze schema for potential orphaned tables.
 *
 * @param {object} schema - Normalized database schema
 * @param {object} [options] - Optional rule configuration
 * @param {boolean} [options.requirePrimaryKey=true] - If true, only evaluate tables with a PK
 * @returns {Array<object>} List of detected R002 issues
 */
function analyze(schema, options = {}) {
  const { requirePrimaryKey = true } = options
  const issues = []
  const tables = schema.tables || []
  const relationships = schema.relationships || []

  // Build connection map for each table
  const incomingCounts = new Map()
  const outgoingCounts = new Map()

  for (const table of tables) {
    const tableName = table.name || table.id
    incomingCounts.set(tableName, 0)
    outgoingCounts.set(tableName, 0)
  }

  // Count relationships from global relationships array
  for (const rel of relationships) {
    const { from, to } = getRelEndpoints(rel)
    if (from && outgoingCounts.has(from)) {
      outgoingCounts.set(from, outgoingCounts.get(from) + 1)
    }
    if (to && incomingCounts.has(to)) {
      incomingCounts.set(to, incomingCounts.get(to) + 1)
    }
  }

  // Also check per-table foreignKeys array if available
  for (const table of tables) {
    const tableName = table.name || table.id
    if (Array.isArray(table.foreignKeys) && table.foreignKeys.length > 0) {
      const currentOut = outgoingCounts.get(tableName) || 0
      if (currentOut === 0) {
        outgoingCounts.set(tableName, table.foreignKeys.length)
        for (const fk of table.foreignKeys) {
          const target = fk.references?.table
          if (target && incomingCounts.has(target)) {
            incomingCounts.set(target, (incomingCounts.get(target) || 0) + 1)
          }
        }
      }
    }
  }

  // Evaluate orphaned condition
  for (const table of tables) {
    const tableName = table.name || table.id

    // If requirePrimaryKey is true, skip tables with no PK (handled by R001)
    if (requirePrimaryKey && !hasPrimaryKey(table)) {
      continue
    }

    const incoming = incomingCounts.get(tableName) || 0
    const outgoing = outgoingCounts.get(tableName) || 0

    if (incoming === 0 && outgoing === 0) {
      issues.push({
        ruleId: RULE_ID,
        category: CATEGORY,
        severity: SEVERITY,
        table: tableName,
        column: null,
        title: 'Potential Orphaned Table',
        evidence: `Table '${tableName}' has no incoming or outgoing foreign key relationships in the declared schema.`,
        recommendation:
          'Review whether this table is intentionally standalone or whether a relationship with another entity is missing.',
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
