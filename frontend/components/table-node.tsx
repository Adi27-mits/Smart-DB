'use client'

import type React from 'react'
import { KeyRound, Link2, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TableNode } from '@/lib/schema'
import { HEADER_HEIGHT, ROW_HEIGHT, TABLE_WIDTH } from './diagram-constants'

type Props = {
  table: TableNode
  state: 'normal' | 'active' | 'related' | 'dimmed'
  activeColumn?: string | null
  highlightColumns?: Set<string>
  onPointerDownHeader: (e: React.PointerEvent, id: string) => void
  onSelect: (id: string) => void
  onColumnClick: (tableId: string, column: string) => void
}

export function TableNodeCard({
  table,
  state,
  activeColumn,
  highlightColumns,
  onPointerDownHeader,
  onSelect,
  onColumnClick,
}: Props) {
  return (
    <div
      className={cn(
        'absolute select-none rounded-xl border bg-card text-card-foreground shadow-sm backdrop-blur-sm transition-[opacity,box-shadow,transform] duration-200',
        state === 'active' && 'border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/40',
        state === 'related' && 'border-link/60 shadow-md',
        state === 'normal' && 'border-border',
        state === 'dimmed' && 'border-border opacity-35',
      )}
      style={{ left: table.x, top: table.y, width: TABLE_WIDTH }}
      role="group"
      aria-label={`Table ${table.name}`}
    >
      {/* header — drag handle */}
      <button
        type="button"
        onPointerDown={(e) => onPointerDownHeader(e, table.id)}
        onClick={() => onSelect(table.id)}
        className={cn(
          'flex w-full cursor-grab touch-none items-center gap-2 rounded-t-xl px-3 text-left font-mono text-sm font-semibold tracking-tight active:cursor-grabbing',
          state === 'active' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
        )}
        style={{ height: HEADER_HEIGHT }}
      >
        <Table2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{table.name}</span>
        <span
          className={cn(
            'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            state === 'active' ? 'bg-primary-foreground/20' : 'bg-background/60 text-muted-foreground',
          )}
        >
          {table.columns.length}
        </span>
      </button>

      {/* columns */}
      <ul className="divide-y divide-border/70">
        {table.columns.map((col) => {
          const isActiveCol = activeColumn === col.name
          const isHighlighted = highlightColumns?.has(col.name)
          return (
            <li key={col.name}>
              <button
                type="button"
                onClick={() => onColumnClick(table.id, col.name)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 text-left font-mono text-[13px] transition-colors',
                  'hover:bg-accent/60',
                  (isActiveCol || isHighlighted) && 'bg-accent',
                )}
                style={{ height: ROW_HEIGHT }}
              >
                {col.pk ? (
                  <KeyRound className="h-3.5 w-3.5 shrink-0 text-key" aria-label="primary key" />
                ) : col.fk ? (
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-link" aria-label="foreign key" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <span className={cn('truncate', col.pk && 'font-semibold')}>{col.name}</span>
                <span className="ml-auto truncate pl-2 text-[11px] text-muted-foreground">{col.type}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
