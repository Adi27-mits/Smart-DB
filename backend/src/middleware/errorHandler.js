/**
 * errorHandler.js — Centralized error handling middleware
 *
 * Catches any error passed via next(err) and returns a safe JSON response.
 * Never exposes stack traces or internal details to the client.
 */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Log full error on the server for debugging — never sent to the client
  console.error('[ERROR]', err.message)

  const statusCode = err.statusCode || 500

  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
    code: err.code || undefined,
    sqlState: err.sqlState || undefined,
  })
}

module.exports = errorHandler
