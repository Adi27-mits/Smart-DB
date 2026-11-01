'use client'

/**
 * TableNode.tsx  (visualization/TableNode)
 *
 * A React Flow custom node that renders a single database table as a
 * professional card showing columns, data types, PK/FK/UQ/IDX indicators,
 * nullability, and collapsible behavior preserving coordinates.
 */

import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { ChevronDown, KeyRound, Link2, Table2, AlertCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TableNodeData } from '@/lib/schema/graphBuilder'

type Props = {
  id: string
  data: TableNodeData
  selected?: boolean
}

function TableNodeComponent({ id, data, selected }: Props) {
  const {
    table,
    state = 'normal',
    activeColumn,
    highlightColumns,
    relationshipsCount = 0,
    healthIssuesCount = 0,
    highestSeverity = null,
    onSelect,
    onColumnClick,
  } = data

  const [isCollapsed, setIsCollapsed] = useState(false)

  const isActive = state === 'active' || selected
  const isDimmed = state === 'dimmed'
  const isRelated = state === 'related'

  const pkColumns = table.columns.filter((c) => c.primaryKey)

  return (
    <div
      data-state={state}
      className={cn(
        'w-[270px] select-none rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200',
        isActive && 'border-primary shadow-xl shadow-primary/20 ring-2 ring-primary/50',
        isRelated && 'border-link/70 shadow-md ring-1 ring-link/40 bg-card/95',
        !isActive && !isRelated && !isDimmed && 'border-border hover:border-border/80 hover:shadow-md',
        isDimmed && 'border-border/50 opacity-45',
      )}
      role="group"
      aria-label={`Table ${table.name}`}
    >
      {/* Handles fixed at header vertical center (top: 21px) so edge anchors remain stable */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!border-border !bg-card"
        style={{ top: 21, visibility: 'hidden' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!border-border !bg-card"
        style={{ top: 21, visibility: 'hidden' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        className="!border-border !bg-card"
        style={{ top: 21, visibility: 'hidden' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        className="!border-border !bg-card"
        style={{ top: 21, visibility: 'hidden' }}
      />

      {/* Header – acts as drag handle via React Flow's built-in drag */}
      <div
        onClick={() => onSelect?.(id)}
        className={cn(
          'flex h-[42px] w-full cursor-grab items-center gap-2 px-3 text-left font-mono text-sm font-semibold tracking-tight active:cursor-grabbing',
          isCollapsed ? 'rounded-xl' : 'rounded-t-xl',
          isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
        )}
      >
        <Table2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="truncate uppercase tracking-wide text-[12px]" title={table.name}>
          {table.name}
        </span>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {/* Health issue indicator badge */}
          {healthIssuesCount > 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none border shrink-0',
                highestSeverity === 'HIGH' && 'border-destructive/40 bg-destructive/15 text-destructive',
                highestSeverity === 'MEDIUM' && 'border-amber-500/40 bg-amber-500/15 text-amber-500',
                highestSeverity === 'LOW' && 'border-sky-500/40 bg-sky-500/15 text-sky-500',
                !highestSeverity && 'border-amber-500/40 bg-amber-500/15 text-amber-500',
                isActive && 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30',
              )}
              title={`${healthIssuesCount} health issue${healthIssuesCount === 1 ? '' : 's'} (Highest: ${highestSeverity || 'INFO'})`}
              data-testid="table-health-badge"
              data-table-id={id}
              data-severity={highestSeverity}
              data-issue-count={healthIssuesCount}
            >
              {highestSeverity === 'HIGH' ? (
                <AlertCircle className="h-2.5 w-2.5" />
              ) : (
                <AlertTriangle className="h-2.5 w-2.5" />
              )}
              <span>{healthIssuesCount}</span>
            </span>
          )}

          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
              isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background/80 text-muted-foreground',
            )}
            title={`${table.columns.length} columns`}
          >
            {table.columns.length}
          </span>

          {/* Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsCollapsed((prev) => !prev)
            }}
            aria-label={isCollapsed ? 'Expand table columns' : 'Collapse table columns'}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
              isActive
                ? 'hover:bg-primary-foreground/20 text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground',
            )}
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200',
                isCollapsed && '-rotate-90',
              )}
            />
          </button>
        </div>
      </div>

      {/* Collapsed State Summary */}
      {isCollapsed && (
        <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground border-t border-border/50 bg-muted/20 rounded-b-xl">
          <span className="truncate">
            {pkColumns.length > 0
              ? `PK: ${pkColumns.map((c) => c.name).join(', ')}`
              : 'No primary key'}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/80 pl-2">
            {relationshipsCount} rel{relationshipsCount === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Expanded State: Column List */}
      {!isCollapsed && (
        <ul className="max-h-[340px] overflow-y-auto nowheel nodrag divide-y divide-border/60">
          {table.columns.map((col) => {
            const isActiveCol = activeColumn === col.name
            const isHighlighted = highlightColumns?.has(col.name)

            const tooltipParts = [
              `${col.name}: ${col.dataType}`,
              col.nullable ? 'NULL' : 'NOT NULL',
              col.primaryKey ? 'PRIMARY KEY' : null,
              col.foreignKey && col.references
                ? `REFERENCES ${col.references.table}.${col.references.column}`
                : col.foreignKey
                  ? 'FOREIGN KEY'
                  : null,
              col.isUnique ? 'UNIQUE' : null,
              col.isIndexed ? 'INDEXED' : null,
            ].filter(Boolean)

            return (
              <li key={col.name} data-testid="column-row">
                <button
                  type="button"
                  data-column-name={col.name}
                  data-active-column={isActiveCol ? 'true' : 'false'}
                  onClick={() => onColumnClick?.(id, col.name)}
                  title={tooltipParts.join(' • ')}
                  className={cn(
                    'flex h-[32px] w-full items-center gap-1.5 px-3 text-left font-mono text-[12px] transition-colors hover:bg-accent/60',
                    isActiveCol && 'bg-primary/20 font-semibold text-primary ring-1 ring-primary/40 rounded-sm',
                    !isActiveCol && isHighlighted && 'bg-accent font-medium',
                  )}
                >
                  {/* Left Indicators */}
                  <div className="flex items-center gap-1 shrink-0 min-w-[28px]">
                    {col.primaryKey && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 leading-tight"
                        title="Primary Key"
                      >
                        <KeyRound className="h-2.5 w-2.5" />
                        PK
                      </span>
                    )}
                    {col.foreignKey && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 leading-tight"
                        title={
                          col.references
                            ? `Foreign Key -> ${col.references.table}.${col.references.column}`
                            : 'Foreign Key'
                        }
                      >
                        <Link2 className="h-2.5 w-2.5" />
                        FK
                      </span>
                    )}
                    {col.isUnique && !col.primaryKey && (
                      <span
                        className="inline-flex items-center rounded px-1 py-0.2 text-[9px] font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 leading-tight"
                        title="Unique Index / Constraint"
                      >
                        UQ
                      </span>
                    )}
                    {col.isIndexed && !col.primaryKey && !col.isUnique && (
                      <span
                        className="inline-flex items-center rounded px-1 py-0.2 text-[9px] font-semibold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30 leading-tight"
                        title="Indexed"
                      >
                        IDX
                      </span>
                    )}
                  </div>

                  {/* Column Name */}
                  <span
                    className={cn(
                      'truncate text-[11.5px]',
                      col.primaryKey && 'font-semibold text-foreground',
                      !col.primaryKey && 'text-foreground/90',
                    )}
                  >
                    {col.name}
                  </span>

                  {/* Right: Nullability & Data Type */}
                  <div className="ml-auto flex items-center gap-1.5 pl-2 shrink-0">
                    {!col.nullable && (
                      <span
                        className="text-[9px] font-mono text-muted-foreground/70"
                        title="Not Null"
                      >
                        NN
                      </span>
                    )}
                    <span className="truncate text-[10px] text-muted-foreground/80 font-mono">
                      {col.dataType}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export const TableNode = memo(TableNodeComponent)
