/**
 * phase6-test.js — Verification test suite for Phase 6 SQL Query Execution
 */

const http = require('http');

const BACKEND_PORT = 5000;
const DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12345678',
  database: 'sdv_milestone4_test',
  type: 'MySQL',
};

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: BACKEND_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: data ? JSON.parse(data) : null,
            });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw: data });
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

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 6 VERIFICATION SUITE — SQL Query Execution');
  console.log('====================================================\n');

  // Test Group 1: Connect to database
  console.log('Test Group 1: Database Connection');
  const connRes = await request('POST', '/api/database/connect', DB_CONFIG);
  assert(connRes.status === 200, `Connection status 200 (got ${connRes.status})`);
  assert(connRes.body?.success === true, 'Database connected successfully');

  // Test Group 2: SELECT Queries (Result Sets)
  console.log('\nTest Group 2: SELECT Queries (Result Sets)');
  
  // 2.1 Basic SELECT
  const selRes = await request('POST', '/api/query/execute', {
    query: 'SELECT * FROM students;',
  });
  assert(selRes.status === 200, `SELECT status 200 (got ${selRes.status})`);
  assert(selRes.body?.success === true, 'SELECT returns success=true');
  const selData = selRes.body?.data;
  assert(selData?.statementType === 'SELECT', `statementType is 'SELECT' (got '${selData?.statementType}')`);
  assert(selData?.isResultSet === true, 'isResultSet is true');
  assert(Array.isArray(selData?.columns), 'columns is an array');
  assert(selData?.columns?.includes('student_id'), 'columns includes student_id');
  assert(selData?.columns?.includes('full_name'), 'columns includes full_name');
  assert(selData?.columns?.includes('department_id'), 'columns includes department_id');
  assert(Array.isArray(selData?.rows) && selData?.rows?.length > 0, `rows is non-empty array (got ${selData?.rows?.length})`);
  assert(typeof selData?.executionTimeMs === 'number' && selData?.executionTimeMs >= 0, `executionTimeMs is valid (${selData?.executionTimeMs} ms)`);

  // 2.2 SELECT with Projection & LIMIT
  const projRes = await request('POST', '/api/query/execute', {
    query: 'SELECT student_id AS id, full_name AS name FROM students LIMIT 3;',
  });
  assert(projRes.status === 200, 'Projected SELECT returns 200');
  const projData = projRes.body?.data;
  assert(projData?.columns?.length === 2 && projData.columns[0] === 'id' && projData.columns[1] === 'name', 'Columns match projection aliases');
  assert(projData?.rows?.length === 3, `LIMIT 3 returned exactly 3 rows (got ${projData?.rows?.length})`);

  // 2.3 JOIN Query
  const joinRes = await request('POST', '/api/query/execute', {
    query: 'SELECT s.full_name, d.department_name FROM students s JOIN departments d ON s.department_id = d.department_id LIMIT 5;',
  });
  assert(joinRes.status === 200, 'JOIN query returns 200');
  assert(joinRes.body?.data?.columns?.includes('department_name'), 'JOIN query includes joined department_name column');

  // Test Group 3: Database Introspection Statements
  console.log('\nTest Group 3: Introspection Statements (SHOW / DESCRIBE / EXPLAIN)');

  // 3.1 SHOW TABLES
  const showRes = await request('POST', '/api/query/execute', {
    query: 'SHOW TABLES;',
  });
  assert(showRes.status === 200, 'SHOW TABLES returns 200');
  assert(showRes.body?.data?.statementType === 'SHOW', "statementType is 'SHOW'");
  assert(showRes.body?.data?.isResultSet === true, 'SHOW TABLES is a result set');
  assert(showRes.body?.data?.rowCount === 10, `SHOW TABLES returned 10 tables (got ${showRes.body?.data?.rowCount})`);

  // 3.2 DESCRIBE table
  const descRes = await request('POST', '/api/query/execute', {
    query: 'DESCRIBE attendance_log;',
  });
  assert(descRes.status === 200, 'DESCRIBE attendance_log returns 200');
  assert(descRes.body?.data?.statementType === 'DESCRIBE', "statementType is 'DESCRIBE'");
  assert(descRes.body?.data?.columns?.includes('Field') && descRes.body?.data?.columns?.includes('Type'), 'DESCRIBE columns include Field and Type');

  // 3.3 EXPLAIN query
  const explainRes = await request('POST', '/api/query/execute', {
    query: 'EXPLAIN SELECT * FROM orders WHERE customer_id = 1;',
  });
  assert(explainRes.status === 200, 'EXPLAIN query returns 200');
  assert(explainRes.body?.data?.statementType === 'EXPLAIN', "statementType is 'EXPLAIN'");
  assert(explainRes.body?.data?.columns?.includes('select_type'), 'EXPLAIN includes select_type');

  // Test Group 4: Read-Only Enforcement (INSERT, UPDATE, DELETE rejection)
  console.log('\nTest Group 4: Read-Only Safety Enforcement (Reject Mutations)');

  // 4.1 Reject INSERT
  const insertRes = await request('POST', '/api/query/execute', {
    query: `INSERT INTO tasks (owner_student_id, title, status) VALUES (1, 'Test', 'pending');`,
  });
  assert(insertRes.status === 400, 'INSERT query is rejected with 400');
  assert(insertRes.body?.code === 'READ_ONLY_QUERY_CONSOLE', "INSERT returns code 'READ_ONLY_QUERY_CONSOLE'");
  assert(insertRes.body?.message?.includes('read-only'), 'Error message states console is read-only');

  // 4.2 Reject UPDATE
  const updateRes = await request('POST', '/api/query/execute', {
    query: `UPDATE tasks SET status = 'completed' WHERE task_id = 1;`,
  });
  assert(updateRes.status === 400, 'UPDATE query is rejected with 400');
  assert(updateRes.body?.code === 'READ_ONLY_QUERY_CONSOLE', "UPDATE returns code 'READ_ONLY_QUERY_CONSOLE'");

  // 4.3 Reject DELETE
  const deleteRes = await request('POST', '/api/query/execute', {
    query: `DELETE FROM tasks WHERE task_id = 1;`,
  });
  assert(deleteRes.status === 400, 'DELETE query is rejected with 400');
  assert(deleteRes.body?.code === 'READ_ONLY_QUERY_CONSOLE', "DELETE returns code 'READ_ONLY_QUERY_CONSOLE'");

  // 4.4 Reject DDL (DROP / ALTER)
  const dropRes = await request('POST', '/api/query/execute', {
    query: `DROP TABLE imaginary_test_table;`,
  });
  assert(dropRes.status === 400, 'DROP query is rejected with 400');
  assert(dropRes.body?.code === 'READ_ONLY_QUERY_CONSOLE', "DROP returns code 'READ_ONLY_QUERY_CONSOLE'");

  // Test Group 5: Validation & Safety Restrictions
  console.log('\nTest Group 5: Validation & Safety Restrictions');

  // 5.1 Empty query
  const emptyRes = await request('POST', '/api/query/execute', {
    query: '   ',
  });
  assert(emptyRes.status === 400, `Empty query returns 400 (got ${emptyRes.status})`);
  assert(emptyRes.body?.success === false, 'Empty query returns success=false');

  // 5.2 Multi-statement rejection
  const multiRes = await request('POST', '/api/query/execute', {
    query: 'SELECT 1; DROP TABLE students;',
  });
  assert(multiRes.status === 400, `Multi-statement returns 400 (got ${multiRes.status})`);
  assert(multiRes.body?.message?.includes('multiple SQL statements'), 'Message explains multiple statements are disabled');

  // 5.3 Semicolon inside quotes (allowed single statement)
  const quoteSemiRes = await request('POST', '/api/query/execute', {
    query: "SELECT ';' AS semicolon_char;",
  });
  assert(quoteSemiRes.status === 200, 'Query with semicolon inside string literal is permitted');
  assert(quoteSemiRes.body?.data?.rows?.[0]?.semicolon_char === ';', 'Literal semicolon returned correctly');

  // 5.4 SQL Syntax Error
  const syntaxRes = await request('POST', '/api/query/execute', {
    query: 'SELECT FROM WHERE',
  });
  assert(syntaxRes.status === 400, `Syntax error returns 400 (got ${syntaxRes.status})`);
  assert(syntaxRes.body?.success === false, 'Syntax error returns success=false');
  assert(syntaxRes.body?.code?.includes('ER_PARSE_ERROR') || syntaxRes.body?.code?.includes('QUERY'), `Error code returned (${syntaxRes.body?.code})`);

  // 5.5 Non-existent table
  const noTableRes = await request('POST', '/api/query/execute', {
    query: 'SELECT * FROM imaginary_table_xyz;',
  });
  assert(noTableRes.status === 400, `Non-existent table returns 400 (got ${noTableRes.status})`);
  assert(noTableRes.body?.code === 'ER_NO_SUCH_TABLE', "Error code is ER_NO_SUCH_TABLE");

  // Test Group 6: Disconnected State Handling
  console.log('\nTest Group 6: Disconnected State');
  await request('POST', '/api/database/disconnect');

  const discExecRes = await request('POST', '/api/query/execute', {
    query: 'SELECT 1;',
  });
  assert(discExecRes.status === 400, `Disconnected execution returns 400 (got ${discExecRes.status})`);
  assert(discExecRes.body?.code === 'NO_DATABASE_CONNECTED', 'Error code is NO_DATABASE_CONNECTED');
  assert(discExecRes.body?.message?.includes('No database connected'), 'Instructs user to connect database');

  // Reconnect for ongoing environment usage
  await request('POST', '/api/database/connect', DB_CONFIG);

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
