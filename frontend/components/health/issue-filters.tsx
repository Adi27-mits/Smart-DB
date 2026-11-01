'use client'

import React from 'react'
import { Search, X, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SeverityFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'

interface IssueFiltersProps {
  selectedSeverity: SeverityFilter
  onSelectSeverity: (s: SeverityFilter) => void
  severityCounts: {
    ALL: number
    HIGH: number
    MEDIUM: number
    LOW: number
  }

  categories: string[]
  selectedCategory: string
  onSelectCategory: (cat: string) => void
  categoryCounts: Record<string, number>

  tables: string[]
  selectedTable: string
  onSelectTable: (tbl: string) => void
  tableCounts: Record<string, number>

  search: string
  onSearchChange: (q: string) => void

  onResetFilters: () => void
  hasActiveFilters: boolean
}

export function IssueFilters({
  selectedSeverity,
  onSelectSeverity,
  severityCounts,
  categories,
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  tables,
  selectedTable,
  onSelectTable,
  tableCounts,
  search,
  onSearchChange,
  onResetFilters,
  hasActiveFilters,
}: IssueFiltersProps) {
  const severities: SeverityFilter[] = ['ALL', 'HIGH', 'MEDIUM', 'LOW']

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur-md">
      {/* Top row: Search and Reset */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title, table, column, evidence, or recommendation..."
            className="w-full rounded-lg border border-input bg-background/80 py-2 pl-9 pr-8 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Bottom row: Filter Controls */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters:</span>
        </div>

        {/* Severity Tabs */}
        <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5 text-xs font-medium">
          {severities.map((sev) => {
            const count = severityCounts[sev] || 0
            const isSelected = selectedSeverity === sev
            return (
              <button
                key={sev}
                type="button"
                onClick={() => onSelectSeverity(sev)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 transition-all',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{sev === 'ALL' ? 'All' : sev}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px]',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Category Dropdown */}
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background/80 px-2.5 text-xs font-medium text-foreground outline-none transition-colors focus:border-ring focus:ring-1"
          >
            <option value="ALL">All Categories ({categoryCounts['ALL'] || 0})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({categoryCounts[cat] || 0})
              </option>
            ))}
          </select>
        </div>

        {/* Table Dropdown */}
        <div className="relative">
          <select
            value={selectedTable}
            onChange={(e) => onSelectTable(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background/80 px-2.5 text-xs font-medium text-foreground outline-none transition-colors focus:border-ring focus:ring-1"
          >
            <option value="ALL">All Tables ({tableCounts['ALL'] || 0})</option>
            {tables.map((tbl) => (
              <option key={tbl} value={tbl}>
                {tbl} ({tableCounts[tbl] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
