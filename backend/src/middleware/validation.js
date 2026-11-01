/**
 * validation.js — Generic validation middleware using Zod
 *
 * Allows validating req.body, req.params, or req.query against a Zod schema.
 * If validation fails, returns a safe, consistent 400 Bad Request response.
 */

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.errors[0]?.message || 'Validation error',
      })
    }
    // Replace source with parsed/sanitized data
    req[source] = result.data
    next()
  }
}

module.exports = { validate }
