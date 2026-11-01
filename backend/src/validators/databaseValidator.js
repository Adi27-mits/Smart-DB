/**
 * databaseValidator.js — Zod schemas for validating incoming request data
 *
 * All user-supplied connection details are validated here before any
 * database interaction happens.
 */

const { z } = require('zod')

/**
 * Schema for POST /api/database/test and POST /api/database/connect
 *
 * Rules:
 *  - host     : non-empty string (hostname or IP)
 *  - port     : integer between 1 and 65535
 *  - user     : non-empty string
 *  - password : string (empty password is valid for some MySQL setups)
 *  - database : non-empty string, only safe characters (letters, digits, _ )
 */
const connectSchema = z
  .object({
    host: z
      .string({ required_error: 'Host is required.' })
      .min(1, 'Host cannot be empty.')
      .max(255, 'Host is too long.'),

    port: z
      .number({ required_error: 'Port is required.', invalid_type_error: 'Port must be a number.' })
      .int('Port must be an integer.')
      .min(1, 'Port must be at least 1.')
      .max(65535, 'Port must be at most 65535.'),

    user: z.string().min(1, 'Username cannot be empty.').max(100).optional(),
    username: z.string().min(1, 'Username cannot be empty.').max(100).optional(),

    password: z
      .string({ required_error: 'Password is required.' })
      .max(200, 'Password is too long.'),

    database: z
      .string({ required_error: 'Database name is required.' })
      .min(1, 'Database name cannot be empty.')
      .max(100, 'Database name is too long.')
      .regex(/^[a-zA-Z0-9_]+$/, 'Database name may only contain letters, numbers, and underscores.'),
  })
  .refine((data) => Boolean(data.user || data.username), {
    message: 'Username is required.',
    path: ['user'],
  })
  .transform((data) => ({
    host: data.host,
    port: data.port,
    user: data.username || data.user,
    password: data.password,
    database: data.database,
  }))

/**
 * Schema for validating :tableName route parameters
 *
 * Table names must be safe identifiers (no spaces, special chars, etc.)
 * This is used as an allow-list check before we quote the name in SQL.
 */
const tableNameSchema = z
  .string()
  .min(1, 'Table name cannot be empty.')
  .max(100, 'Table name is too long.')
  .regex(/^[a-zA-Z0-9_]+$/, 'Table name may only contain letters, numbers, and underscores.')

module.exports = { connectSchema, tableNameSchema }
