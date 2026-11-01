/**
 * queryController.js — Controller for /api/query/*
 *
 * Request handlers for executing arbitrary SQL queries against the active database.
 */

const { executeQuerySchema } = require('../validators/queryValidator')
const { executeSqlQuery } = require('../services/queryService')

/**
 * POST /api/query/execute
 *
 * Executes a single SQL query against the currently connected database pool.
 *
 * Body: { query: string, limit?: number }
 */
async function handleExecuteQuery(req, res, next) {
  try {
    const pool = req.app.locals.dbPool
    if (!pool) {
      return res.status(400).json({
        success: false,
        code: 'NO_DATABASE_CONNECTED',
        message: 'No database connected. Call POST /api/database/connect first.',
      })
    }

    const validation = executeQuerySchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: validation.error.errors[0]?.message || 'Invalid query payload.',
      })
    }

    const { query, limit } = validation.data
    const result = await executeSqlQuery(pool, query, { limit })

    return res.json({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error('[QUERY EXECUTE CONTROLLER]', err.code || err.name, err.message)

    return res.status(400).json({
      success: false,
      code: err.code || 'QUERY_EXECUTION_ERROR',
      message: err.sqlMessage || err.message || 'Failed to execute query.',
      sqlState: err.sqlState || null,
    })
  }
}

module.exports = {
  handleExecuteQuery,
}
