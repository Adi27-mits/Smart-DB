'use client'

/**
 * RelationshipEdge.tsx  (visualization/RelationshipEdge)
 *
 * A React Flow custom edge that renders a styled bezier curve with:
 * - Direction arrow marker at target end
 * - Verified cardinality label (e.g. 1:1, N:1) only when present
 * - Selected / active / dimmed states
 * - Interaction area for easy clickability
 */

import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Position } from '@xyflow/react'
import type { RelEdgeData } from '@/lib/schema/graphBuilder'

type Props = {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  data?: RelEdgeData
  selected?: boolean
  markerEnd?: string
  style?: React.CSSProperties
}

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style,
}: Props) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isActive = selected

  const isHeuristic = Boolean(data?.isHeuristic)

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={24}
        style={{
          stroke: isHeuristic
            ? isActive
              ? '#d97706'
              : '#f59e0b'
            : isActive
              ? 'var(--color-link, #3b82f6)'
              : 'color-mix(in oklch, var(--color-muted-foreground, #888) 55%, transparent)',
          strokeWidth: isActive ? 2.5 : isHeuristic ? 2 : 1.5,
          strokeDasharray: isHeuristic ? '6 4' : undefined,
          transition: 'stroke 0.15s, stroke-width 0.15s, opacity 0.15s',
          ...style,
        }}
      />

      {/* Cardinality badge — strictly shown ONLY when verified metadata exists */}
      {data?.cardinality && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              opacity: style?.opacity !== undefined ? style.opacity : 1,
              transition: 'opacity 0.15s',
            }}
            className="nodrag nopan"
          >
            <span
              data-testid={isHeuristic ? 'heuristic-badge' : 'edge-cardinality-badge'}
              className={`
                inline-flex items-center rounded-md border px-1.5 py-0.5
                text-[10px] font-semibold leading-none cursor-pointer
                transition-all duration-150 hover:scale-105
                ${
                  isHeuristic
                    ? isActive
                      ? 'border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                      : 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium'
                    : isActive
                      ? 'border-link bg-link text-link-foreground shadow-sm shadow-link/25 font-mono'
                      : 'border-border/80 bg-card text-muted-foreground hover:border-link/60 hover:text-foreground font-mono'
                }
              `}
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
              title={
                isHeuristic
                  ? `Heuristic recommendation: ${data.sourceTable}.${data.sourceColumn} -> ${data.targetTable}.${data.targetColumn}`
                  : `Relationship cardinality: ${data.cardinality}`
              }
            >
              {data.cardinality}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const RelationshipEdge = memo(RelationshipEdgeComponent)
