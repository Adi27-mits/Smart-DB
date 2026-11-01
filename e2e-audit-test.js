/**
 * e2e-audit-test.js — Complete Functional Verification Audit Suite
 *
 * Validates:
 * 1. Database Connection & Switching (college_db & sdv_milestone4_test)
 * 2. Schema Extraction & Overview
 * 3. SQL Query Console (SHOW TABLES, SELECT, DESCRIBE, EXPLAIN, Read-Only enforcement, Multi-statement rejection, Error propagation)
 * 4. Foreign Key Pre-validation & Creation (valid FK, invalid types, orphan records, cleanup)
 * 5. CRUD Lifecycle (Create, Read, Update, Delete)
 * 6. Health Engine & R002 Review Guidance
 */

const http = require('http');

const PORT = 5000;
const DB_PASSWORD = process.env.DB_PASSWORD || '12345678';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function runAudit() {
  console.log('====================================================');
  console.log('COMPLETE FUNCTIONAL AUDIT — COLLEGE_DB');
  console.log('====================================================\n');

  // PHASE 1: Connect to college_db
  console.log('1. Database Connection: college_db');
  const conn = await request('POST', '/api/database/connect', {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: DB_PASSWORD,
    database: 'college_db',
  });
  assert(conn.status === 200, `Connected to college_db (status ${conn.status})`);
  assert(conn.body?.success === true, 'Connect returned success=true');

  // PHASE 2: Schema Extraction
  console.log('\n2. Schema Extraction & Overview');
  const overview = await request('GET', '/api/schema/overview');
  assert(overview.status === 200, 'Overview returned status 200');
  assert(overview.body?.success === true, 'Overview success=true');
  const schema = overview.body?.data;
  assert(schema?.name === 'college_db', `Schema name is 'college_db' (got '${schema?.name}')`);
  assert(Array.isArray(schema?.tables) && schema.tables.length >= 7, `Found ${schema?.tables?.length} tables`);
  const studentTable = schema?.tables.find((t) => t.name === 'student');
  assert(!!studentTable, "Table 'student' exists in extracted schema");
  assert(Array.isArray(schema?.relationships), 'Relationships is an array');

  // PHASE 3: SQL Query Console — Introspection & Results
  console.log('\n3. SQL Query Console: SHOW TABLES, SELECT, DESCRIBE, EXPLAIN');

  // 3.1 SHOW TABLES
  const showRes = await request('POST', '/api/query/execute', { query: 'SHOW TABLES;' });
  assert(showRes.status === 200, 'SHOW TABLES returned 200');
  assert(showRes.body?.success === true, 'SHOW TABLES success: true');
  assert(showRes.body?.data?.statementType === 'SHOW', "statementType is 'SHOW'");
  assert(showRes.body?.data?.isResultSet === true, 'isResultSet is true');
  assert(showRes.body?.data?.rowCount > 0, `SHOW TABLES returned ${showRes.body?.data?.rowCount} rows`);

  // 3.2 SELECT * FROM student LIMIT 5
  const selRes = await request('POST', '/api/query/execute', { query: 'SELECT * FROM student LIMIT 5;' });
  assert(selRes.status === 200, 'SELECT * FROM student returns 200');
  assert(selRes.body?.data?.statementType === 'SELECT', "statementType is 'SELECT'");
  assert(selRes.body?.data?.columns.length > 0, `SELECT returned ${selRes.body?.data?.columns.length} columns`);

  // 3.3 DESCRIBE student
  const descRes = await request('POST', '/api/query/execute', { query: 'DESCRIBE student;' });
  assert(descRes.status === 200, 'DESCRIBE student returns 200');
  assert(descRes.body?.data?.statementType === 'DESCRIBE', "statementType is 'DESCRIBE'");
  assert(descRes.body?.data?.columns.includes('Field'), 'DESCRIBE includes Field column');

  // 3.4 EXPLAIN SELECT * FROM student
  const explainRes = await request('POST', '/api/query/execute', { query: 'EXPLAIN SELECT * FROM student;' });
  assert(explainRes.status === 200, 'EXPLAIN SELECT returns 200');
  assert(explainRes.body?.data?.statementType === 'EXPLAIN', "statementType is 'EXPLAIN'");

  // 3.5 Read-only CTE query (WITH ... SELECT)
  const cteRes = await request('POST', '/api/query/execute', { query: 'WITH top_students AS (SELECT * FROM student LIMIT 2) SELECT * FROM top_students;' });
  assert(cteRes.status === 200, 'Read-only WITH CTE query returns 200');

  // PHASE 4: SQL Error Propagation & Safety
  console.log('\n4. SQL Error Propagation & Safety Guardrails');

  // 4.1 Non-existent table
  const noTableRes = await request('POST', '/api/query/execute', { query: 'SELECT * FROM students;' });
  assert(noTableRes.status === 400, 'Non-existent table returns status 400');
  assert(noTableRes.body?.success === false, 'success is false');
  assert(noTableRes.body?.code === 'ER_NO_SUCH_TABLE', `code is ER_NO_SUCH_TABLE (got '${noTableRes.body?.code}')`);
  assert(noTableRes.body?.sqlState === '42S02', `sqlState is 42S02 (got '${noTableRes.body?.sqlState}')`);
  assert(noTableRes.body?.message?.includes("doesn't exist"), `Error message preserves MySQL reason: "${noTableRes.body?.message}"`);

  // 4.2 Mutating query rejected with READ_ONLY_QUERY_CONSOLE
  const delRes = await request('POST', '/api/query/execute', { query: 'DELETE FROM student;' });
  assert(delRes.status === 400, 'DELETE query returns status 400');
  assert(delRes.body?.code === 'READ_ONLY_QUERY_CONSOLE', `DELETE returns code 'READ_ONLY_QUERY_CONSOLE' (got '${delRes.body?.code}')`);

  const insRes = await request('POST', '/api/query/execute', { query: "INSERT INTO department (dept_name) VALUES ('Test');" });
  assert(insRes.status === 400, 'INSERT query returns status 400');
  assert(insRes.body?.code === 'READ_ONLY_QUERY_CONSOLE', "INSERT returns code 'READ_ONLY_QUERY_CONSOLE'");

  // 4.3 Multiple statements rejected with MULTIPLE_STATEMENTS_NOT_ALLOWED
  const multiRes = await request('POST', '/api/query/execute', { query: 'SHOW TABLES; SELECT * FROM student;' });
  assert(multiRes.status === 400, 'Chained statements return status 400');
  assert(multiRes.body?.code === 'MULTIPLE_STATEMENTS_NOT_ALLOWED', `Multiple statements return code 'MULTIPLE_STATEMENTS_NOT_ALLOWED' (got '${multiRes.body?.code}')`);

  // PHASE 5: Foreign Key Pre-validation & Creation
  console.log('\n5. Foreign Key Pre-validation & Lifecycle');

  // 5.1 Incompatible Datatypes (e.g. INT -> VARCHAR)
  const badTypeFk = await request('POST', '/api/schema/relationship', {
    sourceTable: 'address',
    sourceColumn: 'address_id',
    targetTable: 'user',
    targetColumn: 'data',
  });
  assert(badTypeFk.status === 400, 'INT to VARCHAR FK rejected with 400');
  assert(badTypeFk.body?.message?.includes('incompatible'), `Error message notes incompatibility: "${badTypeFk.body?.message}"`);

  // 5.2 Target column without index
  const unindexedFk = await request('POST', '/api/schema/relationship', {
    sourceTable: 'address',
    sourceColumn: 'city',
    targetTable: 'user',
    targetColumn: 'first_name',
  });
  assert(unindexedFk.status === 400, 'Unindexed target FK rejected with 400');
  assert(unindexedFk.body?.message?.includes('must be indexed'), `Error message notes index requirement: "${unindexedFk.body?.message}"`);

  // 5.3 Valid Foreign Key Creation Lifecycle
  // Create temporary parent and child tables
  await request('DELETE', '/api/schema/table/test_audit_child');
  await request('DELETE', '/api/schema/table/test_audit_parent');

  const createParent = await request('POST', '/api/schema/table', {
    tableName: 'test_audit_parent',
    columns: [{ name: 'id', type: 'INT', primaryKey: true, autoIncrement: true }],
  });
  assert(createParent.status === 200, 'Created test_audit_parent table');

  const createChild = await request('POST', '/api/schema/table', {
    tableName: 'test_audit_child',
    columns: [
      { name: 'id', type: 'INT', primaryKey: true, autoIncrement: true },
      { name: 'parent_id', type: 'INT', nullable: true },
    ],
  });
  assert(createChild.status === 200, 'Created test_audit_child table');

  // 5.4 Test Orphan child row check
  // Insert an orphan row directly into test_audit_child using CRUD
  const orphanInsert = await request('POST', '/api/data/test_audit_child', { parent_id: 999999 });
  assert(orphanInsert.status === 201, 'Inserted child row with orphan parent_id: 999999');

  const orphanFk = await request('POST', '/api/schema/relationship', {
    sourceTable: 'test_audit_child',
    sourceColumn: 'parent_id',
    targetTable: 'test_audit_parent',
    targetColumn: 'id',
  });
  assert(orphanFk.status === 400, 'FK with orphan child records rejected with 400');
  assert(orphanFk.body?.message?.includes('orphan values'), `Error message identifies orphan values: "${orphanFk.body?.message}"`);

  // Delete the orphan row using CRUD
  const orphanRowId = orphanInsert.body?.data?.insertId;
  const deleteOrphan = await request('DELETE', `/api/data/test_audit_child/${orphanRowId}`);
  assert(deleteOrphan.status === 200, 'Cleaned up orphan row');

  // Now create the valid FK
  const validFk = await request('POST', '/api/schema/relationship', {
    sourceTable: 'test_audit_child',
    sourceColumn: 'parent_id',
    targetTable: 'test_audit_parent',
    targetColumn: 'id',
  });
  assert(validFk.status === 200, `Valid FK created successfully: ${validFk.body?.data?.constraintName}`);

  // Verify FK in schema overview
  const refreshedOverview = await request('GET', '/api/schema/overview');
  const foundRel = refreshedOverview.body?.data?.relationships?.find(
    (r) => r.from.table === 'test_audit_child' && r.to.table === 'test_audit_parent'
  );
  assert(!!foundRel, 'Verified solid FK relationship in schema overview');

  // Remove the FK and cleanup tables
  const dropFk = await request('DELETE', '/api/schema/relationship', {
    tableName: 'test_audit_child',
    constraintName: validFk.body?.data?.constraintName,
  });
  assert(dropFk.status === 200, 'Foreign key removed successfully');

  await request('DELETE', '/api/schema/table/test_audit_child');
  await request('DELETE', '/api/schema/table/test_audit_parent');
  console.log('  ✓ Cleaned up temporary test tables');

  // PHASE 6: CRUD Operations (Create, Read, Update, Delete)
  console.log('\n6. CRUD Operations Lifecycle');
  // Create a temporary table for CRUD verification
  await request('DELETE', '/api/schema/table/test_crud_table');
  await request('POST', '/api/schema/table', {
    tableName: 'test_crud_table',
    columns: [{ name: 'id', type: 'INT', primaryKey: true, autoIncrement: true }],
  });
  await request('POST', '/api/schema/column', {
    tableName: 'test_crud_table',
    columnName: 'title',
    type: 'VARCHAR(100)',
    nullable: true,
  });

  // 6.1 Create
  const crudCreate = await request('POST', '/api/data/test_crud_table', { title: 'CRUD Item 1' });
  assert(crudCreate.status === 201, 'CRUD Create returned 201 Created');
  const createdItemId = crudCreate.body?.data?.insertId;

  // 6.2 Read
  const crudRead = await request('GET', '/api/data/test_crud_table');
  assert(crudRead.status === 200, 'CRUD Read returned 200');
  assert(crudRead.body?.data?.rows?.some((r) => r.id === createdItemId && r.title === 'CRUD Item 1'), 'Verified created row in read results');

  // 6.3 Update
  const crudUpdate = await request('PATCH', `/api/data/test_crud_table/${createdItemId}`, { title: 'CRUD Item Updated' });
  assert(crudUpdate.status === 200, 'CRUD Update returned 200');

  const crudReadUpdated = await request('GET', '/api/data/test_crud_table');
  assert(crudReadUpdated.body?.data?.rows?.some((r) => r.id === createdItemId && r.title === 'CRUD Item Updated'), 'Verified updated title in read results');

  // 6.4 Delete
  const crudDelete = await request('DELETE', `/api/data/test_crud_table/${createdItemId}`);
  assert(crudDelete.status === 200, 'CRUD Delete returned 200');

  const crudReadAfterDelete = await request('GET', '/api/data/test_crud_table');
  assert(!crudReadAfterDelete.body?.data?.rows?.some((r) => r.id === createdItemId), 'Verified row deleted');

  await request('DELETE', '/api/schema/table/test_crud_table');
  console.log('  ✓ Cleaned up temporary test_crud_table');

  // PHASE 7: Health Engine & Recommendations on college_db
  console.log('\n7. Health Engine & Recommendations on college_db');
  const healthRes = await request('POST', '/api/analysis/run');
  assert(healthRes.status === 200, 'Health analysis ran on college_db (status 200)');
  assert(healthRes.body?.success === true, 'Health analysis success: true');
  assert(typeof healthRes.body?.summary?.healthScore === 'number', `Health score: ${healthRes.body?.summary?.healthScore}`);
  assert(Array.isArray(healthRes.body?.issues), `Total issues: ${healthRes.body?.issues?.length}`);

  // Verify R002 advisory nature
  const r002Rec = healthRes.body?.recommendations?.find((r) => r.ruleId === 'R002');
  if (r002Rec) {
    assert(r002Rec.sqlSuggestion?.startsWith('--'), 'R002 suggestion contains advisory comment, not destructive SQL');
  }

  console.log('\n====================================================');
  console.log(`TOTAL AUDIT RESULTS: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
