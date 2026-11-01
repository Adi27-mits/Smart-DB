/**
 * database.js — MySQL connection pool factory
 *
 * Exports two helpers:
 *  - createPool(config)  → creates a new mysql2 connection pool
 *  - defaultPool         → a pool built from .env variables (optional fallback)
 *
 * The main use case is Strategy A: user supplies credentials via the connect
 * form → backend creates a pool for that session → stores it in app.locals.
 */

const mysql = require('mysql2/promise')

/**
 * Build a mysql2 connection pool from a config object.
 *
 * @param {{ host: string, port: number, user: string, password: string, database: string }} config
 * @returns {mysql.Pool}
 */
function createPool(config) {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,      // max simultaneous connections
    queueLimit: 0,            // unlimited queue
    connectTimeout: 10000,    // 10 seconds before giving up
    dateStrings: true,        // Return DATE/DATETIME/TIMESTAMP columns as MySQL formatted strings
  })
}

/**
 * Optional default pool built from .env variables.
 * Only usable if DB_NAME is set in the environment.
 */
const defaultPool =
  process.env.DB_NAME
    ? createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
      })
    : null

module.exports = { createPool, defaultPool }
