/**
 * analysisService.js — Core service for schema analysis & health evaluation
 *
 * Flow:
 *   Normalized Schema (schemaService)
 *       ↓
 *   Rule Engine (ruleEngine) — R001 to R005
 *       ↓
 *   Recommendation Builder & Health Score (recommendationBuilder)
 *       ↓
 *   Analysis Output Payload
 */

const { getOverview } = require('./schemaService')
const { runRuleEngine, buildDependencyGraph } = require('./analysis/ruleEngine')
const { buildAnalysisReport } = require('./analysis/recommendationBuilder')

/**
 * Runs full rule-based analysis on the currently connected database.
 *
 * @param {import('mysql2/promise').Pool} pool - Active database connection pool
 * @param {string} dbName - Database name
 * @param {string} [dbType='MySQL'] - Database engine type
 * @returns {Promise<{
 *   success: boolean,
 *   summary: object,
 *   issues: Array<object>,
 *   recommendations: Array<object>,
 *   dependencyGraph: object
 * }>}
 */
async function runDatabaseAnalysis(pool, dbName, dbType = 'MySQL') {
  // 1. Fetch current normalized schema
  const schema = await getOverview(pool, dbName, dbType)

  // 2. Run rule engine (R001 - R005)
  const engineResult = runRuleEngine(schema)

  // 3. Compute structural dependency graph
  const dependencyGraph = buildDependencyGraph(schema)

  // 4. Generate recommendations & project-defined health score
  const report = buildAnalysisReport(engineResult.issues, engineResult.summary, dependencyGraph)

  // 5. Build clean, structured output
  return {
    success: true,
    summary: {
      tables: schema.tables?.length || 0,
      relationships: schema.relationships?.length || 0,
      issues: engineResult.summary.issuesFound,
      high: engineResult.summary.high,
      medium: engineResult.summary.medium,
      low: engineResult.summary.low,
      healthScore: report.healthScore,
      healthGrade: report.healthGrade,
      healthScoreLabel: report.healthScoreLabel,
      healthScoreNote: report.healthScoreNote,
    },
    issues: engineResult.issues,
    recommendations: report.recommendations,
    dependencyGraph: report.dependencyGraph,
  }
}

module.exports = {
  runDatabaseAnalysis,
}
