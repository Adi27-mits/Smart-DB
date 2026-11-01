/**
 * databaseRoutes.js — Routes for database connection management
 *
 * GET  /api/database/test    → test existing connection or env config
 * POST /api/database/test    → test credentials without persisting a connection
 * POST /api/database/connect → connect and store pool in app.locals
 * POST /api/database/import  → upload and execute a .sql file
 * POST /api/database/disconnect → close the active connection pool
 */

const express = require('express')
const {
  testDatabaseConnection,
  connectDatabase,
  testActiveOrEnvConnection,
  disconnectDatabase,
} = require('../controllers/databaseController')

const { handleImportSQL } = require('../controllers/importController')

const router = express.Router()

router.get('/test', testActiveOrEnvConnection)
router.post('/test', testDatabaseConnection)
router.post('/connect', connectDatabase)
router.post('/disconnect', disconnectDatabase)
router.post('/import', handleImportSQL)

module.exports = router
