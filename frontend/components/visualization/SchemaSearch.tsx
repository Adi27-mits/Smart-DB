'use client'

/**
 * SchemaSearch.tsx  (visualization/SchemaSearch)
 *
 * Phase 6: Unified Search Component for Tables & Columns
 *
 * Provides instant in-memory search across tables and columns with:
 * - Substring case-insensitive matching
 * - Structured table & column results with disambiguated labels
 * - Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
 * - Clean "No results found" state
 * - Strict zero-network overhead (operates 100% on schema in memory)
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Search, X, Table2, Columns as ColumnIcon, KeyRound, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DatabaseSchema } from '@/lib/schema'

export interface SearchResultTable {
  type: 'table'
  tableId: string
  tableName: string
  columnCount: number
  primaryKeyCount: number
}

export interface SearchResultColumn {
  type: 'column'
  tableId: string
  tableName: string
  columnName: string
  dataType: string
  isPrimary: boolean
  isForeign: boolean
  references?: { table: string; column: string }
}

export type SearchResult = SearchResultTable | SearchResultColumn

export type SchemaSearchProps = {
  schema?: DatabaseSchema | any
  value: string
  onChange: (query: string) => void
  onSelectResult?: (result: SearchResult) => void
  matchCount?: number | null
  placeholder?: string
  className?: string
}

const MAX_TABLE_RESULTS = 6
const MAX_COLUMN_RESULTS = 12

export function SchemaSearch({
  schema,
  value,
  onChange,
  onSelectResult,
  matchCount,
  placeholder = 'Search tables & cols...',
  className,
}: SchemaSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const query = value.trim().toLowerCase()

  // ── Compute search results completely in-memory ───────────────────────────
  const { tableResults, columnResults, allResults } = useMemo(() => {
    if (!query || !schema?.tables) {
      return { tableResults: [], columnResults: [], allResults: [] }
    }

    const tMatches: SearchResultTable[] = []
    const cMatches: SearchResultColumn[] = []

    // 1. Table matches
    for (const table of schema.tables) {
      const name = table.name.toLowerCase()
      if (name.includes(query)) {
        const pkCount = table.columns.filter((c: { pk?: boolean; primaryKey?: boolean }) => c.pk || c.primaryKey).length
        tMatches.push({
          type: 'table',
          tableId: table.id,
          tableName: table.name,
          columnCount: table.columns.length,
          primaryKeyCount: pkCount,
        })
      }
    }

    // Rank tables: exact match first, then prefix, then substring
    tMatches.sort((a, b) => {
      const aName = a.tableName.toLowerCase()
      const bName = b.tableName.toLowerCase()
      if (aName === query) return -1
      if (bName === query) return 1
      if (aName.startsWith(query) && !bName.startsWith(query)) return -1
      if (!aName.startsWith(query) && bName.startsWith(query)) return 1
      return aName.localeCompare(bName)
    })

    // 2. Column matches (with table context disambiguation)
    for (const table of schema.tables) {
      for (const col of table.columns) {
        const colName = col.name.toLowerCase()
        const fullSpec = `${table.name.toLowerCase()}.${colName}`

        if (colName.includes(query) || fullSpec.includes(query)) {
          cMatches.push({
            type: 'column',
            tableId: table.id,
            tableName: table.name,
            columnName: col.name,
            dataType: (col as any).dataType || col.type || '',
            isPrimary: Boolean((col as any).primaryKey || col.pk),
            isForeign: Boolean((col as any).foreignKey || col.fk),
            references:
              (col as any).references ||
              (col.fk ? { table: col.fk.table, column: col.fk.column } : undefined),
          })
        }
      }
    }

    // Rank columns: exact column name first, then prefix, then alphabetical
    cMatches.sort((a, b) => {
      const aName = a.columnName.toLowerCase()
      const bName = b.columnName.toLowerCase()
      if (aName === query) return -1
      if (bName === query) return 1
      if (aName.startsWith(query) && !bName.startsWith(query)) return -1
      if (!aName.startsWith(query) && bName.startsWith(query)) return 1
      return a.tableName.localeCompare(b.tableName) || aName.localeCompare(bName)
    })

    const visibleTables = tMatches.slice(0, MAX_TABLE_RESULTS)
    const visibleColumns = cMatches.slice(0, MAX_COLUMN_RESULTS)
    const combined: SearchResult[] = [...visibleTables, ...visibleColumns]

    return {
      tableResults: visibleTables,
      columnResults: visibleColumns,
      allResults: combined,
    }
  }, [query, schema.tables])

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(-1)
    if (query) {
      setIsOpen(true)
    }
  }, [query])

  // Handle outside click to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelectResult?.(result)
      setIsOpen(false)
      setSelectedIndex(-1)
    },
    [onSelectResult]
  )

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && query) {
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < allResults.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allResults.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < allResults.length) {
        handleSelect(allResults[selectedIndex])
      } else if (allResults.length > 0) {
        // Select first result if none highlighted
        handleSelect(allResults[0])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    onChange('')
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (query) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search schema tables and columns"
          className="h-8 w-full rounded-lg border border-input bg-background/90 py-1 pl-8 pr-7 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-1 focus:ring-ring"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Autocomplete Results Dropdown */}
      {isOpen && query && (
        <div
          data-testid="search-dropdown"
          className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 md:w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          {allResults.length === 0 ? (
            /* No Results Found */
            <div className="px-4 py-5 text-center text-xs text-muted-foreground">
              <Search className="mx-auto mb-1.5 h-4 w-4 opacity-50" />
              <p className="font-medium text-foreground">No tables or columns found</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                No matches for &ldquo;<span className="text-foreground">{value}</span>&rdquo;
              </p>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto p-1.5 space-y-2">
              {/* Table Matches Group */}
              {tableResults.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Tables ({tableResults.length})</span>
                  </div>
                  <ul className="space-y-0.5">
                    {tableResults.map((t) => {
                      const overallIndex = allResults.indexOf(t)
                      const isSelected = selectedIndex === overallIndex
                      return (
                        <li key={`table-${t.tableId}`}>
                          <button
                            type="button"
                            data-testid="search-result-table"
                            data-table-id={t.tableId}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleSelect(t)
                            }}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                              isSelected
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'text-foreground hover:bg-accent'
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Table2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
                              <span className="truncate font-mono font-semibold">{t.tableName}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 text-[10px]">
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 font-mono',
                                  isSelected
                                    ? 'bg-primary-foreground/20 text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {t.columnCount} cols
                              </span>
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 font-bold uppercase tracking-wider text-[9px]',
                                  isSelected
                                    ? 'bg-primary-foreground/20 text-primary-foreground'
                                    : 'bg-primary/10 text-primary'
                                )}
                              >
                                Table
                              </span>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* Column Matches Group */}
              {columnResults.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-t border-border/50 pt-2">
                    <span>Columns ({columnResults.length})</span>
                  </div>
                  <ul className="space-y-0.5">
                    {columnResults.map((c) => {
                      const overallIndex = allResults.indexOf(c)
                      const isSelected = selectedIndex === overallIndex
                      return (
                        <li key={`col-${c.tableId}-${c.columnName}`}>
                          <button
                            type="button"
                            data-testid="search-result-column"
                            data-table-id={c.tableId}
                            data-column-name={c.columnName}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleSelect(c)
                            }}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                              isSelected
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'text-foreground hover:bg-accent'
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2 font-mono">
                              <ColumnIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              <div className="truncate">
                                <span className={cn('text-[11px]', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                                  {c.tableName}.
                                </span>
                                <span className="font-semibold text-xs">{c.columnName}</span>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1 font-mono text-[10px]">
                              {c.isPrimary && (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-0.5 rounded px-1 py-0.2 font-bold text-[9px]',
                                    isSelected
                                      ? 'bg-primary-foreground/20 text-primary-foreground'
                                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  )}
                                >
                                  <KeyRound className="h-2 w-2" />
                                  PK
                                </span>
                              )}
                              {c.isForeign && (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-0.5 rounded px-1 py-0.2 font-bold text-[9px]',
                                    isSelected
                                      ? 'bg-primary-foreground/20 text-primary-foreground'
                                      : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                  )}
                                >
                                  <Link2 className="h-2 w-2" />
                                  FK
                                </span>
                              )}
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-[9px]',
                                  isSelected
                                    ? 'bg-primary-foreground/20 text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {c.dataType}
                              </span>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Footer hint */}
          <div className="border-t border-border bg-card/60 px-3 py-1.5 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Use ↑↓ to navigate, Enter to focus</span>
            <span>ESC to close</span>
          </div>
        </div>
      )}
    </div>
  )
}
