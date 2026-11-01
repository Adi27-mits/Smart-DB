/**
 * databaseService.js — Database connection logic
 *
 * Handles:
 *  - Testing a connection (ping and immediately release)
 *  - Auto-initialization if database does not exist
 *  - Creating a persistent pool for a session
 */

const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const { createPool } = require('../config/database')

/**
 * Ensures the target database exists. If it does not exist, connects without
 * database selection and creates it.
 *
 * This function is graceful — if it cannot connect to MySQL at all (wrong
 * credentials, server down, etc.), it throws the original error so the
 * controller can provide an appropriate user-facing message.
 */
async function ensureDatabaseExists(config) {
  let adminConn
  try {
    // Connect to MySQL server root without database selection
    adminConn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      multipleStatements: true,
      connectTimeout: 10000,
    })

    // Check if database exists
    const [rows] = await adminConn.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [config.database]
    )

    if (rows.length === 0) {
      console.log(`[DB SETUP] Database '${config.database}' not found. Creating it...`)
      await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``)
      console.log(`[DB SETUP] Database '${config.database}' created successfully.`)
    }
  } catch (err) {
    console.error('[DB SETUP] Auto-creation check failed:', err.message)
    // Re-throw so the caller (testConnection) can handle it
    throw err
  } finally {
    if (adminConn) await adminConn.end()
  }
}

/**
 * Test whether a MySQL database is reachable with the given credentials.
 * If the database doesn't exist, auto-creates it.
 *
 * @param {{ host, port, user, password, database }} config
 * @returns {Promise<void>} Resolves if connection succeeds, rejects otherwise.
 */
async function testConnection(config) {
  // First, ensure DB exists or auto-create it
  await ensureDatabaseExists(config)

  const pool = createPool(config)
  try {
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()
  } finally {
    await pool.end()
  }
}

/**
 * Create a persistent MySQL pool for the current session.
 * The pool is stored in app.locals so all subsequent requests can reuse it.
 *
 * @param {{ host, port, user, password, database }} config
 * @returns {mysql2.Pool}
 */
function createSessionPool(config) {
  return createPool(config)
}

/**
 * Test connecting to the MySQL server directly without creating database or pool.
 */
async function testServerConnection(config) {
  const connection = await mysql.createConnection({
    host: config.host || 'localhost',
    port: Number(config.port) || 3306,
    user: config.user || 'root',
    password: config.password || '',
    database: config.database || undefined,
    connectTimeout: 5000,
  })
  await connection.ping()
  await connection.end()
}

module.exports = { testConnection, createSessionPool, ensureDatabaseExists, testServerConnection }
