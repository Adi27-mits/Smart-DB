'use client'

/**
 * SchemaLegend.tsx  (visualization/SchemaLegend)
 *
 * Enhanced collapsible legend explaining visual elements in the schema diagram:
 * - Column badges: PK, FK, UQ, IDX
 * - Edge types: solid declared, dashed possible (R003)
 * - Selected/related table highlights
 * - Severity indicators: HIGH, MEDIUM, LOW
 *
 * Matches actual visualization styles used in TableNode, RelationshipEdge,
 * and healthOverlay.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, KeyRound, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  /** Whether health overlay is available (show severity legend items) */
  hasHealthData?: boolean
}

export function SchemaLegend({ hasHealthData = false }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      data-testid="schema-legend"
      className="rounded-xl border border-border bg-frost shadow-sm backdrop-blur-md"
    >
      {/* Header with collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="flex w-full items-center justify-between px-3.5 py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        data-testid="legend-toggle"
      >
        <span className="font-semibold">Legend</span>
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-border/60 px-3.5 py-2 text-[11px] space-y-2 animate-in slide-in-from-top-1 duration-150">
          {/* Column Badges */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Column Badges
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-flex items-center gap-0.5 rounded bg-key/15 px-1 py-0.5 text-[9px] font-bold text-key">
                  <KeyRound className="h-2.5 w-2.5" />
                  PK
                </span>
                Primary Key
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-flex items-center gap-0.5 rounded bg-link/15 px-1 py-0.5 text-[9px] font-bold text-link">
                  <Link2 className="h-2.5 w-2.5" />
                  FK
                </span>
                Foreign Key
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-flex rounded bg-purple-500/15 px-1 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-400">
                  UQ
                </span>
                Unique
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-flex rounded bg-cyan-500/15 px-1 py-0.5 text-[9px] font-bold text-cyan-600 dark:text-cyan-400">
                  IDX
                </span>
                Indexed
              </span>
            </div>
          </div>

          {/* Edge Types */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Relationships
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <svg width="28" height="8" className="shrink-0">
                  <line
                    x1="0" y1="4" x2="28" y2="4"
                    stroke="var(--color-link, #3b82f6)"
                    strokeWidth="2"
                  />
                </svg>
                Declared FK
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <svg width="28" height="8" className="shrink-0">
                  <line
                    x1="0" y1="4" x2="28" y2="4"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                </svg>
                Possible FK / Not Declared
              </span>
            </div>
          </div>

          {/* Severity Indicators (shown when health data is available) */}
          {hasHealthData && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Health Severity
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
                  HIGH
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
                  MEDIUM
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                  LOW
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
