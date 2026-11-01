/**
 * recommendationBuilder.js — Milestone 4 Recommendation Engine
 *
 * Processes detected issues and schema metadata into clear, actionable
 * developer recommendations.
 *
 * Each recommendation explains:
 *   - What was detected
 *   - Where it was detected
 *   - Why it matters (impact on integrity, performance, maintenance)
 *   - What the developer should review or change (with non-destructive SQL suggestions)
 *
 * Also computes the optional Project-Defined Database Health Score:
 *   Start = 100
 *   HIGH penalty   = -15
 *   MEDIUM penalty = -8
 *   LOW penalty    = -3
 *   Minimum = 0
 *   Clearly labeled: "Project-defined health score"
 */

/**
 * Calculates the project-defined database health score.
 *
 * @param {{ high: number, medium: number, low: number }} counts
 * @returns {{ score: number, grade: string, label: string, note: string }}
 */
function calculateHealthScore(counts) {
  const high = counts.high || 0
  const medium = counts.medium || 0
  const low = counts.low || 0

  const penalties = (high * 15) + (medium * 8) + (low * 3)
  const score = Math.max(0, 100 - penalties)

  let grade = 'Excellent'
  if (score < 50) {
    grade = 'Needs Attention'
  } else if (score < 75) {
    grade = 'Fair'
  } else if (score < 90) {
    grade = 'Good'
  }

  return {
    score,
    grade,
    label: 'Project-Defined Health Score',
    note: 'This is a project-defined indicator and not an industry-standard database health score.',
  }
}

/**
 * Generates an actionable recommendation for an individual issue.
 *
 * @param {object} issue - Standard issue from rule engine
 * @returns {object} Actionable recommendation item
 */
function buildRecommendation(issue) {
  const { ruleId, table, column, severity, title } = issue
  const location = column ? `${table}.${column}` : table

  let what = title
  let why = ''
  let action = issue.recommendation || ''
  let sqlSuggestion = null

  switch (ruleId) {
    case 'R001':
      what = `Table '${table}' lacks a primary key constraint.`
      why =
        'Primary keys are fundamental to relational database integrity (1NF). Without a primary key, individual rows cannot be uniquely identified, UPDATE/DELETE operations risk affecting unintended records, and other tables cannot establish foreign keys referencing this table.'
      action = `Define an appropriate primary key on table '${table}'. If an existing column or combination of columns is unique, designate it as primary key; otherwise, add a surrogate auto-incrementing ID column.`
      sqlSuggestion = `ALTER TABLE \`${table}\` ADD COLUMN \`id\` INT PRIMARY KEY AUTO_INCREMENT FIRST;`
      break

    case 'R002':
      what = `Table '${table}' is completely disconnected from the foreign key relationship graph.`
      why =
        'Orphaned tables may indicate incomplete schema design, forgotten migration steps, or missing foreign keys. Note: Some tables (such as configuration, lookup, or standalone audit logs) may be intentionally independent.'
      action = `Review whether '${table}' is intentionally standalone or whether foreign key constraints should link it to related entities (e.g. check for matching entity IDs in other tables).`
      sqlSuggestion = `-- Review business requirements for '${table}' before declaring foreign keys.`
      break

    case 'R003':
      what = `Column '${location}' appears to reference an entity (${issue.candidateReference || 'target entity'}) but lacks a declared foreign key.`
      why =
        'Without a declared foreign key constraint, the database engine cannot enforce referential integrity. Orphaned records can be created if parent records are deleted, and application-level joins may encounter inconsistent data.'
      action = `Review whether '${location}' should formally reference '${issue.candidateReference}'. If valid, clean up any existing orphaned values and declare a FOREIGN KEY constraint.`
      if (issue.candidateTargetTable && issue.candidateTargetColumn) {
        const constraintName = `fk_${table}_${column}_${issue.candidateTargetTable}`
        sqlSuggestion = `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraintName}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${issue.candidateTargetTable}\` (\`${issue.candidateTargetColumn}\`) ON DELETE RESTRICT ON UPDATE CASCADE;`
      }
      break

    case 'R004':
      what = `Relationship or join column '${location}' has no supporting index.`
      why =
        'Database joins and filter queries on unindexed foreign-key or relationship columns require full-table scans. Adding a secondary index can significantly speed up JOIN, WHERE, and ORDER BY queries on this column as the dataset grows.'
      action = `Review query patterns for '${location}'. If this column is frequently joined or filtered, create a secondary index.`
      sqlSuggestion = `CREATE INDEX \`idx_${table}_${column}\` ON \`${table}\` (\`${column}\`);`
      break

    case 'R005':
      what = issue.title || `Structural dependency concern on '${table}'.`
      why =
        'Complex dependency structures can cause deadlocks, cascade deletion bottlenecks, or circular locks during data migrations.'
      action = issue.recommendation || `Review dependency paths involving table '${table}'.`
      sqlSuggestion = null
      break

    default:
      what = issue.title || `Issue detected on ${location}.`
      why = issue.evidence || 'Identified by rule-based analysis.'
      action = issue.recommendation || 'Review database design.'
      break
  }

  return {
    ruleId,
    severity,
    table,
    column: column || null,
    location,
    title,
    what,
    why,
    action,
    sqlSuggestion,
  }
}

/**
 * Builds the complete recommendations payload from issues and summary.
 *
 * @param {Array<object>} issues
 * @param {object} summary
 * @param {object} [dependencyGraph]
 * @returns {object}
 */
function buildAnalysisReport(issues, summary, dependencyGraph = null) {
  const recommendations = (issues || []).map(buildRecommendation)
  const health = calculateHealthScore(summary || {})

  return {
    healthScore: health.score,
    healthGrade: health.grade,
    healthScoreLabel: health.label,
    healthScoreNote: health.note,
    recommendations,
    dependencyGraph: dependencyGraph || undefined,
  }
}

module.exports = {
  calculateHealthScore,
  buildRecommendation,
  buildAnalysisReport,
}
