/**
 * phase2-test.js — Phase 2 Acceptance Test for Milestone 4
 *
 * Tests the Rule Engine Architecture and Rules R001 & R002:
 *   - R001: Missing Primary Key (detects attendance_log)
 *   - R002: Potential Orphaned Table (detects audit_notes, customers)
 *   - Verifies tables with valid relationships are NOT flagged as orphaned
 *   - Verifies standard issue shape and summary counts:
 *       tablesAnalyzed: 10, issuesFound: 3, high: 1, medium: 2, low: 0
 *
 * Run from the backend directory:
 *   node phase2-test.js
 */

require('dotenv').config()
const { createPool } = require('./src/config/database')
const { getOverview } = require('./src/services/schemaService')
const { runRuleEngine } = require('./src/services/analysis/ruleEngine')
const missingPrimaryKey = require('./src/services/analysis/rules/missingPrimaryKey')
const orphanedTable = require('./src/services/analysis/rules/orphanedTable')

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
  console.log('║   Phase 2 Acceptance Test — Rule Engine & R001 / R002   ║')
  console.log('║   Database: sdv_milestone4_test                         ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // ── STEP 1: Extract normalized schema ────────────────────────────────────
  section('STEP 1: Extract normalized schema from live database')
  const schema = await getOverview(pool, DB_NAME, 'MySQL')
  assert(schema && schema.tables && schema.tables.length === 10, 'Extracted schema with 10 tables')

  // ── STEP 2: Test Rule R001 independently ─────────────────────────────────
  section('STEP 2: Independent Rule Test — R001 (Missing Primary Key)')
  const r001Issues = missingPrimaryKey.analyze(schema)
  console.log('  R001 Output:', JSON.stringify(r001Issues, null, 2))

  assert(r001Issues.length === 1, `Exactly 1 table missing primary key (got ${r001Issues.length})`)
  const attendanceIssue = r001Issues.find((i) => i.table === 'attendance_log')
  assert(attendanceIssue !== undefined, 'attendance_log detected by R001')
  assert(attendanceIssue?.severity === 'HIGH', 'R001 severity is HIGH')
  assert(attendanceIssue?.category === 'KEYS', 'R001 category is KEYS')
  assert(attendanceIssue?.ruleId === 'R001', 'R001 ruleId is "R001"')
  assert(attendanceIssue?.title === 'Missing Primary Key', 'R001 title is "Missing Primary Key"')
  assert(typeof attendanceIssue?.recommendation === 'string', 'R001 has recommendation')

  // ── STEP 3: Test Rule R002 independently ─────────────────────────────────
  section('STEP 3: Independent Rule Test — R002 (Potential Orphaned Table)')
  const r002Issues = orphanedTable.analyze(schema)
  console.log('  R002 Output:', JSON.stringify(r002Issues, null, 2))

  assert(r002Issues.length === 2, `Exactly 2 orphaned tables detected (got ${r002Issues.length})`)
  
  const auditNotesIssue = r002Issues.find((i) => i.table === 'audit_notes')
  assert(auditNotesIssue !== undefined, 'audit_notes detected by R002')
  assert(auditNotesIssue?.severity === 'MEDIUM', 'audit_notes severity is MEDIUM')
  assert(auditNotesIssue?.category === 'RELATIONSHIPS', 'audit_notes category is RELATIONSHIPS')
  assert(auditNotesIssue?.ruleId === 'R002', 'audit_notes ruleId is "R002"')

  const customersIssue = r002Issues.find((i) => i.table === 'customers')
  assert(customersIssue !== undefined, 'customers detected by R002')
  assert(customersIssue?.severity === 'MEDIUM', 'customers severity is MEDIUM')
  assert(customersIssue?.category === 'RELATIONSHIPS', 'customers category is RELATIONSHIPS')

  // Verify non-orphaned tables with valid relationships
  const connectedTables = [
    'departments', 'courses', 'students', 'enrollments',
    'orders', 'order_items', 'tasks',
  ]
  for (const t of connectedTables) {
    const isOrphaned = r002Issues.some((i) => i.table === t)
    assert(!isOrphaned, `Connected table '${t}' is NOT reported as orphaned`)
  }

  // ── STEP 4: Test Rule Engine Orchestrator ────────────────────────────────
  section('STEP 4: Rule Engine Execution & Summary Aggregation')
  const result = runRuleEngine(schema, { rules: [missingPrimaryKey, orphanedTable] })
  console.log('  Rule Engine Result Summary:', JSON.stringify(result.summary, null, 2))
  console.log('  Rule Engine Issues Count:', result.issues.length)

  assert(result.summary.tablesAnalyzed === 10, 'Summary tablesAnalyzed === 10')
  assert(result.summary.issuesFound === 3, 'Summary issuesFound === 3')
  assert(result.summary.high === 1, 'Summary high === 1')
  assert(result.summary.medium === 2, 'Summary medium === 2')
  assert(result.summary.low === 0, 'Summary low === 0')

  // Verify issue schema consistency
  for (const issue of result.issues) {
    assert(typeof issue.ruleId === 'string' && issue.ruleId.length > 0, `Issue has valid ruleId (${issue.ruleId})`)
    assert(typeof issue.category === 'string', `Issue ${issue.ruleId} has valid category`)
    assert(['HIGH', 'MEDIUM', 'LOW'].includes(issue.severity), `Issue ${issue.ruleId} has valid severity (${issue.severity})`)
    assert(typeof issue.table === 'string' && issue.table.length > 0, `Issue ${issue.ruleId} has valid table (${issue.table})`)
    assert(typeof issue.title === 'string', `Issue ${issue.ruleId} has valid title`)
    assert(typeof issue.evidence === 'string', `Issue ${issue.ruleId} has evidence`)
    assert(typeof issue.recommendation === 'string', `Issue ${issue.ruleId} has recommendation`)
  }

  section('FULL RULE ENGINE OUTPUT JSON')
  console.log(JSON.stringify(result, null, 2))

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
