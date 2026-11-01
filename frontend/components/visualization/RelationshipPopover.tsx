'use client'

/**
 * RelationshipPopover.tsx  (visualization/RelationshipPopover)
 *
 * A compact floating inspector popover that displays detailed metadata for
 * a clicked declared foreign key relationship:
 * - Source table & column
 * - Target table & column
 * - Constraint name
 * - Relationship type (Declared Foreign Key)
 * - Verified cardinality
 */

import { memo } from 'react'
import { ArrowRight, Link2, X, AlertTriangle } from 'lucide-react'
import type { RelEdgeData } from '@/lib/schema/graphBuilder'

type Props = {
  edge: RelEdgeData
  onClose: () => void
}

function RelationshipPopoverComponent({ edge, onClose }: Props) {
  const {
    sourceTable,
    sourceColumn,
    targetTable,
    targetColumn,
    constraintName,
    cardinality,
    isHeuristic,
    ruleId,
    recommendation,
    severity,
  } = edge

  const cardinalityLabel =
    cardinality === 'N:1'
      ? 'Many-to-One (N:1)'
      : cardinality === '1:1'
        ? 'One-to-One (1:1)'
        : cardinality === '1:N'
          ? 'One-to-Many (1:N)'
          : cardinality === 'N:M'
            ? 'Many-to-Many (N:M)'
            : cardinality || 'Not specified'

  return (
    <div
      role="dialog"
      aria-label="Relationship Details"
      data-testid="relationship-popover"
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[380px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-card/95 text-card-foreground p-3.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-md ${
              isHeuristic ? 'bg-amber-500/15 text-amber-500' : 'bg-link/15 text-link'
            }`}
          >
            {isHeuristic ? <AlertTriangle className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          </div>
          <div>
            <h3 data-testid="popover-title" className="text-xs font-semibold leading-none">
              {isHeuristic ? 'Possible Missing Foreign Key' : 'Declared Foreign Key'}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate max-w-[240px]">
              {isHeuristic ? 'R003 • Heuristic Recommendation' : constraintName || 'Foreign Key Constraint'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close relationship details"
          data-testid="popover-close"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Relationship Flow Visual */}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/40 p-2 text-xs font-mono">
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {isHeuristic ? 'Source Column' : 'Source (FK)'}
          </div>
          <div data-testid="popover-source" className="truncate font-semibold text-foreground">
            {sourceTable}.<span className={isHeuristic ? 'text-amber-500' : 'text-link'}>{sourceColumn}</span>
          </div>
        </div>

        <div className="mx-2 flex shrink-0 items-center justify-center text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1 text-right">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {isHeuristic ? 'Candidate PK' : 'Target (PK)'}
          </div>
          <div data-testid="popover-target" className="truncate font-semibold text-foreground">
            {targetTable}.<span className="text-primary">{targetColumn}</span>
          </div>
        </div>
      </div>

      {/* Metadata Attributes */}
      <div className="mt-3 space-y-1.5 text-[11px]">
        {isHeuristic ? (
          <>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Rule Identifier</span>
              <span className="font-mono text-foreground font-semibold text-[11px]">{ruleId || 'R003'}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Severity</span>
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                {severity || 'MEDIUM'}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Status</span>
              <span data-testid="popover-status" className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Possible / Not Declared
              </span>
            </div>
            {recommendation && (
              <div className="mt-2.5 rounded-lg border border-border/80 bg-muted/30 p-2 text-[11px] leading-relaxed text-foreground">
                <p className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider">Recommendation</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{recommendation}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Constraint Name</span>
              <span className="font-mono text-foreground select-all text-[11px] truncate max-w-[180px]">
                {constraintName || 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span>Cardinality</span>
              <span className="inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                {cardinalityLabel}
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground">
              <span>Status</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Confirmed in Schema
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export const RelationshipPopover = memo(RelationshipPopoverComponent)
