/**
 * test-api.js — Quick automated tests for the backend API
 * Run with: node test-api.js
 */

const http = require('http')

const BASE = 'http://localhost:5000'
let passed = 0
let failed = 0

async function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null
    const url = new URL(BASE + path)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, body: data })
        }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

function assert(name, condition, actual) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`)
    passed++
  } else {
    console.log(`  ❌ FAIL: ${name}`)
    console.log(`     Got:`, JSON.stringify(actual))
    failed++
  }
}

async function runTests() {
  console.log('\n🧪 Smart Database Visualizer — API Tests\n')

  // ── 1. Health check ──────────────────────────────────────────────────────
  console.log('TEST 1: Health check')
  const t1 = await request('GET', '/api/health')
  assert('status 200', t1.status === 200, t1.status)
  assert('success: true', t1.body.success === true, t1.body)
  assert('has message', typeof t1.body.message === 'string', t1.body)

  // ── 2. 404 handler ───────────────────────────────────────────────────────
  console.log('\nTEST 2: 404 handler')
  const t2 = await request('GET', '/api/nonexistent')
  assert('status 404', t2.status === 404, t2.status)
  assert('success: false', t2.body.success === false, t2.body)

  // ── 3. DB test — missing required field ──────────────────────────────────
  console.log('\nTEST 3: DB test — missing required fields (Zod)')
  const t3 = await request('POST', '/api/database/test', { host: 'localhost' })
  assert('status 400', t3.status === 400, t3.status)
  assert('success: false', t3.body.success === false, t3.body)
  assert('has message', typeof t3.body.message === 'string', t3.body)

  // ── 4. DB test — invalid port number ─────────────────────────────────────
  console.log('\nTEST 4: DB test — invalid port (Zod)')
  const t4 = await request('POST', '/api/database/test', {
    host: 'localhost', port: 99999, user: 'root', password: '', database: 'test',
  })
  assert('status 400', t4.status === 400, t4.status)
  assert('port error message', t4.body.message.toLowerCase().includes('port'), t4.body)

  // ── 5. DB test — database name with special chars ─────────────────────────
  console.log('\nTEST 5: DB test — dangerous database name (Zod regex)')
  const t5 = await request('POST', '/api/database/test', {
    host: 'localhost', port: 3306, user: 'root', password: '', database: 'test;DROP TABLE x',
  })
  assert('status 400', t5.status === 400, t5.status)
  assert('regex error message', t5.body.message.toLowerCase().includes('database name'), t5.body)

  // ── 6. DB test — bad credentials (POST) ──────────────────────────────────
  console.log('\nTEST 6: DB test — bad credentials (POST)')
  const t6 = await request('POST', '/api/database/test', {
    host: 'localhost', port: 3306, user: 'wrong_user_xyz', password: 'wrong', database: 'test',
  })
  assert('status 400', t6.status === 400, t6.status)
  assert('success: false', t6.body.success === false, t6.body)
  const responseStr = JSON.stringify(t6.body)
  assert('password not in response', !responseStr.includes('wrong'), responseStr)

  // ── 6b. DB test — server check (GET) ──────────────────────────────────────
  console.log('\nTEST 6b: DB test — endpoint check (GET /api/database/test)')
  const t6b = await request('GET', '/api/database/test')
  // Should return a clean, structured JSON response (200 or 400 depending on env setup)
  assert('returns boolean success', typeof t6b.body.success === 'boolean', t6b.body)
  assert('has safe message', typeof t6b.body.message === 'string', t6b.body)
  const t6bStr = JSON.stringify(t6b.body)
  assert('no stack trace exposed', !t6bStr.includes('Error:'), t6bStr)

  // ── 7. Schema tables — no connection ─────────────────────────────────────
  console.log('\nTEST 7: Schema tables — no active connection')
  const t7 = await request('GET', '/api/schema/tables')
  assert('status 400', t7.status === 400, t7.status)
  assert('success: false', t7.body.success === false, t7.body)

  // ── 8. Schema overview — no connection ───────────────────────────────────
  console.log('\nTEST 8: Schema overview — no active connection')
  const t8 = await request('GET', '/api/schema/overview')
  assert('status 400', t8.status === 400, t8.status)
  assert('success: false', t8.body.success === false, t8.body)

  // ── 9. Table name validation in route param ───────────────────────────────
  console.log('\nTEST 9: Table name with invalid characters')
  const t9 = await request('GET', '/api/schema/tables/bad-name;DROP')
  // Either 400 (validation) or 400 (no connection) — both are correct
  assert('status 400', t9.status === 400, t9.status)
  assert('success: false', t9.body.success === false, t9.body)

  // ── 10. DB connect — missing fields ──────────────────────────────────────
  console.log('\nTEST 10: DB connect — missing fields')
  const t10 = await request('POST', '/api/database/connect', { host: 'localhost' })
  assert('status 400', t10.status === 400, t10.status)
  assert('success: false', t10.body.success === false, t10.body)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(45)}`)
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`)
  if (failed === 0) console.log('🎉 All tests passed!\n')
  else console.log('⚠️  Some tests failed — check output above.\n')
}

runTests().catch((err) => {
  console.error('Could not connect to backend. Is it running on port 5000?', err.message)
  process.exit(1)
})
