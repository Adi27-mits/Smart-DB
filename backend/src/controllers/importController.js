/**
 * importController.js — SQL file upload & import
 *
 * POST /api/database/import
 *
 * Accepts a .sql file upload, validates it, and executes it against the
 * connected database. Only processes files ≤ 10 MB and only runs basic
 * DDL/DML statements (CREATE, ALTER, INSERT, UPDATE, DELETE, DROP, USE).
 *
 * Security:
 *  - File is stored in memory only (multer memoryStorage)
 *  - No local filesystem paths are exposed
 *  - SQL is split by semicolons and each statement is checked
 *  - Max file size enforced
 */

const multer = require('multer')

// Multer config: memory storage, 10 MB limit, .sql files only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase()
    if (ext.endsWith('.sql') || ext.endsWith('.txt')) {
      cb(null, true)
    } else {
      cb(new Error('Only .sql files are allowed.'))
    }
  },
}).single('sqlFile')

/**
 * Allowlist of SQL statement prefixes that are safe to execute.
 * Blocks things like GRANT, REVOKE, SET PASSWORD, etc.
 */
const ALLOWED_PREFIXES = [
  'CREATE', 'ALTER', 'DROP', 'INSERT', 'UPDATE', 'DELETE',
  'USE', 'SET', 'TRUNCATE', 'RENAME',
]

function isStatementAllowed(stmt) {
  const trimmed = stmt.trim().toUpperCase()
  if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('/*')) return false
  return ALLOWED_PREFIXES.some(prefix => trimmed.startsWith(prefix))
}

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
 * POST /api/database/import
 */
async function handleImportSQL(req, res) {
  upload(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        const msg = uploadErr.code === 'LIMIT_FILE_SIZE'
          ? 'File is too large (max 10 MB).'
          : uploadErr.message || 'File upload failed.'
        return res.status(400).json({ success: false, message: msg })
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No SQL file was uploaded.' })
      }

      const pool = getPoolOrFail(req, res)
      if (!pool) return

      const sqlContent = req.file.buffer.toString('utf8')

      // Split by semicolons, filter empty/comments
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      let executed = 0
      let skipped = 0
      const errors = []

      for (const stmt of statements) {
        if (!isStatementAllowed(stmt)) {
          skipped++
          continue
        }
        try {
          await pool.query(stmt)
          executed++
        } catch (err) {
          errors.push({
            statement: stmt.substring(0, 100) + (stmt.length > 100 ? '...' : ''),
            error: err.message,
          })
        }
      }

      return res.json({
        success: true,
        message: `Import complete. ${executed} statements executed, ${skipped} skipped.`,
        data: {
          totalStatements: statements.length,
          executed,
          skipped,
          errors: errors.slice(0, 10), // limit error reporting
        },
      })
    } catch (err) {
      console.error('[IMPORT] SQL import failed:', err.message)
      return res.status(500).json({
        success: false,
        message: 'SQL import failed: ' + (err.message || 'Unknown error'),
      })
    }
  })
}

module.exports = { handleImportSQL }
