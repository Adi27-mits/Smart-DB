/**
 * schemaAnalytics.ts — Pure structural schema analytics
 *
 * Computes degree metrics, most-connected / most-referenced tables,
 * isolated tables, and structural summaries from ONLY the declared
 * foreign-key relationships in the NormalizedSchema.
 *
 * R003 heuristic overlay edges are NEVER included in any calculation.
 * This is intentional: R003 edges are health recommendations, not
 * confirmed structural relationships.
 */

import type { NormalizedSchema, ParsedRelationship } from './schemaParser'

/** Per-table degree info */
export interface TableDegree {
  tableId: string
  tableName: string
  /** inbound FK references (this table is the target) */
  inDegree: number
  /** outbound FK references (this table is the source) */
  outDegree: number
  /** total = inDegree + outDegree */
  totalDegree: number
}

/** Computed schema analytics result */
export interface SchemaAnalytics {
  /** Total number of tables */
  tableCount: number
  /** Total number of columns across all tables */
  columnCount: number
  /** Number of tables that have at least one primary key column */
  tablesWithPK: number
  /** Total declared foreign key relationships */
  declaredFKCount: number
  /** Number of index definitions (one per index, not per indexed column) */
  indexDefinitionCount: number
  /** Per-table degree breakdown, sorted by totalDegree descending */
  degrees: TableDegree[]
  /** Table(s) with the highest total degree (may be multiple in case of tie) */
  mostConnected: TableDegree[]
  /** Table(s) with the highest inDegree (most referenced, may be multiple on tie) */
  mostReferenced: TableDegree[]
  /** Tables with zero declared FK connections (totalDegree === 0) */
  isolatedTables: TableDegree[]
}

/**
 * Compute structural analytics from a NormalizedSchema.
 *
 * Uses ONLY declared relationships — never R003 heuristic overlays.
 */
export function computeSchemaAnalytics(schema: NormalizedSchema): SchemaAnalytics {
  const { tables, relationships } = schema

  // ── Basic counts ─────────────────────────────────────────────────────────
  const tableCount = tables.length
  const columnCount = tables.reduce((n, t) => n + t.columns.length, 0)
  const tablesWithPK = tables.filter((t) =>
    t.columns.some((c) => c.primaryKey)
  ).length
  const declaredFKCount = relationships.length

  // Index definition count: count each index definition, not each indexed column.
  // PRIMARY indexes ARE included (they're real index definitions).
  let indexDefinitionCount = 0
  for (const table of tables) {
    if (Array.isArray(table.indexes)) {
      indexDefinitionCount += table.indexes.length
    }
  }

  // ── Per-table degree computation (ONLY declared FKs) ─────────────────────
  const degreeMap = new Map<string, { inDegree: number; outDegree: number }>()
  for (const t of tables) {
    degreeMap.set(t.id, { inDegree: 0, outDegree: 0 })
  }

  for (const rel of relationships) {
    const src = degreeMap.get(rel.sourceTable)
    if (src) src.outDegree += 1
    const tgt = degreeMap.get(rel.targetTable)
    if (tgt) tgt.inDegree += 1
  }

  const degrees: TableDegree[] = tables.map((t) => {
    const d = degreeMap.get(t.id) || { inDegree: 0, outDegree: 0 }
    return {
      tableId: t.id,
      tableName: t.name,
      inDegree: d.inDegree,
      outDegree: d.outDegree,
      totalDegree: d.inDegree + d.outDegree,
    }
  })

  // Sort by totalDegree descending, then by tableName ascending for determinism
  degrees.sort((a, b) => {
    if (b.totalDegree !== a.totalDegree) return b.totalDegree - a.totalDegree
    return a.tableName.localeCompare(b.tableName)
  })

  // ── Most connected (highest totalDegree, with tie support) ───────────────
  const maxDegree = degrees.length > 0 ? degrees[0].totalDegree : 0
  const mostConnected = maxDegree > 0
    ? degrees.filter((d) => d.totalDegree === maxDegree)
    : []

  // ── Most referenced (highest inDegree, with tie support) ─────────────────
  const maxInDegree = degrees.length > 0
    ? Math.max(...degrees.map((d) => d.inDegree))
    : 0
  const mostReferenced = maxInDegree > 0
    ? degrees.filter((d) => d.inDegree === maxInDegree)
    : []

  // ── Isolated tables (zero declared FK degree) ────────────────────────────
  const isolatedTables = degrees.filter((d) => d.totalDegree === 0)

  return {
    tableCount,
    columnCount,
    tablesWithPK,
    declaredFKCount,
    indexDefinitionCount,
    degrees,
    mostConnected,
    mostReferenced,
    isolatedTables,
  }
}
