/**
 * phase1-test.js — Phase 1 Acceptance Test for Milestone 4
 *
 * Tests that the normalized schema from sdv_milestone4_test contains:
 *   - all 10 tables
 *   - columns, data types, nullable info
 *   - primary keys (and confirms attendance_log has NONE)
 *   - foreign keys (verifies courses→departments, enrollments→students,
 *     enrollments→courses, tasks→students)
 *   - confirms students.department_id has NO declared FK
 *   - indexes extracted from INFORMATION_SCHEMA.STATISTICS
 *   - relationships
 *
 * Run from the backend directory:
 *   node phase1-test.js
 *
 * Requires a MySQL server with sdv_milestone4_test already imported.
 * Credentials are read from environment variables (same as .env).
 */

require('dotenv').config()
const { createPool } = require('./src/config/database')
const {
  getTables,
  getTableDetails,
  getTableIndexes,
  getRelationships,
  getOverview,
} = require('./src/services/schemaService')

// ── Configuration ──────────────────────────────────────────────────────────
const DB_NAME = 'sdv_milestone4_test'

const pool = createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
})

// ── Helpers ────────────────────────────────────────────────────────────────
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

function section(title) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'─'.repeat(60)}`)
}

function assert(condition, msg) {
  if (condition) pass(msg)
  else fail(msg)
}

// ── Test Runner ────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║   Phase 1 Acceptance Test — Milestone 4                 ║')
  console.log('║   Database: sdv_milestone4_test                         ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // ── TEST 1: Table list ───────────────────────────────────────────────────
  section('TEST 1: Table List')
  const tables = await getTables(pool, DB_NAME)
  console.log(`  Tables found: ${tables.map((t) => t.name).join(', ')}`)
  assert(tables.length === 10, `Exactly 10 tables (got ${tables.length})`)

  const expectedTables = [
    'attendance_log', 'audit_notes', 'courses', 'customers',
    'departments', 'enrollments', 'order_items', 'orders',
    'students', 'tasks',
  ]
  for (const t of expectedTables) {
    assert(tables.some((r) => r.name === t), `Table "${t}" exists`)
  }

  // ── TEST 2: Columns for key tables ──────────────────────────────────────
  section('TEST 2: Columns — students')
  const studentsDetail = await getTableDetails(pool, DB_NAME, 'students')
  console.log('  Columns:', studentsDetail.columns.map((c) => `${c.name}(${c.type}${c.nullable ? ',NULL' : ',NN'})`).join(', '))
  assert(studentsDetail.columns.length === 5, `students has 5 columns (got ${studentsDetail.columns.length})`)

  const studentId = studentsDetail.columns.find((c) => c.name === 'student_id')
  assert(studentId?.primaryKey === true, 'students.student_id is PK')
  assert(studentId?.nullable === false, 'students.student_id is NOT NULL')

  const deptId = studentsDetail.columns.find((c) => c.name === 'department_id')
  assert(deptId !== undefined, 'students.department_id column exists')
  assert(deptId?.foreignKey === null, 'students.department_id has NO declared FK (intentional)')

  section('TEST 3: Columns — attendance_log')
  const attendanceDetail = await getTableDetails(pool, DB_NAME, 'attendance_log')
  console.log('  Columns:', attendanceDetail.columns.map((c) => `${c.name}(${c.type})`).join(', '))
  assert(attendanceDetail.columns.length === 4, `attendance_log has 4 columns (got ${attendanceDetail.columns.length})`)
  assert(attendanceDetail.primaryKeys.length === 0, 'attendance_log has NO primary key (intentional)')
  assert(attendanceDetail.indexes.length === 0, 'attendance_log has NO indexes')

  section('TEST 4: Columns — enrollments')
  const enrollDetail = await getTableDetails(pool, DB_NAME, 'enrollments')
  console.log('  Columns:', enrollDetail.columns.map((c) => `${c.name}(${c.type})`).join(', '))
  assert(enrollDetail.columns.length === 4, `enrollments has 4 columns (got ${enrollDetail.columns.length})`)

  const enrollStudentFk = enrollDetail.foreignKeys.find((fk) => fk.column === 'student_id')
  assert(enrollStudentFk?.references.table === 'students', 'enrollments.student_id → students')
  assert(enrollStudentFk?.references.column === 'student_id', 'enrollments.student_id → students.student_id')

  const enrollCourseFk = enrollDetail.foreignKeys.find((fk) => fk.column === 'course_id')
  assert(enrollCourseFk?.references.table === 'courses', 'enrollments.course_id → courses')
  assert(enrollCourseFk?.references.column === 'course_id', 'enrollments.course_id → courses.course_id')

  // ── TEST 5: Foreign Keys ─────────────────────────────────────────────────
  section('TEST 5: Foreign Keys — courses')
  const coursesDetail = await getTableDetails(pool, DB_NAME, 'courses')
  const courseDeptFk = coursesDetail.foreignKeys.find((fk) => fk.column === 'department_id')
  console.log('  courses FKs:', JSON.stringify(coursesDetail.foreignKeys, null, 2))
  assert(courseDeptFk?.references.table === 'departments', 'courses.department_id → departments')
  assert(courseDeptFk?.references.column === 'department_id', 'courses.department_id → departments.department_id')

  section('TEST 6: Foreign Keys — tasks')
  const tasksDetail = await getTableDetails(pool, DB_NAME, 'tasks')
  const tasksStudentFk = tasksDetail.foreignKeys.find((fk) => fk.column === 'owner_student_id')
  console.log('  tasks FKs:', JSON.stringify(tasksDetail.foreignKeys, null, 2))
  assert(tasksStudentFk?.references.table === 'students', 'tasks.owner_student_id → students')
  assert(tasksStudentFk?.references.column === 'student_id', 'tasks.owner_student_id → students.student_id')

  // ── TEST 7: Index Extraction ─────────────────────────────────────────────
  section('TEST 7: Index Extraction — departments')
  const deptIndexes = await getTableIndexes(pool, DB_NAME, 'departments')
  console.log('  departments indexes:', JSON.stringify(deptIndexes, null, 2))
  const deptPrimary = deptIndexes.find((i) => i.primary)
  assert(deptPrimary !== undefined, 'departments has a PRIMARY index')
  assert(deptPrimary?.columns.includes('department_id'), 'PRIMARY index covers department_id')
  assert(deptPrimary?.unique === true, 'PRIMARY index is unique')

  section('TEST 8: Index Extraction — students')
  const studentsIndexes = await getTableIndexes(pool, DB_NAME, 'students')
  console.log('  students indexes:', JSON.stringify(studentsIndexes, null, 2))
  const studentsPrimary = studentsIndexes.find((i) => i.primary)
  assert(studentsPrimary !== undefined, 'students has a PRIMARY index')
  const studentsDeptIdx = studentsIndexes.find((i) =>
    !i.primary && i.columns.includes('department_id')
  )
  assert(studentsDeptIdx === undefined, 'students.department_id has NO separate index (confirms R004 candidate)')

  section('TEST 9: Index Extraction — enrollments (composite unique)')
  const enrollIndexes = await getTableIndexes(pool, DB_NAME, 'enrollments')
  console.log('  enrollments indexes:', JSON.stringify(enrollIndexes, null, 2))
  const enrollUnique = enrollIndexes.find(
    (i) => i.unique && !i.primary && i.columns.includes('student_id') && i.columns.includes('course_id')
  )
  assert(enrollUnique !== undefined, 'enrollments has composite unique index on (student_id, course_id)')

  section('TEST 10: Index Extraction — orders')
  const ordersIndexes = await getTableIndexes(pool, DB_NAME, 'orders')
  console.log('  orders indexes:', JSON.stringify(ordersIndexes, null, 2))
  const ordersCustomerIdx = ordersIndexes.find((i) =>
    !i.primary && i.columns.includes('customer_id')
  )
  assert(ordersCustomerIdx === undefined, 'orders.customer_id has NO separate index (confirms R004 candidate)')

  // ── TEST 11: Relationships ───────────────────────────────────────────────
  section('TEST 11: All Relationships')
  const relationships = await getRelationships(pool, DB_NAME)
  console.log('  Relationships found:')
  for (const r of relationships) {
    console.log(`    ${r.sourceTable}.${r.sourceColumn} → ${r.targetTable}.${r.targetColumn}  [${r.constraintName}]`)
  }

  const expectedRelationships = [
    { from: 'courses.department_id', to: 'departments.department_id' },
    { from: 'enrollments.student_id', to: 'students.student_id' },
    { from: 'enrollments.course_id', to: 'courses.course_id' },
    { from: 'order_items.order_id', to: 'orders.order_id' },
    { from: 'order_items.course_id', to: 'courses.course_id' },
    { from: 'tasks.owner_student_id', to: 'students.student_id' },
  ]

  for (const er of expectedRelationships) {
    const [fromTable, fromCol] = er.from.split('.')
    const [toTable, toCol] = er.to.split('.')
    const found = relationships.find(
      (r) =>
        r.sourceTable === fromTable &&
        r.sourceColumn === fromCol &&
        r.targetTable === toTable &&
        r.targetColumn === toCol
    )
    assert(found !== undefined, `Relationship: ${er.from} → ${er.to}`)
  }

  // Confirm missing (intentional) relationships are NOT in the FK list
  const studentsDeptRel = relationships.find(
    (r) => r.sourceTable === 'students' && r.sourceColumn === 'department_id'
  )
  assert(studentsDeptRel === undefined, 'students.department_id is NOT a declared FK (intentional — will be R003)')

  const ordersCustomerRel = relationships.find(
    (r) => r.sourceTable === 'orders' && r.sourceColumn === 'customer_id'
  )
  assert(ordersCustomerRel === undefined, 'orders.customer_id is NOT a declared FK (intentional — will be R003)')

  // ── TEST 12: Full getOverview() ──────────────────────────────────────────
  section('TEST 12: Full getOverview() shape')
  const overview = await getOverview(pool, DB_NAME, 'MySQL')

  console.log(`\n  Database name : ${overview.name}`)
  console.log(`  Database type : ${overview.type}`)
  console.log(`  Tables        : ${overview.tables.length}`)
  console.log(`  Relationships : ${overview.relationships.length}`)

  assert(overview.name === DB_NAME, `Database name is "${DB_NAME}"`)
  assert(overview.type === 'MySQL', 'Database type is MySQL')
  assert(overview.tables.length === 10, '10 tables in overview')
  assert(overview.relationships.length >= 6, `At least 6 relationships (got ${overview.relationships.length})`)

  // Verify structure of a table entry in overview
  const studentsOverview = overview.tables.find((t) => t.name === 'students')
  assert(studentsOverview !== undefined, 'students table present in overview')
  assert(Array.isArray(studentsOverview?.primaryKeys), 'students.primaryKeys is an array')
  assert(Array.isArray(studentsOverview?.foreignKeys), 'students.foreignKeys is an array')
  assert(Array.isArray(studentsOverview?.indexes), 'students.indexes is an array')
  assert(Array.isArray(studentsOverview?.constraints), 'students.constraints is an array')
  // Visualization fields still present
  assert(Array.isArray(studentsOverview?.columns), 'students.columns (visualization) still present')
  assert(studentsOverview?.columns.some((c) => c.pk === true), 'students.columns[].pk still populated')

  // Verify attendance_log has no PK in overview
  const attendanceOverview = overview.tables.find((t) => t.name === 'attendance_log')
  assert(attendanceOverview?.primaryKeys?.length === 0, 'attendance_log.primaryKeys is empty')

  // ── Sample normalized JSON output ────────────────────────────────────────
  section('SAMPLE NORMALIZED JSON — students table (overview format)')
  const studentSample = overview.tables.find((t) => t.name === 'students')
  console.log(JSON.stringify(studentSample, null, 2))

  section('SAMPLE NORMALIZED JSON — attendance_log table (overview format)')
  const attendanceSample = overview.tables.find((t) => t.name === 'attendance_log')
  console.log(JSON.stringify(attendanceSample, null, 2))

  section('SAMPLE NORMALIZED JSON — enrollments table (overview format)')
  const enrollmentSample = overview.tables.find((t) => t.name === 'enrollments')
  console.log(JSON.stringify(enrollmentSample, null, 2))

  section('ALL RELATIONSHIPS')
  console.log(JSON.stringify(overview.relationships, null, 2))

  // ── Summary ──────────────────────────────────────────────────────────────
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
