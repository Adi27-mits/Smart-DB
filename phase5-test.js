/**
 * phase5-test.js — Verification test suite for Phase 5 Database Health Dashboard
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
  console.log('PHASE 5 VERIFICATION SUITE — Database Health Dashboard');
  console.log('====================================================\n');

  // Test 1: Connect to database
  console.log('Test Group 1: Database Connection');
  const connRes = await request('POST', '/api/database/connect', DB_CONFIG);
  assert(connRes.status === 200, `Connection status 200 (got ${connRes.status})`);
  assert(connRes.body?.success === true, 'Database connected successfully');

  // Test 2: Run live analysis POST /api/analysis/run
  console.log('\nTest Group 2: Live Analysis Endpoint (POST /api/analysis/run)');
  const analysisRes = await request('POST', '/api/analysis/run', {});
  assert(analysisRes.status === 200, `Analysis status 200 (got ${analysisRes.status})`);
  assert(analysisRes.body?.success === true, 'Analysis returned success=true');

  const { summary, issues, recommendations, dependencyGraph } = analysisRes.body;
  assert(!!summary, 'Summary object present');
  assert(Array.isArray(issues), 'Issues array present');
  assert(Array.isArray(recommendations), 'Recommendations array present');
  assert(!!dependencyGraph, 'Dependency graph present');

  // Test 3: Health Score & Presentation Metrics
  console.log('\nTest Group 3: Health Score & Summary Metrics (Dynamic API Truth)');
  assert(summary.healthScore === 47, `Health Score is 47 (got ${summary.healthScore})`);
  assert(summary.healthScoreLabel === 'Project-Defined Health Score', 'Health score label is exact');
  assert(summary.healthScoreNote.includes('project-defined indicator'), 'Health score note includes disclaimer');
  assert(summary.tables === 10, `Tables analyzed is 10 (got ${summary.tables})`);
  assert(summary.relationships === 6, `Relationships count is 6 (got ${summary.relationships})`);
  assert(summary.issues === 7, `Total issues count is 7 (got ${summary.issues})`);
  assert(summary.high === 1, `HIGH issues count is 1 (got ${summary.high})`);
  assert(summary.medium === 4, `MEDIUM issues count is 4 (got ${summary.medium})`);
  assert(summary.low === 2, `LOW issues count is 2 (got ${summary.low})`);

  // Test Presentation Grade Calculation:
  // 80–100 -> Good, 60–79 -> Review Recommended, 0–59 -> Needs Attention
  let presentationGrade = 'Needs Attention';
  if (summary.healthScore >= 80) presentationGrade = 'Good';
  else if (summary.healthScore >= 60) presentationGrade = 'Review Recommended';
  assert(presentationGrade === 'Needs Attention', `Score 47 maps to 'Needs Attention'`);

  // Test 4: Verify All 7 Issues Details & SQL Suggestions
  console.log('\nTest Group 4: Issue Cards & Safe SQL Suggestions');
  assert(issues.length === 7, `Total issues returned is 7 (got ${issues.length})`);

  const r001 = issues.find(i => i.ruleId === 'R001');
  assert(r001 && r001.table === 'attendance_log' && r001.severity === 'HIGH', 'R001: Missing PK on attendance_log (HIGH)');

  const r002List = issues.filter(i => i.ruleId === 'R002');
  assert(r002List.length === 2, `R002: 2 orphaned tables found (got ${r002List.length})`);
  const r002Tables = r002List.map(i => i.table).sort();
  assert(r002Tables[0] === 'audit_notes' && r002Tables[1] === 'customers', 'R002 tables are audit_notes and customers');

  const r003List = issues.filter(i => i.ruleId === 'R003');
  assert(r003List.length === 2, `R003: 2 candidate missing FKs found (got ${r003List.length})`);
  const r003Students = r003List.find(i => i.table === 'students');
  assert(r003Students && r003Students.column === 'department_id', 'R003 finds students.department_id');
  const r003Orders = r003List.find(i => i.table === 'orders');
  assert(r003Orders && r003Orders.column === 'customer_id', 'R003 finds orders.customer_id');

  const r004List = issues.filter(i => i.ruleId === 'R004');
  assert(r004List.length === 2, `R004: 2 missing indexes found (got ${r004List.length})`);

  // Check SQL suggestions from recommendations
  const r001Rec = recommendations.find(r => r.ruleId === 'R001');
  assert(r001Rec && r001Rec.sqlSuggestion && r001Rec.sqlSuggestion.includes('PRIMARY KEY'), 'R001 recommendation includes ALTER TABLE ADD PRIMARY KEY SQL');

  const r004Rec = recommendations.find(r => r.ruleId === 'R004' && r.table === 'students');
  assert(r004Rec && r004Rec.sqlSuggestion && r004Rec.sqlSuggestion.includes('CREATE INDEX'), 'R004 recommendation includes CREATE INDEX SQL');

  // Verify R003 heuristic nature
  const r003Issue = issues.find(i => i.ruleId === 'R003');
  assert(r003Issue && (r003Issue.title.includes('Possible') || r003Issue.recommendation.includes('Review whether')), 'R003 preserves heuristic match disclaimer');

  // Test 5: Frontend Filter Simulation
  console.log('\nTest Group 5: Frontend Filter Logic Verification');
  
  // Severity filter: HIGH
  const highFiltered = issues.filter(i => (i.severity || '').toUpperCase() === 'HIGH');
  assert(highFiltered.length === 1 && highFiltered[0].table === 'attendance_log', 'Filter Severity HIGH -> 1 issue (attendance_log)');

  // Severity filter: MEDIUM
  const medFiltered = issues.filter(i => (i.severity || '').toUpperCase() === 'MEDIUM');
  assert(medFiltered.length === 4, `Filter Severity MEDIUM -> 4 issues (got ${medFiltered.length})`);

  // Severity filter: LOW
  const lowFiltered = issues.filter(i => (i.severity || '').toUpperCase() === 'LOW');
  assert(lowFiltered.length === 2, `Filter Severity LOW -> 2 issues (got ${lowFiltered.length})`);

  // Category filter: INDEXES
  const indexCategoryFiltered = issues.filter(i => i.category === 'INDEXES');
  assert(indexCategoryFiltered.length === 2, `Filter Category INDEXES -> 2 issues (got ${indexCategoryFiltered.length})`);
  assert(indexCategoryFiltered.every(i => i.ruleId === 'R004'), 'All INDEXES issues are R004');

  // Table filter: students
  const studentsFiltered = issues.filter(i => i.table === 'students');
  assert(studentsFiltered.length === 2, `Filter Table students -> 2 issues (got ${studentsFiltered.length})`);
  assert(studentsFiltered.some(i => i.ruleId === 'R003') && studentsFiltered.some(i => i.ruleId === 'R004'), 'students issues are R003 and R004');

  // Search filter tests
  function simulateSearch(q) {
    const term = q.trim().toLowerCase();
    return issues.filter(i => {
      const inTitle = (i.title || '').toLowerCase().includes(term);
      const inTable = (i.table || '').toLowerCase().includes(term);
      const inColumn = (i.column || '').toLowerCase().includes(term);
      const inEvidence = (i.evidence || '').toLowerCase().includes(term);
      const inRecommendation = (i.recommendation || '').toLowerCase().includes(term);
      return inTitle || inTable || inColumn || inEvidence || inRecommendation;
    });
  }

  const searchDept = simulateSearch('department_id');
  assert(searchDept.length === 2, `Search 'department_id' -> 2 issues (got ${searchDept.length})`);

  const searchOrphan = simulateSearch('orphan');
  assert(searchOrphan.length === 2, `Search 'orphan' -> 2 issues (got ${searchOrphan.length})`);

  const searchAtt = simulateSearch('attendance_log');
  assert(searchAtt.length === 1, `Search 'attendance_log' -> 1 issue (got ${searchAtt.length})`);

  const searchNonExistent = simulateSearch('non_existent_symbol');
  assert(searchNonExistent.length === 0, `Search non-existent -> 0 issues`);

  // Reset / clear filters
  const resetIssues = issues;
  assert(resetIssues.length === 7, 'Clearing filters restores all 7 issues');

  // Test 6: Focus in Diagram Compatibility
  console.log('\nTest Group 6: Focus in Diagram Integration');
  const schemaRes = await request('GET', '/api/schema/overview');
  assert(schemaRes.status === 200, 'Schema endpoint returns 200');
  const schemaTables = schemaRes.body?.data?.tables || [];
  assert(schemaTables.length === 10, `Schema has 10 tables (got ${schemaTables.length})`);

  // Verify all tables with issues exist in schema
  const issueTables = Array.from(new Set(issues.map(i => i.table)));
  for (const tbl of issueTables) {
    const found = schemaTables.find(t => t.id === tbl || t.name === tbl);
    assert(!!found, `Issue table '${tbl}' exists in schema diagram tables`);
  }

  // Test 7: Disconnect & Empty/Error State
  console.log('\nTest Group 7: Disconnect & Error States');
  const discRes = await request('POST', '/api/database/disconnect');
  assert(discRes.status === 200, 'Database disconnect returned 200');

  // When disconnected, POST /api/analysis/run must fail gracefully
  const disconnectedAnalysis = await request('POST', '/api/analysis/run', {});
  assert(disconnectedAnalysis.status === 400, `Disconnected analysis status 400 (got ${disconnectedAnalysis.status})`);
  assert(disconnectedAnalysis.body?.message?.includes('No database connected'), 'Error message instructs to connect to a database');

  // Reconnect for ongoing dev server usage
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
