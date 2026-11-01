/**
 * queryValidator.js — Zod validation schema for SQL Query Execution
 */

const { z } = require('zod')

const executeQuerySchema = z.object({
  query: z
    .string({ required_error: 'SQL query is required.' })
    .trim()
    .min(1, 'SQL query cannot be empty.')
    .max(50000, 'SQL query exceeds maximum length of 50,000 characters.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .default(1000),
})

module.exports = {
  executeQuerySchema,
}
