/**
 * autoLayout.ts
 *
 * Uses Dagre to auto-arrange React Flow nodes so database tables don't overlap.
 * Uses node-size-aware positioning based on actual measured DOM dimensions
 * when available, falling back to exact component design metrics.
 * Returns new nodes with updated top-left positions.
 */

import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'
import type { DatabaseSchema } from '../schema'

/** Verified pixel dimensions of TableNode component */
export const NODE_WIDTH = 272              // 270px width + 2px border
export const HEADER_HEIGHT = 42            // table header height
export const ROW_HEIGHT = 32               // per column row height
export const MAX_COLUMN_LIST_HEIGHT = 340  // max-h-[340px] scrollable list
export const COLLAPSED_HEIGHT = 73         // 42px header + 29px summary + 2px border
export const BORDER_TOTAL = 2

/** Spacing configuration */
export const RANK_SEP = 100                // Separation between ranks (horizontal gap in LR, vertical gap in TB)
export const NODE_SEP = 60                 // Separation between sibling nodes within the same rank
export const MARGIN_X = 40
export const MARGIN_Y = 40

/**
 * Determine node width:
 * 1. React Flow measured width (if measured by DOM)
 * 2. Explicit node.width
 * 3. Fallback constant (272px)
 */
export function getNodeWidth(node: Node): number {
  if (node.measured?.width && node.measured.width > 0) {
    return node.measured.width
  }
  if (typeof node.width === 'number' && node.width > 0) {
    return node.width
  }
  return NODE_WIDTH
}

/**
 * Determine node height:
 * 1. React Flow measured height (if measured by DOM — captures live collapsed/expanded state)
 * 2. Explicit node.height
 * 3. Fallback calculation based on TableNode design (respecting collapse and max-height cap)
 */
export function getNodeHeight(node: Node): number {
  if (node.measured?.height && node.measured.height > 0) {
    return node.measured.height
  }
  if (typeof node.height === 'number' && node.height > 0) {
    return node.height
  }

  // Fallback calculation from component design
  const data = node.data as Record<string, unknown> | undefined
  if (data?.isCollapsed) {
    return COLLAPSED_HEIGHT
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colCount = (data?.table as any)?.columns?.length ?? 4
  const columnListHeight = Math.min(colCount * ROW_HEIGHT, MAX_COLUMN_LIST_HEIGHT)
  return HEADER_HEIGHT + columnListHeight + BORDER_TOTAL
}

/**
 * Run Dagre layout on the provided nodes and edges.
 * Returns a new array of nodes with updated `position` values.
 *
 * @param nodes - React Flow nodes
 * @param edges - React Flow declared relationship edges
 * @param direction - Layout direction: 'LR' (Left-to-Right) or 'TB' (Top-to-Bottom)
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR',
): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: MARGIN_X,
    marginy: MARGIN_Y,
  })

  // Track per-node dimensions for exact center-to-top-left conversion
  const dims = new Map<string, { width: number; height: number }>()

  nodes.forEach((node) => {
    const width = getNodeWidth(node)
    const height = getNodeHeight(node)
    dims.set(node.id, { width, height })
    g.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    const d = dims.get(node.id) ?? { width: NODE_WIDTH, height: getNodeHeight(node) }

    // Dagre gives center coordinates; React Flow uses top-left coordinates:
    // x = dagreX - width / 2
    // y = dagreY - height / 2
    return {
      ...node,
      position: {
        x: pos.x - d.width / 2,
        y: pos.y - d.height / 2,
      },
    }
  })
}

/**
 * Derive a stable topology signature representing the database and its
 * structural layout-relevant shape.
 *
 * Includes:
 * - database name and engine type (to prevent collision across different DBs with same table names)
 * - sorted table names with their column counts (to detect dimension-affecting schema changes)
 * - sorted declared relationship endpoints
 *
 * Excludes:
 * - positions {x, y}
 * - selection state
 * - collapse state
 * - zoom / pan
 * - health badges
 * - credentials
 */
export function getTopologySignature(schema: DatabaseSchema | null): string {
  if (!schema) return ''
  const dbName = schema.name || 'db'
  const dbType = schema.type || 'unknown'
  const tableSignatures = (schema.tables || [])
    .map((t) => `${t.id}:${t.columns?.length ?? 0}`)
    .sort()
    .join(';')
  const relSignatures = (schema.relationships || [])
    .map((r) => `${r.from.table}.${r.from.column}->${r.to.table}.${r.to.column}`)
    .sort()
    .join(';')
  return `${dbName}:${dbType}[${tableSignatures}]#(${relSignatures})`
}

