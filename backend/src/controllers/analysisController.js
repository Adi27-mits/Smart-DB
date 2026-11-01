/**
 * analysisController.js — Controller for /api/analysis/*
 *
 * Exposes endpoints for executing rule-based schema analysis and
 * retrieving database health recommendations.
 */

const { defaultPool } = require('../config/database')
const { runDatabaseAnalysis } = require('../services/analysisService')

/**
 * Helper to retrieve an active connection pool.
 * Checks runtime app.locals.dbPool first, falls back to .env defaultPool if present.
 */
function getActivePool(req) {
  if (req.app.locals.dbPool) {
    return {
      pool: req.app.locals.dbPool,
      dbName: req.app.locals.dbName,
      dbType: req.app.locals.dbType || 'MySQL',
    }
  }

  return null
}

/**
 * POST /api/analysis/run (and GET /api/analysis/run)
 *
 * Runs full rule-based analysis on the currently connected database.
 */
async function handleRunAnalysis(req, res, next) {
  try {
    const active = getActivePool(req)
    if (!active) {
      return res.status(400).json({
        success: false,
        message: 'No database connected. Call POST /api/database/connect first.',
      })
    }

    const result = await runDatabaseAnalysis(active.pool, active.dbName, active.dbType)
    return res.json(result)
  } catch (err) {
    console.error('[ANALYSIS ERROR]', err.message)
    // Never expose database passwords or raw stack traces to the client
    return res.status(500).json({
      success: false,
      message: 'Failed to complete database analysis: ' + (err.message || 'Internal server error'),
    })
  }
}

module.exports = {
  handleRunAnalysis,
}
