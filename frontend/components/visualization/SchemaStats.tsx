'use client'

/**
 * SchemaStats.tsx  (visualization/SchemaStats)
 *
 * Structural statistics panel showing FULL schema metrics
 * (never the filtered subset). Uses computeSchemaAnalytics
 * which relies ONLY on declared FK edges (never R003 overlays).
 *
 * Shows: tables, columns, declared FKs, PKs, indexes,
 * most connected, most referenced, isolated tables.
 */

import { useMemo, useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Columns3,
  Database,
  KeyRound,
  Link2,
  List,
  Table2,
  Unlink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NormalizedSchema } from '@/lib/schema/schemaParser'
import { computeSchemaAnalytics, type SchemaAnalytics } from '@/lib/schema/schemaAnalytics'

type Props = {
  schema: NormalizedSchema
  /** Number of currently visible tables (after filters) */
  visibleTableCount?: number
}

export function SchemaStats({ schema, visibleTableCount }: Props) {
  const [expanded, setExpanded] = useState(false)

  const analytics = useMemo(() => computeSchemaAnalytics(schema), [schema])

  const primaryStats = [
    {
      icon: Table2,
      label: 'Tables',
      value: analytics.tableCount,
      tooltip: 'Total tables in schema',
    },
    {
      icon: Columns3,
      label: 'Columns',
      value: analytics.columnCount,
      tooltip: 'Total columns across all tables',
    },
    {
      icon: Link2,
      label: 'FKs',
      value: analytics.declaredFKCount,
      tooltip: 'Declared foreign key relationships',
    },
    {
      icon: KeyRound,
      label: 'PKs',
      value: analytics.tablesWithPK,
      tooltip: 'Tables with primary keys',
    },
    {
      icon: List,
      label: 'Indexes',
      value: analytics.indexDefinitionCount,
      tooltip: 'Index definitions (including PRIMARY)',
    },
  ]

  const showFilterIndicator =
    visibleTableCount !== undefined && visibleTableCount < analytics.tableCount

  return (
    <div
      data-testid="schema-stats"
      className="rounded-xl border border-border bg-frost shadow-sm backdrop-blur-md"
    >
      {/* Primary stat row */}
      <div className="flex items-center gap-3 px-3.5 py-2 text-[11px]">
        {primaryStats.map(({ icon: Icon, label, value, tooltip }) => (
          <span
            key={label}
            className="flex items-center gap-1 text-muted-foreground"
            title={tooltip}
          >
            <Icon className="h-3 w-3 text-primary" />
            <span className="font-mono font-semibold text-foreground">{value}</span>
            <span className="hidden sm:inline">{label}</span>
          </span>
        ))}
        {showFilterIndicator && (
          <span
            className="text-[10px] text-muted-foreground"
            title={`Showing ${visibleTableCount} of ${analytics.tableCount} tables (filters active)`}
          >
            ({visibleTableCount}/{analytics.tableCount} shown)
          </span>
        )}
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="ml-auto rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={expanded ? 'Collapse details' : 'Expand details'}
          data-testid="stats-expand-toggle"
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <div
          className="border-t border-border/60 px-3.5 py-2 text-[11px] space-y-1.5 animate-in slide-in-from-top-1 duration-150"
          data-testid="stats-detail"
        >
          {/* Most Connected */}
          {analytics.mostConnected.length > 0 && (
            <div className="flex items-start gap-1.5">
              <BarChart3 className="h-3 w-3 mt-0.5 text-primary shrink-0" />
              <div>
                <span className="text-muted-foreground">Most connected: </span>
                <span className="font-semibold text-foreground">
                  {analytics.mostConnected.map((d) => d.tableName).join(', ')}
                </span>
                <span className="text-muted-foreground ml-1">
                  (degree {analytics.mostConnected[0].totalDegree}{analytics.mostConnected.length > 1 ? ' each' : ''})
                </span>
              </div>
            </div>
          )}

          {/* Most Referenced */}
          {analytics.mostReferenced.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Database className="h-3 w-3 mt-0.5 text-link shrink-0" />
              <div>
                <span className="text-muted-foreground">Most referenced: </span>
                <span className="font-semibold text-foreground">
                  {analytics.mostReferenced.map((d) => d.tableName).join(', ')}
                </span>
                <span className="text-muted-foreground ml-1">
                  ({analytics.mostReferenced[0].inDegree} incoming{analytics.mostReferenced.length > 1 ? ' each' : ''})
                </span>
              </div>
            </div>
          )}

          {/* Isolated Tables */}
          {analytics.isolatedTables.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Unlink className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
              <div>
                <span className="text-muted-foreground">Isolated in FK graph: </span>
                <span className="font-semibold text-foreground">
                  {analytics.isolatedTables.map((d) => d.tableName).join(', ')}
                </span>
                <span className="text-muted-foreground ml-1">
                  ({analytics.isolatedTables.length})
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
