/**
 * dataController.js — Controller for table record CRUD operations
 */

const { tableNameSchema } = require('../validators/databaseValidator')
const {
  getTableData,
  getTableMetadata,
  insertRow,
  updateRow,
  deleteRow,
} = require('../services/dataService')

function getPoolOrFail(req, res) {
  const pool = req.app.locals.dbPool
  if (!pool) {
    res.status(400).json({
      success: false,
      code: 'NO_DATABASE_CONNECTED',
      message: 'No database connected. Call POST /api/database/connect first.',
    })
    return null
  }
  return pool
}

/**
 * GET /api/data/:tableName
 *
 * Query params:
 *  - limit (default 50)
 *  - offset (default 0)
 */
async function handleGetData(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const parsed = tableNameSchema.safeParse(req.params.tableName)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message,
      })
    }

    const tableName = parsed.data
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit) || 50))
    const offset = Math.max(0, parseInt(req.query.offset) || 0)

    const [data, meta] = await Promise.all([
      getTableData(pool, req.app.locals.dbName, tableName, limit, offset),
      getTableMetadata(pool, req.app.locals.dbName, tableName).catch(() => ({
        primaryKeys: [],
        columns: [],
      })),
    ])

    return res.json({
      success: true,
      data: {
        tableName,
        rows: data.rows,
        totalCount: data.totalCount,
        primaryKeys: meta.primaryKeys,
        columns: meta.columns,
        limit,
        offset,
      },
    })
  } catch (err) {
    console.error('[DATA FETCH] Failed:', err.message)
    if (err.message && err.message.includes("doesn't exist")) {
      return res.status(404).json({ success: false, code: 'TABLE_NOT_FOUND', message: 'Table not found.' })
    }
    return res.status(500).json({
      success: false,
      code: 'DATA_FETCH_ERROR',
      message: err.message || 'Failed to fetch table data.',
    })
  }
}

/**
 * GET /api/data/:tableName/metadata
 */
async function handleGetMetadata(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const parsed = tableNameSchema.safeParse(req.params.tableName)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message,
      })
    }

    const meta = await getTableMetadata(pool, req.app.locals.dbName, parsed.data)
    return res.json({
      success: true,
      data: meta,
    })
  } catch (err) {
    console.error('[DATA METADATA] Failed:', err.message)
    return res.status(400).json({
      success: false,
      code: 'METADATA_ERROR',
      message: err.message || 'Failed to fetch table metadata.',
    })
  }
}

/**
 * POST /api/data/:tableName
 *
 * Body: { data: { col1: val1, ... } } or raw record { col1: val1, ... }
 */
async function handleInsertRow(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const parsed = tableNameSchema.safeParse(req.params.tableName)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message,
      })
    }

    const payload = req.body.data || req.body
    const result = await insertRow(pool, req.app.locals.dbName, parsed.data, payload)

    return res.status(201).json({
      success: true,
      message: 'Record created successfully.',
      data: result,
    })
  } catch (err) {
    console.error('[DATA INSERT] Failed:', err.code, err.message)
    return res.status(400).json({
      success: false,
      code: err.code || 'INSERT_ERROR',
      message: err.sqlMessage || err.message || 'Failed to insert record.',
    })
  }
}

/**
 * PUT /api/data/:tableName
 *
 * Body: { criteria: { pk: val }, data: { col1: val1, ... } }
 */
async function handleUpdateRow(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const parsed = tableNameSchema.safeParse(req.params.tableName)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message,
      })
    }

    const criteria = req.body.criteria || req.query
    const updateData = req.body.data || req.body.updates || req.body

    // Remove criteria keys from updateData if sent together
    const cleanUpdate = { ...updateData }
    delete cleanUpdate.criteria
    delete cleanUpdate.updates
    if (criteria && typeof criteria === 'object') {
      for (const key of Object.keys(criteria)) {
        delete cleanUpdate[key]
      }
    }

    const result = await updateRow(pool, req.app.locals.dbName, parsed.data, criteria, cleanUpdate)

    return res.json({
      success: true,
      message: 'Record updated successfully.',
      data: result,
    })
  } catch (err) {
    console.error('[DATA UPDATE] Failed:', err.code, err.message)
    return res.status(400).json({
      success: false,
      code: err.code || 'UPDATE_ERROR',
      message: err.sqlMessage || err.message || 'Failed to update record.',
    })
  }
}

/**
 * DELETE /api/data/:tableName
 *
 * Body or query params: { criteria: { pk: val } } or ?pk=val
 */
async function handleDeleteRow(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const parsed = tableNameSchema.safeParse(req.params.tableName)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message,
      })
    }

    const criteria = req.body?.criteria || (Object.keys(req.body || {}).length > 0 ? req.body : req.query)
    const result = await deleteRow(pool, req.app.locals.dbName, parsed.data, criteria)

    return res.json({
      success: true,
      message: 'Record deleted successfully.',
      data: result,
    })
  } catch (err) {
    console.error('[DATA DELETE] Failed:', err.code, err.message)
    return res.status(400).json({
      success: false,
      code: err.code || 'DELETE_ERROR',
      message: err.sqlMessage || err.message || 'Failed to delete record.',
    })
  }
}

/**
 * PUT /api/data/:tableName/:id
 * Single PK convenience handler
 */
async function handleUpdateRowById(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const parsed = tableNameSchema.safeParse(req.params.tableName)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message,
      })
    }

    const meta = await getTableMetadata(pool, req.app.locals.dbName, parsed.data)
    if (!meta.primaryKeys || meta.primaryKeys.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'NO_PRIMARY_KEY',
        message: `Table '${parsed.data}' does not have a primary key. Use PUT /api/data/${parsed.data} with explicit criteria.`,
      })
    }

    const pkCol = meta.primaryKeys[0]
    const criteria = { [pkCol]: req.params.id }
    const updateData = req.body.data || req.body

    const cleanUpdate = { ...updateData }
    delete cleanUpdate[pkCol]
    delete cleanUpdate.criteria
    delete cleanUpdate.updates

    const result = await updateRow(pool, req.app.locals.dbName, parsed.data, criteria, cleanUpdate)

    return res.json({
      success: true,
      message: 'Record updated successfully.',
      data: result,
    })
  } catch (err) {
    console.error('[DATA UPDATE BY ID] Failed:', err.code, err.message)
    return res.status(400).json({
      success: false,
      code: err.code || 'UPDATE_ERROR',
      message: err.sqlMessage || err.message || 'Failed to update record.',
    })
  }
}

/**
 * DELETE /api/data/:tableName/:id
 * Single PK convenience handler
 */
async function handleDeleteRowById(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const parsed = tableNameSchema.safeParse(req.params.tableName)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0].message,
      })
    }

    const meta = await getTableMetadata(pool, req.app.locals.dbName, parsed.data)
    if (!meta.primaryKeys || meta.primaryKeys.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'NO_PRIMARY_KEY',
        message: `Table '${parsed.data}' does not have a primary key. Use DELETE /api/data/${parsed.data} with explicit criteria.`,
      })
    }

    const pkCol = meta.primaryKeys[0]
    const criteria = { [pkCol]: req.params.id }

    const result = await deleteRow(pool, req.app.locals.dbName, parsed.data, criteria)

    return res.json({
      success: true,
      message: 'Record deleted successfully.',
      data: result,
    })
  } catch (err) {
    console.error('[DATA DELETE BY ID] Failed:', err.code, err.message)
    return res.status(400).json({
      success: false,
      code: err.code || 'DELETE_ERROR',
      message: err.sqlMessage || err.message || 'Failed to delete record.',
    })
  }
}

module.exports = {
  handleGetData,
  handleGetMetadata,
  handleInsertRow,
  handleUpdateRow,
  handleDeleteRow,
  handleUpdateRowById,
  handleDeleteRowById,
}
