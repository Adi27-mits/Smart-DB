/**
 * graphBuilder.ts
 *
 * Converts a NormalizedSchema into React Flow nodes and edges.
 * Positions are set to (0, 0) initially; autoLayout.ts will assign real positions.
 */

import type { Node, Edge, MarkerType } from '@xyflow/react'
import type { NormalizedSchema, ParsedTable, ParsedRelationship } from './schemaParser'

/** Data stored inside each React Flow table node */
export interface TableNodeData {
  table: ParsedTable
  /** Runtime state – set by the canvas, not here */
  state?: 'normal' | 'active' | 'related' | 'dimmed'
  onSelect?: (id: string) => void
  onColumnClick?: (tableId: string, column: string) => void
  activeColumn?: string | null
  highlightColumns?: Set<string>
  /** Count of all declared relationships involving this table */
  relationshipsCount?: number
  inboundCount?: number
  outboundCount?: number
  /** Health analysis findings for this table */
  healthIssuesCount?: number
  highestSeverity?: 'HIGH' | 'MEDIUM' | 'LOW' | null
  [key: string]: unknown
}

/** Data stored on each React Flow edge */
export interface RelEdgeData {
  cardinality?: string
  sourceTable: string
  sourceColumn: string
  targetTable: string
  targetColumn: string
  constraintName?: string
  isHeuristic?: boolean
  ruleId?: string
  title?: string
  evidence?: string
  recommendation?: string
  severity?: string
  [key: string]: unknown
}

export const TABLE_NODE_TYPE = 'tableNode'
export const REL_EDGE_TYPE = 'relEdge'

/**
 * Build React Flow nodes from the parsed tables.
 * Precomputes relationship counts for collapsed summaries.
 * All nodes are placed at (0, 0) — autoLayout assigns real positions.
 */
export function buildNodes(
  tables: ParsedTable[],
  relationships: ParsedRelationship[] = []
): Node<TableNodeData>[] {
  const relCountMap = new Map<string, { total: number; in: number; out: number }>()
  tables.forEach((t) => relCountMap.set(t.id, { total: 0, in: 0, out: 0 }))

  relationships.forEach((r) => {
    const src = relCountMap.get(r.sourceTable)
    if (src) {
      src.total += 1
      src.out += 1
    }
    const tgt = relCountMap.get(r.targetTable)
    if (tgt) {
      tgt.total += 1
      tgt.in += 1
    }
  })

  return tables.map((table) => {
    const rels = relCountMap.get(table.id) || { total: 0, in: 0, out: 0 }
    return {
      id: table.id,
      type: TABLE_NODE_TYPE,
      position: { x: 0, y: 0 },
      data: {
        table,
        relationshipsCount: rels.total,
        inboundCount: rels.in,
        outboundCount: rels.out,
      },
      draggable: true,
      selectable: true,
    }
  })
}

/**
 * Build React Flow edges from the parsed relationships.
 */
export function buildEdges(schema: NormalizedSchema): Edge<RelEdgeData>[] {
  return schema.relationships.map((rel) => {
    const edgeId = `edge-${rel.id}`
    return {
      id: edgeId,
      source: rel.sourceTable,
      target: rel.targetTable,
      type: REL_EDGE_TYPE,
      data: {
        cardinality: rel.cardinality,
        sourceTable: rel.sourceTable,
        sourceColumn: rel.sourceColumn,
        targetTable: rel.targetTable,
        targetColumn: rel.targetColumn,
        constraintName: rel.constraintName || rel.id,
      },
      markerEnd: {
        type: 'arrowclosed' as MarkerType,
        width: 14,
        height: 14,
      },
      animated: false,
      selectable: true,
    }
  })
}

/**
 * Build both nodes and edges in one call.
 */
export function buildGraph(schema: NormalizedSchema): {
  nodes: Node<TableNodeData>[]
  edges: Edge<RelEdgeData>[]
} {
  return {
    nodes: buildNodes(schema.tables, schema.relationships),
    edges: buildEdges(schema),
  }
}
