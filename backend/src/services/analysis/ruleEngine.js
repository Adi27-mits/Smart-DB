/**
 * ruleEngine.js — Rule Engine Orchestrator
 *
 * Coordinates execution of schema analysis rules against the normalized schema.
 * Pluggable design allows rules to be added incrementally across milestones.
 */

const missingPrimaryKey = require('./rules/missingPrimaryKey')
const orphanedTable = require('./rules/orphanedTable')
const possibleMissingForeignKey = require('./rules/possibleMissingForeignKey')
const missingIndex = require('./rules/missingIndex')
const dependencyAnalysis = require('./rules/dependencyAnalysis')

// Active rules for Phase 3 (R001 - R005)
const DEFAULT_RULES = [
  missingPrimaryKey,
  orphanedTable,
  possibleMissingForeignKey,
  missingIndex,
  dependencyAnalysis,
]

/**
 * Runs rule-based analysis on the provided normalized schema.
 *
 * @param {object} schema - Normalized database schema
 * @param {object} [options]
 * @param {Array<object>} [options.rules] - Custom rule array (defaults to DEFAULT_RULES)
 * @returns {{
 *   summary: {
 *     tablesAnalyzed: number,
 *     issuesFound: number,
 *     high: number,
 *     medium: number,
 *     low: number
 *   },
 *   issues: Array<object>,
 *   dependencyGraph?: object
 * }}
 */
function runRuleEngine(schema, options = {}) {
  const rules = options.rules || DEFAULT_RULES
  const tables = schema?.tables || []
  const allIssues = []

  for (const rule of rules) {
    if (typeof rule.analyze === 'function') {
      try {
        const issues = rule.analyze(schema)
        if (Array.isArray(issues)) {
          allIssues.push(...issues)
        }
      } catch (err) {
        console.error(`[RuleEngine] Error executing rule ${rule.ruleId}:`, err.message)
      }
    }
  }

  // Count severities
  let high = 0
  let medium = 0
  let low = 0

  for (const issue of allIssues) {
    const sev = (issue.severity || '').toUpperCase()
    if (sev === 'HIGH') high++
    else if (sev === 'MEDIUM') medium++
    else if (sev === 'LOW') low++
  }

  return {
    summary: {
      tablesAnalyzed: tables.length,
      issuesFound: allIssues.length,
      high,
      medium,
      low,
    },
    issues: allIssues,
  }
}

module.exports = {
  runRuleEngine,
  DEFAULT_RULES,
  buildDependencyGraph: dependencyAnalysis.buildDependencyGraph,
}
