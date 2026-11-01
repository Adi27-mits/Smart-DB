const {
  createTableSchema,
  addColumnSchema,
  modifyColumnSchema,
  deleteColumnSchema,
  addRelationshipSchema,
  removeRelationshipSchema,
  safeIdentifier,
} = require('../validators/schemaValidator')

const {
  createTable,
  dropTable,
  addColumn,
  modifyColumn,
  dropColumn,
  addRelationship,
  removeRelationship,
} = require('../services/schemaEditService')

function getPoolOrFail(req, res) {
  const pool = req.app.locals.dbPool
  if (!pool) {
    res.status(400).json({ success: false, message: 'No database connected. Call POST /api/database/connect first.' })
    return null
  }
  return pool
}

function friendlySchemaError(err) {
  if (err.isValidationError) {
    return err.message
  }
  const msg = (err.message || '').toLowerCase()
  if (msg.includes('already exists')) return 'A table or column with that name already exists.'
  if (msg.includes('cannot be null')) return 'A required value was not provided.'
  if (msg.includes('foreign key constraint fails')) return 'Cannot complete this operation due to foreign key constraints.'
  if (msg.includes('unknown column')) return 'The specified column does not exist.'
  if (msg.includes('duplicate')) return 'A duplicate entry was found.'
  return err.message || 'Schema modification failed.'
}

// POST /api/schema/table
async function handleCreateTable(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return
    const result = createTableSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ success: false, message: result.error.errors[0].message })
    const data = await createTable(pool, req.app.locals.dbName, result.data)
    return res.json({ success: true, message: `Table '${data.tableName}' created successfully.`, data })
  } catch (err) {
    console.error('[SCHEMA EDIT] Create table failed:', err.message)
    return res.status(400).json({ success: false, message: friendlySchemaError(err) })
  }
}

// DELETE /api/schema/table/:tableName
async function handleDropTable(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return
    const parsed = safeIdentifier.safeParse(req.params.tableName)
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.errors[0].message })
    const data = await dropTable(pool, req.app.locals.dbName, parsed.data)
    return res.json({ success: true, message: `Table '${data.tableName}' deleted successfully.`, data })
  } catch (err) {
    console.error('[SCHEMA EDIT] Drop table failed:', err.message)
    return res.status(400).json({ success: false, message: friendlySchemaError(err) })
  }
}

// POST /api/schema/column
async function handleAddColumn(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return
    const result = addColumnSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ success: false, message: result.error.errors[0].message })
    const data = await addColumn(pool, req.app.locals.dbName, result.data)
    return res.json({ success: true, message: `Column '${data.columnName}' added to '${data.tableName}'.`, data })
  } catch (err) {
    console.error('[SCHEMA EDIT] Add column failed:', err.message)
    return res.status(400).json({ success: false, message: friendlySchemaError(err) })
  }
}

// PATCH /api/schema/column
async function handleModifyColumn(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return
    const result = modifyColumnSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ success: false, message: result.error.errors[0].message })
    const data = await modifyColumn(pool, req.app.locals.dbName, result.data)
    return res.json({ success: true, message: `Column '${data.columnName}' modified successfully.`, data })
  } catch (err) {
    console.error('[SCHEMA EDIT] Modify column failed:', err.message)
    return res.status(400).json({ success: false, message: friendlySchemaError(err) })
  }
}

// DELETE /api/schema/column
async function handleDropColumn(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return
    const result = deleteColumnSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ success: false, message: result.error.errors[0].message })
    const data = await dropColumn(pool, req.app.locals.dbName, result.data)
    return res.json({ success: true, message: `Column '${data.columnName}' deleted from '${data.tableName}'.`, data })
  } catch (err) {
    console.error('[SCHEMA EDIT] Drop column failed:', err.message)
    return res.status(400).json({ success: false, message: friendlySchemaError(err) })
  }
}

// POST /api/schema/relationship
async function handleAddRelationship(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return
    const result = addRelationshipSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ success: false, message: result.error.errors[0].message })
    const data = await addRelationship(pool, req.app.locals.dbName, result.data)
    return res.json({ success: true, message: `Foreign key '${data.constraintName}' created.`, data })
  } catch (err) {
    console.error('[SCHEMA EDIT] Add relationship failed:', err.message)
    return res.status(400).json({ success: false, message: friendlySchemaError(err) })
  }
}

// DELETE /api/schema/relationship
async function handleRemoveRelationship(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return
    const result = removeRelationshipSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ success: false, message: result.error.errors[0].message })
    const data = await removeRelationship(pool, req.app.locals.dbName, result.data)
    return res.json({ success: true, message: `Foreign key '${data.constraintName}' removed.`, data })
  } catch (err) {
    console.error('[SCHEMA EDIT] Remove relationship failed:', err.message)
    return res.status(400).json({ success: false, message: friendlySchemaError(err) })
  }
}

module.exports = {
  handleCreateTable,
  handleDropTable,
  handleAddColumn,
  handleModifyColumn,
  handleDropColumn,
  handleAddRelationship,
  handleRemoveRelationship,
}
