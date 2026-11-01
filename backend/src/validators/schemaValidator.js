const { z } = require('zod')

// Safe SQL identifier pattern
const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/

// Allowed MySQL data types (whitelist approach)
const ALLOWED_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'DECIMAL', 'FLOAT', 'DOUBLE',
  'VARCHAR', 'CHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'TINYTEXT',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
  'BOOLEAN', 'BOOL',
  'BLOB', 'MEDIUMBLOB', 'LONGBLOB', 'TINYBLOB',
  'JSON', 'ENUM', 'SET',
]

const safeIdentifier = z.string()
  .min(1, 'Name cannot be empty.')
  .max(64, 'Name is too long (max 64 characters).')
  .regex(identifierPattern, 'Name must start with a letter or underscore and contain only letters, digits, and underscores.')

// Validates data type strings like "VARCHAR(255)", "INT", "DECIMAL(10,2)"
const dataTypeSchema = z.string()
  .min(1, 'Data type is required.')
  .max(100, 'Data type is too long.')
  .refine((val) => {
    const base = val.split('(')[0].toUpperCase().trim()
    return ALLOWED_TYPES.includes(base)
  }, { message: 'Unsupported data type.' })

// Create table
const createTableSchema = z.object({
  tableName: safeIdentifier,
  columns: z.array(z.object({
    name: safeIdentifier,
    type: dataTypeSchema,
    nullable: z.boolean().optional().default(true),
    primaryKey: z.boolean().optional().default(false),
    autoIncrement: z.boolean().optional().default(false),
    defaultValue: z.string().max(255).optional(),
    unique: z.boolean().optional().default(false),
  })).min(1, 'At least one column is required.'),
})

// Add column
const addColumnSchema = z.object({
  tableName: safeIdentifier,
  columnName: safeIdentifier,
  type: dataTypeSchema,
  nullable: z.boolean().optional().default(true),
  defaultValue: z.string().max(255).optional(),
  after: safeIdentifier.optional(), // position after which column
  unique: z.boolean().optional().default(false),
})

// Modify column
const modifyColumnSchema = z.object({
  tableName: safeIdentifier,
  columnName: safeIdentifier,
  newName: safeIdentifier.optional(),
  newType: dataTypeSchema.optional(),
  nullable: z.boolean().optional(),
  defaultValue: z.string().max(255).nullable().optional(),
}).refine(data => data.newName || data.newType || data.nullable !== undefined || data.defaultValue !== undefined, {
  message: 'At least one modification (newName, newType, nullable, defaultValue) is required.',
})

// Delete column
const deleteColumnSchema = z.object({
  tableName: safeIdentifier,
  columnName: safeIdentifier,
})

// Add relationship (foreign key)
const addRelationshipSchema = z.object({
  sourceTable: safeIdentifier,
  sourceColumn: safeIdentifier,
  targetTable: safeIdentifier,
  targetColumn: safeIdentifier,
  onDelete: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION']).optional().default('RESTRICT'),
  onUpdate: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION']).optional().default('RESTRICT'),
})

// Remove relationship
const removeRelationshipSchema = z.object({
  tableName: safeIdentifier,
  constraintName: safeIdentifier,
})

module.exports = {
  safeIdentifier,
  createTableSchema,
  addColumnSchema,
  modifyColumnSchema,
  deleteColumnSchema,
  addRelationshipSchema,
  removeRelationshipSchema,
  ALLOWED_TYPES,
}
