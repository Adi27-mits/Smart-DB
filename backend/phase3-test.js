/**
 * phase3-test.js — Phase 3 Acceptance Test for Milestone 4
 *
 * Tests:
 *   - Rule R003: Possible Missing Foreign Key (students.department_id, orders.customer_id)
 *   - Rule R004: Index Review Recommended (students.department_id, orders.customer_id)
 *   - Rule R005: Structural Dependency Analysis (DAG, roots, leaves, isolated, chains, cycles)
 *   - Full Rule Engine with all 5 rules (R001 - R005) against sdv_milestone4_test:
 *       tablesAnalyzed: 10
 *       issuesFound: 7
 *       high: 1 (attendance_log)
 *       medium: 4 (audit_notes, customers, students.department_id, orders.customer_id)
 *       low: 2 (students.department_id, orders.customer_id)
 *
 * Run from the backend directory:
 *   node phase3-test.js
 */

require('dotenv').config()
const { createPool } = require('./src/config/database')
const { getOverview } = require('./src/services/schemaService')
const { runRuleEngine } = require('./src/services/analysis/ruleEngine')
const possibleMissingForeignKey = require('./src/services/analysis/rules/possibleMissingForeignKey')
const missingIndex = require('./src/services/analysis/rules/missingIndex')
const dependencyAnalysis = require('./src/services/analysis/rules/dependencyAnalysis')

const DB_NAME = 'sdv_milestone4_test'

const pool = createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
})

let passed = 0
let failed = 0

function pass(msg) {
  console.log(`  ✅ PASS: ${msg}`)
  passed++
}

function fail(msg) {
  console.error(`  ❌ FAIL: ${msg}`)
  failed++
}

function assert(condition, msg) {
  if (condition) pass(msg)
  else fail(msg)
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'─'.repeat(60)}`)
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║   Phase 3 Acceptance Test — Rules R003, R004 & R005     ║')
  console.log('║   Database: sdv_milestone4_test                         ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // ── STEP 1: Extract normalized schema ────────────────────────────────────
  section('STEP 1: Extract normalized schema from live database')
  const schema = await getOverview(pool, DB_NAME, 'MySQL')
  assert(schema && schema.tables && schema.tables.length === 10, 'Extracted schema with 10 tables')

  // ── STEP 2: Test Rule R003 (Possible Missing Foreign Key) ────────────────
  section('STEP 2: Independent Rule Test — R003 (Possible Missing Foreign Key)')
  const r003Issues = possibleMissingForeignKey.analyze(schema)
  console.log('  R003 Issues Output:', JSON.stringify(r003Issues, null, 2))

  assert(r003Issues.length === 2, `Exactly 2 possible missing foreign keys detected (got ${r003Issues.length})`)

  // Check students.department_id
  const studentDeptIssue = r003Issues.find(
    (i) => i.table === 'students' && i.column === 'department_id'
  )
  assert(studentDeptIssue !== undefined, 'students.department_id detected by R003')
  assert(studentDeptIssue?.title === 'Possible Missing Foreign Key', 'Title is "Possible Missing Foreign Key" (cautious)')
  assert(studentDeptIssue?.severity === 'MEDIUM', 'Severity is MEDIUM')
  assert(studentDeptIssue?.candidateReference === 'departments.department_id', 'Candidate is departments.department_id')

  // Check orders.customer_id
  const orderCustomerIssue = r003Issues.find(
    (i) => i.table === 'orders' && i.column === 'customer_id'
  )
  assert(orderCustomerIssue !== undefined, 'orders.customer_id detected by R003')
  assert(orderCustomerIssue?.title === 'Possible Missing Foreign Key', 'Title is "Possible Missing Foreign Key"')
  assert(orderCustomerIssue?.severity === 'MEDIUM', 'Severity is MEDIUM')
  assert(orderCustomerIssue?.candidateReference === 'customers.customer_id', 'Candidate is customers.customer_id')

  // Verify declared FKs are NOT flagged
  const falsePositives = ['courses', 'enrollments', 'order_items', 'tasks']
  for (const t of falsePositives) {
    const hasFp = r003Issues.some((i) => i.table === t)
    assert(!hasFp, `Declared FK table '${t}' has no false positive missing FKs`)
  }

  // ── STEP 3: Test Rule R004 (Index Review Recommended) ────────────────────
  section('STEP 3: Independent Rule Test — R004 (Index Review Recommended)')
  const r004Issues = missingIndex.analyze(schema)
  console.log('  R004 Issues Output:', JSON.stringify(r004Issues, null, 2))

  assert(r004Issues.length === 2, `Exactly 2 unindexed join columns detected (got ${r004Issues.length})`)

  const studentIdxIssue = r004Issues.find(
    (i) => i.table === 'students' && i.column === 'department_id'
  )
  assert(studentIdxIssue !== undefined, 'students.department_id detected by R004')
  assert(studentIdxIssue?.severity === 'LOW', 'R004 severity is LOW')
  assert(studentIdxIssue?.title === 'Index Review Recommended', 'Title is "Index Review Recommended"')

  const orderIdxIssue = r004Issues.find(
    (i) => i.table === 'orders' && i.column === 'customer_id'
  )
  assert(orderIdxIssue !== undefined, 'orders.customer_id detected by R004')
  assert(orderIdxIssue?.severity === 'LOW', 'R004 severity is LOW')
  assert(orderIdxIssue?.title === 'Index Review Recommended', 'Title is "Index Review Recommended"')

  // ── STEP 4: Test Rule R005 (Structural Dependency Analysis) ──────────────
  section('STEP 4: Structural Dependency Analysis — Graph & Metrics')
  const depGraph = dependencyAnalysis.buildDependencyGraph(schema)
  console.log('  Dependency Graph Sample (courses):', JSON.stringify(depGraph['courses'], null, 2))
  console.log('  Dependency Graph Sample (departments):', JSON.stringify(depGraph['departments'], null, 2))

  // Root table check (departments is referenced by courses, references nothing)
  assert(depGraph['departments'].isRoot === true, 'departments is correctly identified as a ROOT table')
  assert(depGraph['departments'].referencingTables.includes('courses'), 'departments is referenced by courses')

  // Leaf tables check (tasks has outgoing FK to students, no incoming FKs)
  assert(depGraph['tasks'].isLeaf === true, 'tasks is correctly identified as a LEAF table')
  assert(depGraph['tasks'].referencedTables.includes('students'), 'tasks references students')

  // Isolated tables check
  assert(depGraph['audit_notes'].isIsolated === true, 'audit_notes is correctly identified as an ISOLATED table')

  // Dependency chains check
  assert(depGraph['enrollments'].depth === 2, `enrollments dependency depth is 2 (got ${depGraph['enrollments'].depth})`)
  assert(
    depGraph['enrollments'].dependencyChain[0] === 'enrollments' &&
    depGraph['enrollments'].dependencyChain[1] === 'courses' &&
    depGraph['enrollments'].dependencyChain[2] === 'departments',
    'enrollments chain traces: enrollments → courses → departments'
  )

  // Cycle detection
  const cycles = dependencyAnalysis.findCycles(depGraph)
  assert(cycles.length === 0, 'No circular dependencies detected in test schema')

  const r005Issues = dependencyAnalysis.analyze(schema)
  assert(r005Issues.length === 0, 'Healthy DAG produces no structural errors (R005)')

  // ── STEP 5: Test Full Rule Engine with ALL 5 Rules ───────────────────────
  section('STEP 5: Full Rule Engine Execution (R001 - R005)')
  const fullResult = runRuleEngine(schema)
  console.log('  Full Rule Engine Summary:', JSON.stringify(fullResult.summary, null, 2))
  console.log('\n  All Detected Issues:')
  for (const issue of fullResult.issues) {
    console.log(`    [${issue.severity.padEnd(6)}] ${issue.ruleId}: ${issue.title} on ${issue.table}${issue.column ? '.' + issue.column : ''}`)
  }

  // Verify full summary metrics matching sdv_milestone4_expected_findings.json
  assert(fullResult.summary.tablesAnalyzed === 10, 'tablesAnalyzed === 10')
  assert(fullResult.summary.issuesFound === 7, `issuesFound === 7 (got ${fullResult.summary.issuesFound})`)
  assert(fullResult.summary.high === 1, `high === 1 (got ${fullResult.summary.high})`)
  assert(fullResult.summary.medium === 4, `medium === 4 (got ${fullResult.summary.medium})`)
  assert(fullResult.summary.low === 2, `low === 2 (got ${fullResult.summary.low})`)

  // Verify all 7 expected findings are present
  const expectedFindings = [
    { ruleId: 'R001', table: 'attendance_log', severity: 'HIGH' },
    { ruleId: 'R002', table: 'audit_notes', severity: 'MEDIUM' },
    { ruleId: 'R002', table: 'customers', severity: 'MEDIUM' },
    { ruleId: 'R003', table: 'students', column: 'department_id', severity: 'MEDIUM' },
    { ruleId: 'R003', table: 'orders', column: 'customer_id', severity: 'MEDIUM' },
    { ruleId: 'R004', table: 'students', column: 'department_id', severity: 'LOW' },
    { ruleId: 'R004', table: 'orders', column: 'customer_id', severity: 'LOW' },
  ]

  for (const ef of expectedFindings) {
    const match = fullResult.issues.find(
      (i) =>
        i.ruleId === ef.ruleId &&
        i.table === ef.table &&
        (!ef.column || i.column === ef.column) &&
        i.severity === ef.severity
    )
    assert(match !== undefined, `Verified intentional finding: ${ef.ruleId} on ${ef.table}${ef.column ? '.' + ef.column : ''} (${ef.severity})`)
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log(`║  Results: ${passed} passed, ${failed} failed                           ║`)
  console.log('╚══════════════════════════════════════════════════════════╝\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()
  .catch((err) => {
    console.error('\n💥 Test runner crashed:', err.message)
    process.exit(1)
  })
  .finally(() => {
    pool.end()
  })
