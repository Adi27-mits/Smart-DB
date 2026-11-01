/**
 * exportController.js — Generates downloadable SQL schema dump
 *
 * GET /api/schema/export
 *
 * Produces a CREATE TABLE + INSERT statement dump of the connected database.
 * Does NOT use mysqldump — builds SQL from INFORMATION_SCHEMA queries so it
 * works without requiring CLI tools on the server.
 */

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

/**
 * GET /api/schema/export
 *
 * Generates a SQL file containing:
 *  - CREATE TABLE statements (with columns, PKs, indexes)
 *  - ALTER TABLE ... ADD FOREIGN KEY statements
 *  - INSERT INTO statements with all data
 *
 * Query params:
 *  - structure=true (default) — include CREATE TABLE
 *  - data=true (default) — include INSERT statements
 *  - download=true — set Content-Disposition header for file download
 */
async function handleExportSQL(req, res, next) {
  try {
    const pool = getPoolOrFail(req, res)
    if (!pool) return

    const dbName = req.app.locals.dbName
    const includeStructure = req.query.structure !== 'false'
    const includeData = req.query.data !== 'false'
    const asDownload = req.query.download === 'true'

    const lines = []
    lines.push(`-- Smart Database Visualizer — SQL Export`)
    lines.push(`-- Database: ${dbName}`)
    lines.push(`-- Generated: ${new Date().toISOString()}`)
    lines.push(`-- ────────────────────────────────────────────────`)
    lines.push('')
    lines.push(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`)
    lines.push(`USE \`${dbName}\`;`)
    lines.push('')
    lines.push('SET FOREIGN_KEY_CHECKS = 0;')
    lines.push('')

    // 1. Get all tables
    const [tables] = await pool.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [dbName]
    )

    if (includeStructure) {
      for (const { TABLE_NAME: tableName } of tables) {
        // Use SHOW CREATE TABLE for accurate DDL
        const [createResult] = await pool.execute(`SHOW CREATE TABLE \`${dbName}\`.\`${tableName}\``)
        if (createResult.length > 0) {
          const createSQL = createResult[0]['Create Table']
          lines.push(`-- ────────────────────────────────────────────────`)
          lines.push(`-- Table: ${tableName}`)
          lines.push(`-- ────────────────────────────────────────────────`)
          lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`)
          lines.push(createSQL + ';')
          lines.push('')
        }
      }
    }

    if (includeData) {
      for (const { TABLE_NAME: tableName } of tables) {
        const [rows] = await pool.execute(`SELECT * FROM \`${dbName}\`.\`${tableName}\``)
        if (rows.length === 0) continue

        lines.push(`-- ────────────────────────────────────────────────`)
        lines.push(`-- Data for: ${tableName}`)
        lines.push(`-- ────────────────────────────────────────────────`)

        const columns = Object.keys(rows[0])
        const colList = columns.map(c => `\`${c}\``).join(', ')

        for (const row of rows) {
          const values = columns.map(c => {
            const v = row[c]
            if (v === null) return 'NULL'
            if (typeof v === 'number') return String(v)
            if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`
            // Escape string values
            return `'${String(v).replace(/'/g, "\\'").replace(/\\/g, '\\\\')}'`
          }).join(', ')
          lines.push(`INSERT INTO \`${tableName}\` (${colList}) VALUES (${values});`)
        }
        lines.push('')
      }
    }

    lines.push('SET FOREIGN_KEY_CHECKS = 1;')
    lines.push('')

    const sql = lines.join('\n')

    if (asDownload) {
      res.setHeader('Content-Type', 'application/sql')
      res.setHeader('Content-Disposition', `attachment; filename="${dbName}_export.sql"`)
      return res.send(sql)
    }

    return res.json({
      success: true,
      data: {
        database: dbName,
        sql,
        tableCount: tables.length,
      },
    })
  } catch (err) {
    console.error('[EXPORT] SQL export failed:', err.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to export database schema. ' + (err.message || ''),
    })
  }
}

module.exports = { handleExportSQL }
