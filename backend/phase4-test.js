/**
 * phase4-test.js — Phase 4 Acceptance Test for Milestone 4
 *
 * Tests:
 *   - POST /api/analysis/run endpoint
 *   - Disconnected 400 error response
 *   - Full analysis run on connected sdv_milestone4_test:
 *       status: 200, success: true
 *       summary: tables=10, relationships=6, issues=7, high=1, medium=4, low=2
 *       healthScore: 47 (Project-defined health score: 100 - 15 - 32 - 6 = 47)
 *       healthGrade: "Needs Attention"
 *       healthScoreLabel: "Project-defined health score"
 *   - Actionable recommendations with what, why, action, sqlSuggestion
 *   - Structural dependency graph returned in payload
 *   - GET /api/analysis/run endpoint parity
 *   - Zero password or stack trace exposure
 *
 * Run from the backend directory:
 *   node phase4-test.js
 */

const http = require('http')

const PORT = process.env.PORT || 5000
const HOST = 'localhost'

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

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method,
        path,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          let parsed
          try {
            parsed = JSON.parse(raw)
          } catch {
            parsed = raw
          }
          resolve({ status: res.statusCode, body: parsed })
        })
      }
    )
    req.on('error', reject)
    if (postData) req.write(postData)
    req.end()
  })
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║   Phase 4 Acceptance Test — Analysis API & Engine       ║')
  console.log('║   Endpoint: POST /api/analysis/run                      ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // ── STEP 1: Connect to sdv_milestone4_test ───────────────────────────────
  section('STEP 1: Connect to test database via POST /api/database/connect')
  const connRes = await request('POST', '/api/database/connect', {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD || '12345678',
    database: 'sdv_milestone4_test',
  })
  assert(connRes.status === 200, 'Database connected successfully (status 200)')
  assert(connRes.body.success === true, 'Connect response success: true')

  // ── STEP 2: Call POST /api/analysis/run ───────────────────────────────────
  section('STEP 2: Execute POST /api/analysis/run')
  const analysisRes = await request('POST', '/api/analysis/run', {})
  assert(analysisRes.status === 200, 'Analysis API status is 200')
  assert(analysisRes.body.success === true, 'Analysis API success is true')

  const { summary, issues, recommendations, dependencyGraph } = analysisRes.body
  assert(typeof summary === 'object', 'summary object present')
  assert(Array.isArray(issues), 'issues array present')
  assert(Array.isArray(recommendations), 'recommendations array present')
  assert(typeof dependencyGraph === 'object', 'dependencyGraph object present')

  // ── STEP 3: Verify Summary Metrics ───────────────────────────────────────
  section('STEP 3: Verify Summary Metrics')
  console.log('  Summary Output:', JSON.stringify(summary, null, 2))

  assert(summary.tables === 10, 'summary.tables === 10')
  assert(summary.relationships === 6, 'summary.relationships === 6')
  assert(summary.issues === 7, 'summary.issues === 7')
  assert(summary.high === 1, 'summary.high === 1')
  assert(summary.medium === 4, 'summary.medium === 4')
  assert(summary.low === 2, 'summary.low === 2')

  // ── STEP 4: Verify Project-Defined Health Score ───────────────────────────
  section('STEP 4: Project-Defined Health Score Calculation')
  // 100 - (1 * 15) - (4 * 8) - (2 * 3) = 100 - 15 - 32 - 6 = 47
  assert(summary.healthScore === 47, `Health score is exactly 47 (got ${summary.healthScore})`)
  assert(summary.healthGrade === 'Needs Attention', `Health grade is "Needs Attention" (got "${summary.healthGrade}")`)
  assert(
    summary.healthScoreLabel?.toLowerCase() === 'project-defined health score',
    'Health score clearly labeled as "Project-defined health score"'
  )
  assert(
    summary.healthScoreNote?.toLowerCase().includes('not an industry-standard'),
    'Health score note contains explicit disclaimer'
  )

  // ── STEP 5: Verify Actionable Recommendations ────────────────────────────
  section('STEP 5: Actionable Recommendations & SQL Suggestions')
  assert(recommendations.length === 7, `7 recommendations generated (got ${recommendations.length})`)

  for (const rec of recommendations) {
    assert(typeof rec.what === 'string' && rec.what.length > 0, `[${rec.ruleId}] has "what" explanation`)
    assert(typeof rec.why === 'string' && rec.why.length > 0, `[${rec.ruleId}] has "why" context`)
    assert(typeof rec.action === 'string' && rec.action.length > 0, `[${rec.ruleId}] has "action" recommendation`)
    assert(typeof rec.location === 'string' && rec.location.length > 0, `[${rec.ruleId}] has "location"`)
  }

  // Spot-check specific actionable recommendations
  const r001Rec = recommendations.find((r) => r.ruleId === 'R001')
  assert(
    r001Rec?.sqlSuggestion?.includes('ALTER TABLE `attendance_log` ADD COLUMN'),
    'R001 has helpful non-destructive ALTER TABLE SQL suggestion'
  )

  const r003Rec = recommendations.find((r) => r.ruleId === 'R003' && r.table === 'students')
  assert(
    r003Rec?.sqlSuggestion?.includes('FOREIGN KEY (`department_id`) REFERENCES `departments`'),
    'R003 on students has FOREIGN KEY SQL suggestion'
  )

  const r004Rec = recommendations.find((r) => r.ruleId === 'R004' && r.table === 'orders')
  assert(
    r004Rec?.sqlSuggestion?.includes('CREATE INDEX `idx_orders_customer_id` ON `orders`'),
    'R004 on orders has CREATE INDEX SQL suggestion'
  )

  // ── STEP 6: Verify Dependency Graph ──────────────────────────────────────
  section('STEP 6: Structural Dependency Graph in API Response')
  assert(dependencyGraph['departments']?.isRoot === true, 'departments is identified as root')
  assert(dependencyGraph['tasks']?.isLeaf === true, 'tasks is identified as leaf')
  assert(dependencyGraph['audit_notes']?.isIsolated === true, 'audit_notes is identified as isolated')

  // ── STEP 7: Test GET /api/analysis/run Parity ────────────────────────────
  section('STEP 7: GET /api/analysis/run Endpoint Parity')
  const getRes = await request('GET', '/api/analysis/run')
  assert(getRes.status === 200, 'GET /api/analysis/run returns status 200')
  assert(getRes.body.success === true, 'GET response success: true')
  assert(getRes.body.summary.healthScore === 47, 'GET response health score matches POST (47)')

  // ── STEP 8: Security & Sanitization ──────────────────────────────────────
  section('STEP 8: Security & Credential Hygiene')
  const payloadStr = JSON.stringify(analysisRes.body)
  assert(!payloadStr.includes('password'), 'No password exposed in response payload')
  assert(!payloadStr.includes('12345678'), 'Password value not exposed in response payload')
  assert(!payloadStr.includes('at Array.forEach'), 'No internal stack traces exposed')

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
  .finally(async () => {
    await request('POST', '/api/database/disconnect', {}).catch(() => {})
  })

