const mysql = require('mysql2/promise')

/**
 * Create a new table in the connected database.
 */
async function createTable(pool, dbName, { tableName, columns }) {
  const colDefs = columns.map(col => {
    let def = `\`${col.name}\` ${col.type}`
    if (col.primaryKey) def += ' PRIMARY KEY'
    if (col.autoIncrement) def += ' AUTO_INCREMENT'
    if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
    if (col.unique && !col.primaryKey) def += ' UNIQUE'
    if (col.defaultValue !== undefined && col.defaultValue !== null) {
      def += ` DEFAULT ${mysql.escape(col.defaultValue)}`
    }
    return def
  })

  const sql = `CREATE TABLE \`${dbName}\`.\`${tableName}\` (\n  ${colDefs.join(',\n  ')}\n)`
  await pool.execute(sql)
  return { tableName, columnsCreated: columns.length }
}

/**
 * Drop a table from the database.
 */
async function dropTable(pool, dbName, tableName) {
  await pool.execute(`DROP TABLE \`${dbName}\`.\`${tableName}\``)
  return { tableName }
}

/**
 * Add a column to an existing table.
 */
async function addColumn(pool, dbName, { tableName, columnName, type, nullable, defaultValue, after, unique }) {
  let sql = `ALTER TABLE \`${dbName}\`.\`${tableName}\` ADD COLUMN \`${columnName}\` ${type}`
  if (!nullable) sql += ' NOT NULL'
  if (unique) sql += ' UNIQUE'
  if (defaultValue !== undefined && defaultValue !== null) {
    sql += ` DEFAULT ${mysql.escape(defaultValue)}`
  }
  if (after) sql += ` AFTER \`${after}\``
  await pool.execute(sql)
  return { tableName, columnName }
}

/**
 * Modify an existing column (rename, change type, nullable, default).
 */
async function modifyColumn(pool, dbName, { tableName, columnName, newName, newType, nullable, defaultValue }) {
  // First get the current column info to preserve unchanged attributes
  const [rows] = await pool.execute(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, tableName, columnName]
  )
  if (rows.length === 0) {
    throw Object.assign(new Error(`Column '${columnName}' not found in table '${tableName}'.`), { statusCode: 404 })
  }

  const current = rows[0]
  const finalName = newName || columnName
  const finalType = newType || current.COLUMN_TYPE
  const finalNullable = nullable !== undefined ? nullable : (current.IS_NULLABLE === 'YES')
  const finalDefault = defaultValue !== undefined ? defaultValue : current.COLUMN_DEFAULT

  let sql = `ALTER TABLE \`${dbName}\`.\`${tableName}\` CHANGE COLUMN \`${columnName}\` \`${finalName}\` ${finalType}`
  if (!finalNullable) sql += ' NOT NULL'
  else sql += ' NULL'
  if (finalDefault !== null && finalDefault !== undefined) {
    sql += ` DEFAULT ${mysql.escape(finalDefault)}`
  }
  // Preserve auto_increment
  if (current.EXTRA && current.EXTRA.includes('auto_increment')) {
    sql += ' AUTO_INCREMENT'
  }

  await pool.execute(sql)
  return { tableName, columnName, newName: finalName }
}

/**
 * Drop a column from a table.
 */
async function dropColumn(pool, dbName, { tableName, columnName }) {
  await pool.execute(`ALTER TABLE \`${dbName}\`.\`${tableName}\` DROP COLUMN \`${columnName}\``)
  return { tableName, columnName }
}

/**
 * Add a foreign key relationship with full pre-validation.
 */
async function addRelationship(pool, dbName, { sourceTable, sourceColumn, targetTable, targetColumn, onDelete, onUpdate }) {
  // 1. Validate table existence
  const [tableRows] = await pool.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?)`,
    [dbName, sourceTable, targetTable]
  )
  const existingTables = new Set(tableRows.map((r) => r.TABLE_NAME))
  if (!existingTables.has(sourceTable)) {
    const err = new Error(`Source table '${sourceTable}' does not exist.`)
    err.isValidationError = true
    throw err
  }
  if (!existingTables.has(targetTable)) {
    const err = new Error(`Target table '${targetTable}' does not exist.`)
    err.isValidationError = true
    throw err
  }

  // 2. Validate self-reference pairing
  if (sourceTable === targetTable && sourceColumn === targetColumn) {
    const err = new Error(`Cannot create self-referencing foreign key on the exact same column ('${sourceColumn}').`)
    err.isValidationError = true
    throw err
  }

  // 3. Validate columns existence and metadata
  const [colRows] = await pool.execute(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, COLLATION_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?, ?)`,
    [dbName, sourceTable, targetTable]
  )
  const sourceCol = colRows.find((c) => c.TABLE_NAME === sourceTable && c.COLUMN_NAME === sourceColumn)
  const targetCol = colRows.find((c) => c.TABLE_NAME === targetTable && c.COLUMN_NAME === targetColumn)

  if (!sourceCol) {
    const err = new Error(`Source column '${sourceTable}.${sourceColumn}' does not exist.`)
    err.isValidationError = true
    throw err
  }
  if (!targetCol) {
    const err = new Error(`Target column '${targetTable}.${targetColumn}' does not exist.`)
    err.isValidationError = true
    throw err
  }

  // 4. Validate data type compatibility
  const srcType = sourceCol.DATA_TYPE.toLowerCase()
  const tgtType = targetCol.DATA_TYPE.toLowerCase()
  const intTypes = ['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint']
  const isSrcInt = intTypes.includes(srcType)
  const isTgtInt = intTypes.includes(tgtType)

  if (isSrcInt !== isTgtInt) {
    const err = new Error(
      `Cannot create relationship: source ${sourceCol.DATA_TYPE.toUpperCase()} and target ${targetCol.DATA_TYPE.toUpperCase()} are incompatible.`
    )
    err.isValidationError = true
    throw err
  }

  if (isSrcInt && isTgtInt) {
    if (srcType !== tgtType) {
      const err = new Error(
        `Cannot create relationship: source ${sourceCol.DATA_TYPE.toUpperCase()} and target ${targetCol.DATA_TYPE.toUpperCase()} are incompatible.`
      )
      err.isValidationError = true
      throw err
    }
    const srcUnsigned = sourceCol.COLUMN_TYPE.toLowerCase().includes('unsigned')
    const tgtUnsigned = targetCol.COLUMN_TYPE.toLowerCase().includes('unsigned')
    if (srcUnsigned !== tgtUnsigned) {
      const err = new Error(
        `Cannot create relationship: source column is ${srcUnsigned ? 'UNSIGNED' : 'SIGNED'} while target column is ${tgtUnsigned ? 'UNSIGNED' : 'SIGNED'}.`
      )
      err.isValidationError = true
      throw err
    }
  } else if (srcType !== tgtType) {
    const err = new Error(
      `Cannot create relationship: source ${sourceCol.DATA_TYPE.toUpperCase()} and target ${targetCol.DATA_TYPE.toUpperCase()} are incompatible.`
    )
    err.isValidationError = true
    throw err
  }

  // 5. Target column index check (must be leading column of an index)
  const [indexRows] = await pool.execute(
    `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND SEQ_IN_INDEX = 1`,
    [dbName, targetTable, targetColumn]
  )
  if (indexRows.length === 0) {
    const err = new Error(
      `Target column '${targetTable}.${targetColumn}' must be indexed (e.g. PRIMARY KEY or UNIQUE) to be referenced by a foreign key.`
    )
    err.isValidationError = true
    throw err
  }

  // 6. Check SET NULL applicability
  if ((onDelete === 'SET NULL' || onUpdate === 'SET NULL') && sourceCol.IS_NULLABLE === 'NO') {
    const err = new Error(
      `SET NULL action requires source column '${sourceTable}.${sourceColumn}' to be nullable.`
    )
    err.isValidationError = true
    throw err
  }

  // 7. Check if duplicate FK relationship already exists
  const [existingFkRows] = await pool.execute(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME = ?
       AND REFERENCED_COLUMN_NAME = ?`,
    [dbName, sourceTable, sourceColumn, targetTable, targetColumn]
  )
  if (existingFkRows.length > 0) {
    const err = new Error(
      `Foreign key relationship from '${sourceTable}.${sourceColumn}' to '${targetTable}.${targetColumn}' already exists (${existingFkRows[0].CONSTRAINT_NAME}).`
    )
    err.isValidationError = true
    throw err
  }

  // 8. Check constraint name conflict
  const constraintName = `fk_${sourceTable}_${sourceColumn}_${targetTable}`
  const [constraintRows] = await pool.execute(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ?`,
    [dbName, constraintName]
  )
  if (constraintRows.length > 0) {
    const err = new Error(
      `Constraint name '${constraintName}' already exists in database '${dbName}'.`
    )
    err.isValidationError = true
    throw err
  }

  // 9. Check existing child values for orphan references
  const [orphanRows] = await pool.query(
    `SELECT COUNT(*) AS orphanCount
     FROM \`${dbName}\`.\`${sourceTable}\` s
     WHERE s.\`${sourceColumn}\` IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM \`${dbName}\`.\`${targetTable}\` t
         WHERE t.\`${targetColumn}\` = s.\`${sourceColumn}\`
       )`
  )
  const orphanCount = orphanRows[0]?.orphanCount || 0
  if (orphanCount > 0) {
    const err = new Error(
      `Cannot create foreign key: found ${orphanCount} existing row(s) in '${sourceTable}' with orphan values not present in '${targetTable}.${targetColumn}'.`
    )
    err.isValidationError = true
    throw err
  }

  // All pre-validations passed — execute ALTER TABLE
  const sql = `ALTER TABLE \`${dbName}\`.\`${sourceTable}\`
    ADD CONSTRAINT \`${constraintName}\`
    FOREIGN KEY (\`${sourceColumn}\`)
    REFERENCES \`${targetTable}\` (\`${targetColumn}\`)
    ON DELETE ${onDelete || 'RESTRICT'}
    ON UPDATE ${onUpdate || 'RESTRICT'}`
  await pool.execute(sql)
  return { constraintName, sourceTable, sourceColumn, targetTable, targetColumn }
}

/**
 * Remove a foreign key constraint.
 */
async function removeRelationship(pool, dbName, { tableName, constraintName }) {
  await pool.execute(`ALTER TABLE \`${dbName}\`.\`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``)
  return { tableName, constraintName }
}

module.exports = {
  createTable,
  dropTable,
  addColumn,
  modifyColumn,
  dropColumn,
  addRelationship,
  removeRelationship,
}
