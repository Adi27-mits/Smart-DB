/**
 * schemaController.js — Request handlers for /api/schema/*
 *
 * Each handler:
 *  1. Checks that a database connection exists (set by /api/database/connect)
 *  2. Validates route params where applicable
 *  3. Calls the schema service
 *  4. Returns a consistent { success, data } response
 */

const { tableNameSchema } = require('../validators/databaseValidator')
const {
  getTables,
  getTableDetails,
  getRelationships,
  getOverview,
} = require('../services/schemaService')

/**
 * Helper — returns the active pool or sends a 400 if not connected.
 */
function getPoolOrFail(req, res) {
  const pool = req.app.locals.dbPool
  if (!pool) {
    res.status(400).json({
      success: false,
      message: 'No database connected. Call POST /api/database/connect first.',
    })
    return null
  }
  return pool
}

// ─────────────────────────────────────────────
//  GET /api/schema/tables
// ─────────────────────────────────────────────
async function getAllTables(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const tables = await getTables(pool, req.app.locals.dbName)

    return res.json({
      success: true,
      data: { tables },
    })
  } catch (err) {
    next(err)
  }
}

// ─────────────────────────────────────────────
//  GET /api/schema/tables/:tableName
// ─────────────────────────────────────────────
async function getOneTable(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    // Validate the table name param
    const parsed = tableNameSchema.safeParse(req.params.tableName)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.errors[0].message,
      })
    }

    const tableName = parsed.data
    const details = await getTableDetails(pool, req.app.locals.dbName, tableName)

    return res.json({
      success: true,
      data: details,
    })
  } catch (err) {
    // Handle the case where the table doesn't exist
    if (err.message && err.message.includes('doesn\'t exist')) {
      return res.status(404).json({
        success: false,
        message: `Table '${req.params.tableName}' not found in database.`,
      })
    }
    next(err)
  }
}

// ─────────────────────────────────────────────
//  GET /api/schema/relationships
// ─────────────────────────────────────────────
async function getAllRelationships(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const relationships = await getRelationships(pool, req.app.locals.dbName)

    return res.json({
      success: true,
      data: { relationships },
    })
  } catch (err) {
    next(err)
  }
}

// ─────────────────────────────────────────────
//  GET /api/schema/overview
// ─────────────────────────────────────────────
async function getSchemaOverview(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const overview = await getOverview(
      pool,
      req.app.locals.dbName,
      req.app.locals.dbType || 'MySQL'
    )

    return res.json({
      success: true,
      data: overview,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAllTables, getOneTable, getAllRelationships, getSchemaOverview }
