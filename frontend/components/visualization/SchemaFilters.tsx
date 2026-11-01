'use client'

/**
 * SchemaFilters.tsx  (visualization/SchemaFilters)
 *
 * Compact filter panel for toggling visualization filters:
 * - Show/hide columns
 * - Show/hide data types
 * - Show/hide relationships
 * - Show only connected tables (tables with at least one declared FK)
 * - Show only tables with health issues
 * - Reset all filters to defaults
 *
 * All filters are local view state:
 * - Zero Dagre runs
 * - Zero API calls
 * - Zero position resets
 */

import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface VisualizationFilters {
  showColumns: boolean
  showDataTypes: boolean
  showRelationships: boolean
  onlyConnected: boolean
  onlyHealthIssues: boolean
}

export const DEFAULT_FILTERS: VisualizationFilters = {
  showColumns: true,
  showDataTypes: true,
  showRelationships: true,
  onlyConnected: false,
  onlyHealthIssues: false,
}

type Props = {
  filters: VisualizationFilters
  onChange: (f: VisualizationFilters) => void
  /** When true, the health-issues filter is disabled (no analysis available) */
  healthDisabled?: boolean
}

export function SchemaFilters({ filters, onChange, healthDisabled = false }: Props) {
  function toggle(key: keyof VisualizationFilters) {
    onChange({ ...filters, [key]: !filters[key] })
  }

  function reset() {
    onChange({ ...DEFAULT_FILTERS })
  }

  // Count active non-default filters
  const activeCount = (Object.keys(DEFAULT_FILTERS) as (keyof VisualizationFilters)[]).reduce(
    (count, key) => (filters[key] !== DEFAULT_FILTERS[key] ? count + 1 : count),
    0,
  )

  const items: { key: keyof VisualizationFilters; label: string; fullLabel: string; disabled?: boolean; title?: string }[] = [
    { key: 'showColumns', label: 'Columns', fullLabel: 'Show Columns' },
    { key: 'showDataTypes', label: 'Types', fullLabel: 'Show Data Types' },
    { key: 'showRelationships', label: 'Edges', fullLabel: 'Show Declared Relationships' },
    { key: 'onlyConnected', label: 'Connected', fullLabel: 'Only Connected Tables' },
    {
      key: 'onlyHealthIssues',
      label: 'Issues',
      fullLabel: 'Only Tables With Health Issues',
      disabled: healthDisabled,
      title: healthDisabled
        ? 'Health analysis not available yet'
        : 'Only Tables With Health Issues',
    },
  ]

  return (
    <div
      data-testid="schema-filters"
      className="flex items-center gap-1 rounded-xl border border-border bg-frost px-2 py-1.5 shadow-md backdrop-blur-md"
    >
      <div className="relative mr-1">
        <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        {activeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </div>
      {items.map(({ key, label, fullLabel, disabled, title }) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          disabled={disabled}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
            disabled
              ? 'cursor-not-allowed opacity-40 text-muted-foreground'
              : filters[key]
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          title={title || fullLabel}
          aria-label={fullLabel}
          data-testid={`filter-${key}`}
        >
          {label}
        </button>
      ))}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={reset}
          className="ml-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Reset Filters"
          aria-label="Reset Filters"
          data-testid="filter-reset"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
