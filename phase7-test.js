/**
 * phase7-test.js — Verification test suite for Phase 7 CRUD Interface
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
  console.log('PHASE 7 VERIFICATION SUITE — CRUD Interface & APIs');
  console.log('====================================================\n');

  // Test Group 1: Connect to database
  console.log('Test Group 1: Database Connection');
  const connRes = await request('POST', '/api/database/connect', DB_CONFIG);
  assert(connRes.status === 200, `Connection status 200 (got ${connRes.status})`);
  assert(connRes.body?.success === true, 'Database connected successfully');

  // Test Group 2: Table Metadata
  console.log('\nTest Group 2: Table Metadata & Schema Introspection for CRUD');
  const metaRes = await request('GET', '/api/data/tasks/metadata');
  assert(metaRes.status === 200, `Metadata status 200 (got ${metaRes.status})`);
  assert(metaRes.body?.success === true, 'Metadata returned success=true');
  const metaData = metaRes.body?.data;
  assert(metaData?.tableName === 'tasks', "tableName is 'tasks'");
  assert(Array.isArray(metaData?.primaryKeys) && metaData.primaryKeys.includes('task_id'), 'primaryKeys includes task_id');
  assert(Array.isArray(metaData?.columns) && metaData.columns.some(c => c.name === 'title'), 'columns contains title');
  const taskIdCol = metaData?.columns?.find(c => c.name === 'task_id');
  assert(taskIdCol?.autoIncrement === true || taskIdCol?.extra?.toLowerCase().includes('auto_increment'), 'task_id identified as auto_increment');

  // Test Group 3: Read Records (GET /api/data/:tableName)
  console.log('\nTest Group 3: Read Records (Paginated)');
  const readRes = await request('GET', '/api/data/tasks?limit=10&offset=0');
  assert(readRes.status === 200, `Read status 200 (got ${readRes.status})`);
  assert(readRes.body?.success === true, 'Read returned success=true');
  assert(Array.isArray(readRes.body?.data?.rows), 'rows is an array');
  assert(typeof readRes.body?.data?.totalCount === 'number', `totalCount is a number (${readRes.body?.data?.totalCount})`);
  assert(readRes.body?.data?.primaryKeys?.includes('task_id'), 'Read response includes primaryKeys');

  // Test Group 4: Full CRUD Cycle on `tasks` (C-R-U-D)
  console.log('\nTest Group 4: Full CRUD Lifecycle on `tasks` Table');

  // 4.1 CREATE: Insert new task row
  const testTitle = `SDV Phase 7 Test Task ${Date.now()}`;
  const insertRes = await request('POST', '/api/data/tasks', {
    data: {
      owner_student_id: 1,
      title: testTitle,
      status: 'pending',
    },
  });
  assert(insertRes.status === 201, `Insert status 201 Created (got ${insertRes.status})`);
  assert(insertRes.body?.success === true, 'Insert returned success=true');
  const createdId = insertRes.body?.data?.insertId;
  assert(typeof createdId === 'number' && createdId > 0, `Record created with insertId: ${createdId}`);

  // 4.2 READ: Verify created record
  const verifyCreateRes = await request('GET', '/api/data/tasks?limit=50');
  assert(verifyCreateRes.status === 200, 'Verify read status 200');
  const createdRow = verifyCreateRes.body?.data?.rows?.find(r => r.task_id === createdId);
  assert(!!createdRow, `Found newly created task with id ${createdId}`);
  assert(createdRow?.title === testTitle, 'Task title matches input');
  assert(createdRow?.status === 'pending', 'Task status is "pending"');

  // 4.3 UPDATE: Update row with explicit criteria
  const updateCriteriaRes = await request('PUT', '/api/data/tasks', {
    criteria: { task_id: createdId },
    data: { status: 'in_progress' },
  });
  assert(updateCriteriaRes.status === 200, `Update with criteria status 200 (got ${updateCriteriaRes.status})`);
  assert(updateCriteriaRes.body?.data?.affectedRows === 1, 'Update affected 1 row');

  // 4.4 UPDATE BY ID: Update row via PUT /api/data/tasks/:id
  const updateByIdRes = await request('PUT', `/api/data/tasks/${createdId}`, {
    data: { status: 'completed' },
  });
  assert(updateByIdRes.status === 200, `Update by ID status 200 (got ${updateByIdRes.status})`);
  assert(updateByIdRes.body?.data?.affectedRows === 1, 'Update by ID affected 1 row');

  // Verify updated status in database
  const verifyUpdateRes = await request('GET', '/api/data/tasks?limit=50');
  const updatedRow = verifyUpdateRes.body?.data?.rows?.find(r => r.task_id === createdId);
  assert(updatedRow?.status === 'completed', 'Task status successfully updated to "completed"');

  // 4.5 DELETE: Delete row via DELETE /api/data/tasks/:id
  const deleteByIdRes = await request('DELETE', `/api/data/tasks/${createdId}`);
  assert(deleteByIdRes.status === 200, `Delete by ID status 200 (got ${deleteByIdRes.status})`);
  assert(deleteByIdRes.body?.data?.affectedRows === 1, 'Delete affected 1 row');

  // Verify deleted row no longer exists
  const verifyDeleteRes = await request('GET', '/api/data/tasks?limit=50');
  const deletedRow = verifyDeleteRes.body?.data?.rows?.find(r => r.task_id === createdId);
  assert(!deletedRow, 'Deleted task is no longer present in tasks table');

  // Test Group 5: Safety Restrictions & Error Handling
  console.log('\nTest Group 5: Safety Restrictions & Error Handling');

  // 5.1 UPDATE without criteria rejected to protect table
  const noCriteriaUpdate = await request('PUT', '/api/data/tasks', {
    criteria: {},
    data: { status: 'hacked' },
  });
  assert(noCriteriaUpdate.status === 400, `Update without criteria rejected with 400 (got ${noCriteriaUpdate.status})`);
  assert(noCriteriaUpdate.body?.code === 'CRITERIA_REQUIRED', 'Error code is CRITERIA_REQUIRED');

  // 5.2 DELETE without criteria rejected to protect table
  const noCriteriaDelete = await request('DELETE', '/api/data/tasks', {
    criteria: {},
  });
  assert(noCriteriaDelete.status === 400, `Delete without criteria rejected with 400 (got ${noCriteriaDelete.status})`);
  assert(noCriteriaDelete.body?.code === 'CRITERIA_REQUIRED', 'Error code is CRITERIA_REQUIRED');

  // 5.3 Foreign Key violation error handling
  const fkViolationRes = await request('POST', '/api/data/tasks', {
    data: {
      owner_student_id: 999999, // non-existent student FK
      title: 'FK Violation Test',
      status: 'pending',
    },
  });
  assert(fkViolationRes.status === 400, `FK violation rejected with 400 (got ${fkViolationRes.status})`);
  assert(fkViolationRes.body?.code?.includes('ER_NO_REFERENCED_ROW') || fkViolationRes.body?.code?.includes('INSERT'), 'Foreign key constraint violation caught cleanly');

  // 5.4 Invalid table name injection rejected
  const invalidTableRes = await request('GET', '/api/data/tasks;DROP_TABLE');
  assert(invalidTableRes.status === 400, `Invalid table name rejected with 400 (got ${invalidTableRes.status})`);

  // Test Group 6: Disconnected State
  console.log('\nTest Group 6: Disconnected State');
  await request('POST', '/api/database/disconnect');

  const discRes = await request('GET', '/api/data/tasks');
  assert(discRes.status === 400, `Disconnected read returns 400 (got ${discRes.status})`);
  assert(discRes.body?.code === 'NO_DATABASE_CONNECTED', 'Error code is NO_DATABASE_CONNECTED');

  // Reconnect database for ongoing dev server usage
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
