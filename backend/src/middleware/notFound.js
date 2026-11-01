/**
 * notFound.js — 404 handler
 *
 * Catches any request that doesn't match a registered route
 * and returns a consistent JSON 404 response.
 */

function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  })
}

module.exports = notFound
