/**
 * schemaService.js — All MySQL schema queries
 *
 * Uses INFORMATION_SCHEMA — the standard MySQL metadata database.
 * Never hardcodes table names or relationships; everything is discovered
 * dynamically from the connected database.
 *
 * SQL uses parameterized queries (? placeholders) for all user-supplied
 * values to prevent SQL injection.
 * Table/column names are validated as safe identifiers before use in SQL
 * (MySQL does not support ? placeholders for identifiers).
 *
 * Milestone 4 additions (additive — does not break visualization):
 *   - getTableIndexes()  — queries INFORMATION_SCHEMA.STATISTICS
 *   - getTableDetails()  — now also returns primaryKeys[], foreignKeys[],
 *                          indexes[], constraints[]
 *   - getOverview()      — passes those fields through in each table entry
 */

/**
 * Get all table names in the database.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @returns {Promise<Array<{ name: string }>>}
 */
async function getTables(pool, dbName) {
  const [rows] = await pool.execute(
    `SELECT TABLE_NAME AS name
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [dbName]
  )
  return rows
}

/**
 * Get all index metadata for a single table using INFORMATION_SCHEMA.STATISTICS.
 *
 * Returns an array of index objects, each describing one index:
 *   name       — index name (e.g. "PRIMARY", "idx_email", "uq_student_course")
 *   columns    — ordered list of column names covered by the index
 *   unique     — true when NON_UNIQUE = 0 (index enforces uniqueness)
 *   primary    — true when the index name is "PRIMARY"
 *   indexType  — storage algorithm reported by MySQL (BTREE, HASH, etc.)
 *
 * Composite indexes have multiple columns in the columns array,
 * ordered by SEQ_IN_INDEX.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @param {string} tableName  — already validated as a safe identifier
 * @returns {Promise<Array<{ name: string, columns: string[], unique: boolean, primary: boolean, indexType: string }>>}
 */
async function getTableIndexes(pool, dbName, tableName) {
  const [rows] = await pool.execute(
    `SELECT
       INDEX_NAME   AS indexName,
       COLUMN_NAME  AS columnName,
       NON_UNIQUE   AS nonUnique,
       SEQ_IN_INDEX AS seqInIndex,
       INDEX_TYPE   AS indexType
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME   = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [dbName, tableName]
  )

  // Group individual column rows into index objects keyed by index name
  const indexMap = new Map()
  for (const row of rows) {
    if (!indexMap.has(row.indexName)) {
      indexMap.set(row.indexName, {
        name: row.indexName,
        columns: [],
        unique: row.nonUnique === 0,
        primary: row.indexName === 'PRIMARY',
        indexType: row.indexType,
      })
    }
    indexMap.get(row.indexName).columns.push(row.columnName)
  }

  return Array.from(indexMap.values())
}

/**
 * Get full column details for a single table, including primary key,
 * foreign key, and index information.
 *
 * The returned object now includes Milestone 4 structured arrays:
 *   primaryKeys  — column names that form the primary key
 *   foreignKeys  — FK definitions with constraintName and references
 *   indexes      — index metadata from INFORMATION_SCHEMA.STATISTICS
 *   constraints  — FK constraint descriptors (extendable for CHECK/UNIQUE)
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @param {string} tableName  — already validated as a safe identifier
 * @returns {Promise<{
 *   tableName: string,
 *   columns: Array<object>,
 *   primaryKeys: string[],
 *   foreignKeys: Array<object>,
 *   indexes: Array<object>,
 *   constraints: Array<object>
 * }>}
 */
async function getTableDetails(pool, dbName, tableName) {
  // ── 1. Column info ─────────────────────────────────────────────────────
  const [columns] = await pool.execute(
    `SELECT
       COLUMN_NAME    AS name,
       DATA_TYPE      AS type,
       IS_NULLABLE    AS nullable,
       COLUMN_DEFAULT AS defaultValue,
       COLUMN_KEY     AS columnKey,
       EXTRA          AS extra
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME   = ?
     ORDER BY ORDINAL_POSITION`,
    [dbName, tableName]
  )

  // ── 2. Foreign key info for this table ─────────────────────────────────
  const [fkRows] = await pool.execute(
    `SELECT
       kcu.COLUMN_NAME            AS sourceColumn,
       kcu.REFERENCED_TABLE_NAME  AS targetTable,
       kcu.REFERENCED_COLUMN_NAME AS targetColumn,
       kcu.CONSTRAINT_NAME        AS constraintName
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
     JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
       ON rc.CONSTRAINT_NAME   = kcu.CONSTRAINT_NAME
      AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
     WHERE kcu.TABLE_SCHEMA = ?
       AND kcu.TABLE_NAME   = ?
       AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
    [dbName, tableName]
  )

  // ── 3. Index info for this table ────────────────────────────────────────
  const indexes = await getTableIndexes(pool, dbName, tableName)

  // Build a lookup: columnName → FK info (for per-column enrichment)
  const fkMap = {}
  for (const fk of fkRows) {
    fkMap[fk.sourceColumn] = {
      table: fk.targetTable,
      column: fk.targetColumn,
      constraintName: fk.constraintName,
    }
  }

  // ── 4. Merge column + FK data ───────────────────────────────────────────
  const enrichedColumns = columns.map((col) => ({
    name: col.name,
    type: col.type.toUpperCase(),
    nullable: col.nullable === 'YES',
    defaultValue: col.defaultValue,
    primaryKey: col.columnKey === 'PRI',
    unique: col.columnKey === 'UNI',
    autoIncrement: col.extra.includes('auto_increment'),
    extra: col.extra || '',
    foreignKey: fkMap[col.name] || null,
  }))

  // ── 5. Derive structured arrays for the Milestone 4 rule engine ─────────

  /** Primary key column names */
  const primaryKeys = enrichedColumns
    .filter((c) => c.primaryKey)
    .map((c) => c.name)

  /** Structured FK definitions */
  const foreignKeys = fkRows.map((fk) => ({
    column: fk.sourceColumn,
    constraintName: fk.constraintName,
    references: {
      table: fk.targetTable,
      column: fk.targetColumn,
    },
  }))

  /** Constraint descriptors — currently FK constraints only */
  const constraints = fkRows.map((fk) => ({
    name: fk.constraintName,
    type: 'FOREIGN KEY',
    column: fk.sourceColumn,
    references: {
      table: fk.targetTable,
      column: fk.targetColumn,
    },
  }))

  return {
    tableName,
    columns: enrichedColumns,
    primaryKeys,
    foreignKeys,
    indexes,
    constraints,
  }
}

/**
 * Get all foreign-key relationships in the database.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @returns {Promise<Array<object>>}
 */
async function getRelationships(pool, dbName) {
  const [rows] = await pool.execute(
    `SELECT
       kcu.TABLE_NAME              AS sourceTable,
       kcu.COLUMN_NAME             AS sourceColumn,
       kcu.REFERENCED_TABLE_NAME   AS targetTable,
       kcu.REFERENCED_COLUMN_NAME  AS targetColumn,
       kcu.CONSTRAINT_NAME         AS constraintName
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
     JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
       ON rc.CONSTRAINT_NAME   = kcu.CONSTRAINT_NAME
      AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
     WHERE kcu.TABLE_SCHEMA = ?
       AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME`,
    [dbName]
  )

  return rows.map((r) => ({
    id: r.constraintName,
    sourceTable: r.sourceTable,
    sourceColumn: r.sourceColumn,
    targetTable: r.targetTable,
    targetColumn: r.targetColumn,
    constraintName: r.constraintName,
    // Many-to-one is the standard meaning of a declared foreign key
    relationship: 'many-to-one',
  }))
}

/**
 * Get a complete schema overview — all tables with columns and all
 * relationships — formatted for the frontend ER diagram.
 *
 * The shape mirrors the DatabaseSchema type in frontend/lib/schema.ts so the
 * existing visualiser components work with zero changes.
 *
 * Milestone 4 extensions (additive — do NOT alter existing fields):
 *   Each table entry now also carries:
 *     primaryKeys  — string[]
 *     foreignKeys  — structured FK array
 *     indexes      — index metadata from INFORMATION_SCHEMA.STATISTICS
 *     constraints  — constraint metadata
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} dbName
 * @param {string} [dbType]   — e.g. 'MySQL'
 * @returns {Promise<{ name: string, type: string, tables: Array<object>, relationships: Array<object> }>}
 */
async function getOverview(pool, dbName, dbType = 'MySQL') {
  // Fetch all table names
  const tableList = await getTables(pool, dbName)

  // Fetch column + index details for every table in parallel
  const tableDetails = await Promise.all(
    tableList.map((t) => getTableDetails(pool, dbName, t.name))
  )

  // Fetch all relationships
  const relationships = await getRelationships(pool, dbName)

  // ── Build frontend-compatible shape ────────────────────────────────────
  // Lay out tables in a grid: 3 columns, auto-spacing
  const TABLE_WIDTH = 260
  const TABLE_GAP_X = 80
  const TABLE_GAP_Y = 80
  const COLS = 3

  const tables = tableDetails.map((t, idx) => {
    const col = idx % COLS
    const row = Math.floor(idx / COLS)
    const estimatedHeight = 42 + t.columns.length * 30

    return {
      id: t.tableName,
      name: t.tableName,
      x: col * (TABLE_WIDTH + TABLE_GAP_X) + 40,
      y: row * (estimatedHeight + TABLE_GAP_Y) + 60,

      // ── Existing visualization fields (shape is UNCHANGED) ──────────────
      columns: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        pk: c.primaryKey,
        fk: c.foreignKey
          ? { table: c.foreignKey.table, column: c.foreignKey.column }
          : undefined,
        nullable: c.nullable,
      })),

      // ── Milestone 4 extensions (additive) ──────────────────────────────
      primaryKeys: t.primaryKeys,
      foreignKeys: t.foreignKeys,
      indexes: t.indexes,
      constraints: t.constraints,
    }
  })

  // Map relationships to the format expected by the frontend visualizer
  const mappedRelationships = relationships.map((r, idx) => ({
    id: r.constraintName || `r${idx + 1}`,
    from: { table: r.sourceTable, column: r.sourceColumn },
    to: { table: r.targetTable, column: r.targetColumn },
    cardinality: 'N:1',
  }))

  return {
    name: dbName,
    type: dbType,
    tables,
    relationships: mappedRelationships,
  }
}

module.exports = {
  getTables,
  getTableDetails,
  getTableIndexes,
  getRelationships,
  getOverview,
}
