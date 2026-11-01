/**
 * dataRoutes.js — Routes for CRUD operations on table records
 */

const express = require('express')
const {
  handleGetData,
  handleGetMetadata,
  handleInsertRow,
  handleUpdateRow,
  handleDeleteRow,
  handleUpdateRowById,
  handleDeleteRowById,
} = require('../controllers/dataController')

const router = express.Router()

// Metadata inspection
router.get('/:tableName/metadata', handleGetMetadata)

// Read rows
router.get('/:tableName', handleGetData)

// Create row
router.post('/:tableName', handleInsertRow)

// Update row (with criteria in body or by single PK :id)
router.put('/:tableName/:id', handleUpdateRowById)
router.put('/:tableName', handleUpdateRow)
router.patch('/:tableName/:id', handleUpdateRowById)
router.patch('/:tableName', handleUpdateRow)

// Delete row (with criteria in body or by single PK :id)
router.delete('/:tableName/:id', handleDeleteRowById)
router.delete('/:tableName', handleDeleteRow)

module.exports = router
