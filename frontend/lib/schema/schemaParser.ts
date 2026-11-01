/**
 * schemaParser.ts
 *
 * Converts the normalized backend JSON (or the internal DatabaseSchema type)
 * into the intermediate NormalizedSchema that the visualization layer uses.
 *
 * The backend may send either the "internal" format (lib/schema.ts) or the
 * "API" format described in the project spec. This parser handles both.
 */

import type { DatabaseSchema, Column, Relationship } from '../schema'

/** Column representation used inside the visualization */
export interface ParsedColumn {
  name: string
  dataType: string
  nullable: boolean
  primaryKey: boolean
  foreignKey: boolean
  /** If it's a FK, where does it point? */
  references?: { table: string; column: string }
  /** Column has a unique index or unique constraint (non-primary) */
  isUnique?: boolean
  /** Column is part of a non-primary index */
  isIndexed?: boolean
}

// ── Milestone 4 extended types ───────────────────────────────────────────────

/**
 * Index descriptor extracted from INFORMATION_SCHEMA.STATISTICS.
 * Matches the shape returned by getTableIndexes() in the backend.
 */
export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
  primary: boolean
  indexType?: string
}

/**
 * Structured foreign-key definition (complements the per-column fk flag).
 */
export interface ForeignKeyInfo {
  column: string
  constraintName: string
  references: {
    table: string
    column: string
  }
}

/**
 * Generic constraint descriptor. Currently covers FK constraints;
 * extendable for CHECK, UNIQUE, etc.
 */
export interface ConstraintInfo {
  name: string
  type: string
  column: string
  references?: {
    table: string
    column: string
  }
}

/** Table representation used inside the visualization */
export interface ParsedTable {
  id: string
  name: string
  columns: ParsedColumn[]
  // ── Milestone 4 additions (optional — existing code ignores them) ────────
  /** Ordered list of primary-key column names */
  primaryKeys?: string[]
  /** Structured FK definitions (one per FK column) */
  foreignKeys?: ForeignKeyInfo[]
  /** Index metadata from INFORMATION_SCHEMA.STATISTICS */
  indexes?: IndexInfo[]
  /** Constraint descriptors */
  constraints?: ConstraintInfo[]
}

/** Relationship representation used inside the visualization */
export interface ParsedRelationship {
  id: string
  sourceTable: string
  sourceColumn: string
  targetTable: string
  targetColumn: string
  /** e.g. "N:1", "1:1", "N:M" — may be undefined if not available */
  cardinality?: string
  /** Declared foreign key constraint name if available */
  constraintName?: string
}

export interface NormalizedSchema {
  databaseName: string
  databaseType: string
  tables: ParsedTable[]
  relationships: ParsedRelationship[]
}

/**
 * Parse the internal DatabaseSchema (lib/schema.ts) into NormalizedSchema.
 * This is the primary path used when data comes from the existing backend.
 *
 * Milestone 4: the backend getOverview() now includes primaryKeys, foreignKeys,
 * indexes, and constraints on each table. These are forwarded as-is.
 * The raw table object is cast via `any` because DatabaseSchema predates these
 * fields; the actual runtime data always carries them from a live DB connection.
 */
export function parseInternalSchema(schema: DatabaseSchema): NormalizedSchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tables: ParsedTable[] = schema.tables.map((t: any) => {
    // Collect non-primary unique columns and indexed columns from indexes & constraints
    const uniqueCols = new Set<string>()
    const indexedCols = new Set<string>()

    if (Array.isArray(t.indexes)) {
      t.indexes.forEach((idx: IndexInfo) => {
        if (!idx.primary) {
          idx.columns.forEach((colName) => {
            indexedCols.add(colName)
            if (idx.unique) {
              uniqueCols.add(colName)
            }
          })
        }
      })
    }

    if (Array.isArray(t.constraints)) {
      t.constraints.forEach((c: ConstraintInfo) => {
        if (c.type?.toUpperCase().includes('UNIQUE') && c.column) {
          uniqueCols.add(c.column)
          indexedCols.add(c.column)
        }
      })
    }

    return {
      id: t.id,
      name: t.name,
      columns: t.columns.map((c: Column) => {
        const pk = Boolean(c.pk)
        const fk = Boolean(c.fk)
        const isUq = !pk && uniqueCols.has(c.name)
        const isIdx = !pk && !isUq && indexedCols.has(c.name)

        return {
          name: c.name,
          dataType: c.type,
          nullable: c.nullable ?? true,
          primaryKey: pk,
          foreignKey: fk,
          references: c.fk ? { table: c.fk.table, column: c.fk.column } : undefined,
          isUnique: isUq,
          isIndexed: isIdx,
        }
      }),
      // ── Milestone 4: pass through if present (live DB connections) ──────
      primaryKeys: t.primaryKeys,
      foreignKeys: t.foreignKeys,
      indexes: t.indexes,
      constraints: t.constraints,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relationships: ParsedRelationship[] = schema.relationships.map((r: any) => ({
    id: r.id,
    sourceTable: r.from.table,
    sourceColumn: r.from.column,
    targetTable: r.to.table,
    targetColumn: r.to.column,
    cardinality: r.cardinality,
    constraintName: r.constraintName || r.id,
  }))

  return {
    databaseName: schema.name,
    databaseType: schema.type,
    tables,
    relationships,
  }
}

/**
 * Parse the "API-spec" backend JSON format (as described in the project spec)
 * into NormalizedSchema. Use this when consuming raw /api/schema output.
 */
export interface ApiSchemaColumn {
  name: string
  dataType: string
  nullable?: boolean
  primaryKey?: boolean
  foreignKey?: boolean
}

export interface ApiSchemaForeignKey {
  column: string
  references: { table: string; column: string }
}

export interface ApiSchemaTable {
  name: string
  columns: ApiSchemaColumn[]
  primaryKeys?: string[]
  foreignKeys?: ApiSchemaForeignKey[]
  indexes?: IndexInfo[]
  constraints?: ConstraintInfo[]
}

export interface ApiSchemaRelationship {
  sourceTable: string
  sourceColumn: string
  targetTable: string
  targetColumn: string
  type?: string
}

export interface ApiSchema {
  database?: { name?: string; type?: string }
  tables: ApiSchemaTable[]
  relationships?: ApiSchemaRelationship[]
}

export function parseApiSchema(raw: ApiSchema): NormalizedSchema {
  const tables: ParsedTable[] = raw.tables.map((t) => {
    // Build a lookup of FK references from the foreignKeys array
    const fkMap = new Map<string, { table: string; column: string }>()
    ;(t.foreignKeys ?? []).forEach((fk) => {
      fkMap.set(fk.column, fk.references)
    })

    const pkSet = new Set<string>(t.primaryKeys ?? [])

    const uniqueCols = new Set<string>()
    const indexedCols = new Set<string>()

    if (Array.isArray(t.indexes)) {
      t.indexes.forEach((idx: IndexInfo) => {
        if (!idx.primary) {
          idx.columns.forEach((colName) => {
            indexedCols.add(colName)
            if (idx.unique) {
              uniqueCols.add(colName)
            }
          })
        }
      })
    }

    if (Array.isArray(t.constraints)) {
      t.constraints.forEach((c: ConstraintInfo) => {
        if (c.type?.toUpperCase().includes('UNIQUE') && c.column) {
          uniqueCols.add(c.column)
          indexedCols.add(c.column)
        }
      })
    }

    const columns: ParsedColumn[] = t.columns.map((c) => {
      const pk = c.primaryKey ?? pkSet.has(c.name)
      const fk = c.foreignKey ?? fkMap.has(c.name)
      const isUq = !pk && uniqueCols.has(c.name)
      const isIdx = !pk && !isUq && indexedCols.has(c.name)

      return {
        name: c.name,
        dataType: c.dataType,
        nullable: c.nullable ?? true,
        primaryKey: pk,
        foreignKey: fk,
        references: fkMap.get(c.name),
        isUnique: isUq,
        isIndexed: isIdx,
      }
    })

    return {
      id: t.name.toLowerCase().replace(/\s+/g, '_'),
      name: t.name,
      columns,
      // ── Milestone 4: forward structured arrays if present ────────────
      primaryKeys: t.primaryKeys,
      foreignKeys: t.foreignKeys as ForeignKeyInfo[] | undefined,
      indexes: t.indexes,
      constraints: t.constraints,
    }
  })

  const relationships: ParsedRelationship[] = (raw.relationships ?? []).map((r, i) => ({
    id: `rel_${i}`,
    sourceTable: r.sourceTable,
    sourceColumn: r.sourceColumn,
    targetTable: r.targetTable,
    targetColumn: r.targetColumn,
    cardinality: normalizeCardinality(r.type),
    constraintName: (r as any).constraintName || `rel_${i}`,
  }))

  return {
    databaseName: raw.database?.name ?? 'database',
    databaseType: raw.database?.type ?? 'unknown',
    tables,
    relationships,
  }
}

/** Convert verbose relationship type strings to short cardinality labels */
function normalizeCardinality(type?: string): string | undefined {
  if (!type) return undefined
  const t = type.toLowerCase()
  if (t.includes('one-to-one') || t.includes('1:1')) return '1:1'
  if (t.includes('many-to-many') || t.includes('n:m') || t.includes('m:n')) return 'N:M'
  if (t.includes('many-to-one') || t.includes('n:1')) return 'N:1'
  if (t.includes('one-to-many') || t.includes('1:n')) return '1:N'
  return type
}
