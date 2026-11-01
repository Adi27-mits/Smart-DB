/**
 * schemaRoutes.js — Routes for schema inspection AND editing
 *
 * READ (GET):
 *   GET /api/schema/tables              → list all tables
 *   GET /api/schema/tables/:tableName   → details for one table
 *   GET /api/schema/relationships       → all foreign-key relationships
 *   GET /api/schema/overview            → full schema (tables + relationships)
 *
 * WRITE (POST/PATCH/DELETE):
 *   POST   /api/schema/table             → create a table
 *   DELETE /api/schema/table/:tableName   → drop a table
 *   POST   /api/schema/column             → add a column
 *   PATCH  /api/schema/column             → modify a column
 *   DELETE /api/schema/column             → drop a column
 *   POST   /api/schema/relationship       → add a foreign key
 *   DELETE /api/schema/relationship       → remove a foreign key
 *
 * EXPORT:
 *   GET    /api/schema/export             → generate SQL dump of current schema
 */

const express = require('express')
const {
  getAllTables,
  getOneTable,
  getAllRelationships,
  getSchemaOverview,
} = require('../controllers/schemaController')

const {
  handleCreateTable,
  handleDropTable,
  handleAddColumn,
  handleModifyColumn,
  handleDropColumn,
  handleAddRelationship,
  handleRemoveRelationship,
} = require('../controllers/schemaEditController')

const { handleExportSQL } = require('../controllers/exportController')

const router = express.Router()

// ── Read-only schema inspection ──────────────────────────────────────────
router.get('/tables', getAllTables)
router.get('/tables/:tableName', getOneTable)
router.get('/relationships', getAllRelationships)
router.get('/overview', getSchemaOverview)

// ── Schema editing (Phase 7) ─────────────────────────────────────────────
router.post('/table', handleCreateTable)
router.delete('/table/:tableName', handleDropTable)
router.post('/column', handleAddColumn)
router.patch('/column', handleModifyColumn)
router.delete('/column', handleDropColumn)
router.post('/relationship', handleAddRelationship)
router.delete('/relationship', handleRemoveRelationship)

// ── SQL Export (Phase 8) ─────────────────────────────────────────────────
router.get('/export', handleExportSQL)

module.exports = router
