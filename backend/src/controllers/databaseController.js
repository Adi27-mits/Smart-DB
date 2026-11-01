/**
 * databaseController.js — Request handlers for /api/database/*
 *
 * Responsibilities:
 *  - Parse and validate incoming request data
 *  - Call the appropriate service function
 *  - Return a consistent JSON response
 *  - Never expose passwords or internal errors to the client
 */

const { connectSchema } = require('../validators/databaseValidator')
const { testConnection, createSessionPool, testServerConnection } = require('../services/databaseService')

/**
 * Turn a raw MySQL error into a safe, human-readable message.
 * Never leaks passwords, stack traces, or internal paths.
 */
function friendlyDbError(err) {
  const code = err.code || ''
  const msg = (err.message || '').toLowerCase()

  if (code === 'ECONNREFUSED' || msg.includes('econnrefused')) {
    return 'MySQL server is not running or not reachable. Make sure MySQL is installed and started.'
  }
  if (code === 'ER_ACCESS_DENIED_ERROR' || msg.includes('access denied')) {
    return 'Access denied — check your username and password.'
  }
  if (code === 'ER_BAD_DB_ERROR' || msg.includes('unknown database')) {
    return 'Database does not exist. Check the database name and try again.'
  }
  if (code === 'ENOTFOUND' || msg.includes('enotfound')) {
    return 'Host not found. Check the hostname or IP address.'
  }
  if (code === 'ETIMEDOUT' || msg.includes('etimedout') || msg.includes('connect timeout')) {
    return 'Connection timed out. The database server might be down or firewalled.'
  }
  if (code === 'PROTOCOL_CONNECTION_LOST' || msg.includes('connection lost')) {
    return 'Connection was lost. Please try again.'
  }
  return 'Unable to connect to database. Check your credentials and make sure MySQL is running.'
}

/**
 * POST /api/database/test
 *
 * Tests whether a MySQL database is reachable with the provided credentials.
 * The connection is opened and immediately closed — nothing is persisted.
 *
 * Body: { host, port, user, password, database }
 */
async function testDatabaseConnection(req, res, next) {
  try {
    // ── 1. Validate input ────────────────────────────────────────────────
    const result = connectSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.errors[0].message,
      })
    }

    const config = result.data

    // ── 2. Attempt connection ────────────────────────────────────────────
    await testConnection(config)

    // ── 3. Success ───────────────────────────────────────────────────────
    return res.json({
      success: true,
      message: 'Database connection successful',
    })
  } catch (err) {
    // Log the real error server-side, send a safe message to the client
    console.error('[DB TEST] Connection failed:', err.code, err.message)
    return res.status(400).json({
      success: false,
      message: friendlyDbError(err),
    })
  }
}

/**
 * POST /api/database/connect
 *
 * Validates credentials, creates a persistent MySQL pool, stores it in
 * app.locals for the lifetime of the server process.
 *
 * In a multi-user production app you would use sessions or JWTs instead.
 * For a demo/presentation tool this approach is clean and straightforward.
 *
 * Body: { host, port, user, password, database }
 */
async function connectDatabase(req, res, next) {
  try {
    // ── 1. Validate input ────────────────────────────────────────────────
    const result = connectSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.errors[0].message,
      })
    }

    const config = result.data

    // ── 2. Test the connection first ─────────────────────────────────────
    await testConnection(config)

    // ── 3. Close any previously open pool ───────────────────────────────
    if (req.app.locals.dbPool) {
      await req.app.locals.dbPool.end().catch(() => {})
    }

    // ── 4. Create and store the session pool ─────────────────────────────
    req.app.locals.dbPool = createSessionPool(config)
    req.app.locals.dbName = config.database
    req.app.locals.dbType = 'MySQL'

    console.log(`[DB CONNECT] Connected to database: ${config.database} on ${config.host}`)

    return res.json({
      success: true,
      message: 'Database connected successfully',
      data: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        // password intentionally omitted
      },
    })
  } catch (err) {
    console.error('[DB CONNECT] Failed:', err.code, err.message)
    return res.status(400).json({
      success: false,
      message: friendlyDbError(err),
    })
  }
}

/**
 * GET /api/database/test
 *
 * Verifies backend communication with MySQL without exposing credentials or stack traces.
 * Checks active connection pool if present, otherwise tests environment configuration.
 */
async function testActiveOrEnvConnection(req, res, next) {
  try {
    if (req.app.locals.dbPool) {
      const conn = await req.app.locals.dbPool.getConnection()
      await conn.ping()
      conn.release()
      return res.json({
        success: true,
        message: `Database connection successful (connected to '${req.app.locals.dbName || 'MySQL'}')`,
      })
    }

    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || undefined,
    }

    await testServerConnection(config)

    return res.json({
      success: true,
      message: 'Database connection successful',
    })
  } catch (err) {
    console.error('[DB TEST GET] Connection test failed:', err.code, err.message)
    return res.status(400).json({
      success: false,
      message: friendlyDbError(err),
    })
  }
}

/**
 * POST /api/database/disconnect
 *
 * Closes the active connection pool and clears session state.
 */
async function disconnectDatabase(req, res, next) {
  try {
    if (req.app.locals.dbPool) {
      await req.app.locals.dbPool.end().catch(() => {})
      req.app.locals.dbPool = null
      req.app.locals.dbName = null
      req.app.locals.dbType = null
    }
    return res.json({
      success: true,
      message: 'Database disconnected successfully.',
    })
  } catch (err) {
    console.error('[DB DISCONNECT] Failed:', err.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect.',
    })
  }
}

module.exports = { testDatabaseConnection, connectDatabase, testActiveOrEnvConnection, disconnectDatabase }
