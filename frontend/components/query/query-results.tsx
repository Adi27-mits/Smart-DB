'use client'

import React, { useState, useMemo } from 'react'
import {
  Table as TableIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  Terminal,
} from 'lucide-react'
import type { QueryResult } from '@/lib/schema-api'
import { cn } from '@/lib/utils'

interface QueryResultsProps {
  result: QueryResult | null
  loading: boolean
  error: { code?: string; message: string; sqlState?: string | null } | null
}

export function QueryResults({ result, loading, error }: QueryResultsProps) {
  const [filterText, setFilterText] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25

  // Filter rows within result set based on filterText
  const filteredRows = useMemo(() => {
    if (!result?.rows || result.rows.length === 0) return []
    const term = filterText.trim().toLowerCase()
    if (!term) return result.rows

    return result.rows.filter((row) =>
      Object.values(row).some((val) => {
        if (val === null || val === undefined) return false
        return String(val).toLowerCase().includes(term)
      })
    )
  }, [result?.rows, filterText])

  // Paginate filtered rows
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  // Reset page when filterText changes
  function handleFilterChange(val: string) {
    setFilterText(val)
    setPage(1)
  }

  // Export to CSV
  function exportCSV() {
    if (!result?.columns || !result?.rows) return
    const headers = result.columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')
    const rows = result.rows.map((row) =>
      result.columns
        .map((col) => {
          const val = row[col]
          if (val === null || val === undefined) return '""'
          return `"${String(val).replace(/"/g, '""')}"`
        })
        .join(',')
    )

    const csvContent = [headers, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `query-result-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Export to JSON
  function exportJSON() {
    if (!result?.rows) return
    const jsonContent = JSON.stringify(result.rows, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `query-result-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center bg-card/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse">
          <Terminal className="h-5 w-5" />
        </div>
        <h4 className="mt-4 text-sm font-semibold text-foreground">Executing SQL query...</h4>
        <p className="mt-1 text-xs text-muted-foreground">Running against active database pool.</p>
      </div>
    )
  }

  // 2. Error State
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-destructive">Query Execution Error</h4>
              {error.code && (
                <span className="rounded-md border border-destructive/30 bg-destructive/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-destructive">
                  {error.code}
                </span>
              )}
              {error.sqlState && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  (SQLState: {error.sqlState})
                </span>
              )}
            </div>
            <p className="text-xs text-foreground/90 font-mono leading-relaxed mt-2 whitespace-pre-wrap break-all">
              {error.message}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. Initial Empty State
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center bg-card/20">
        <Database className="h-8 w-8 text-muted-foreground/60" />
        <h4 className="mt-3 text-sm font-semibold text-foreground">No Query Executed Yet</h4>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Enter any valid read-only SQL query (SELECT, SHOW, DESCRIBE, EXPLAIN) above and click Run Query.
        </p>
      </div>
    )
  }

  // 4. Mutation / DDL Result State (non-result set)
  if (!result.isResultSet) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {result.statementType} SUCCESS
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{result.executionTimeMs} ms</span>
              </span>
            </div>

            <p className="text-sm font-medium text-foreground">{result.message}</p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
              {result.affectedRows !== undefined && (
                <span>
                  Affected rows:{' '}
                  <strong className="text-foreground">{result.affectedRows}</strong>
                </span>
              )}
              {result.insertId ? (
                <span>
                  Generated Insert ID:{' '}
                  <strong className="text-foreground">{result.insertId}</strong>
                </span>
              ) : null}
              {result.changedRows !== null && result.changedRows !== undefined && (
                <span>
                  Changed rows:{' '}
                  <strong className="text-foreground">{result.changedRows}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 5. Tabular Result Set State (SELECT, SHOW, DESCRIBE, EXPLAIN)
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur-md overflow-hidden">
      {/* Result Metrics Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {result.statementType}
          </span>
          <span className="text-xs font-medium text-foreground">
            <strong>{result.rowCount}</strong> row{result.rowCount !== 1 ? 's' : ''} returned
          </span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{result.executionTimeMs} ms</span>
          </span>
          {result.truncated && (
            <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold">
              Truncated at 1000 rows
            </span>
          )}
        </div>

        {/* Search within results and export buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Filter */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => handleFilterChange(e.target.value)}
              placeholder="Filter result cells..."
              className="h-7 w-36 rounded-md border border-input bg-background/80 pl-8 pr-7 text-xs outline-none transition-all focus:w-48 focus:border-ring"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => handleFilterChange('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1 rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Export query results as CSV"
          >
            <FileSpreadsheet className="h-3 w-3" />
            <span>CSV</span>
          </button>

          {/* Export JSON */}
          <button
            type="button"
            onClick={exportJSON}
            className="flex items-center gap-1 rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Export query results as JSON"
          >
            <Download className="h-3 w-3" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
          {filterText ? 'No rows match your filter.' : 'Query returned 0 rows.'}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md border-b border-border shadow-2xs font-semibold text-muted-foreground">
              <tr>
                <th className="w-12 px-3 py-2 text-center text-[10px] uppercase font-mono tracking-wider border-r border-border/40">
                  #
                </th>
                {result.columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 font-mono text-[11px] text-foreground tracking-tight whitespace-nowrap border-r border-border/40 last:border-r-0"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px]">
              {paginatedRows.map((row, rowIdx) => {
                const globalIdx = (page - 1) * pageSize + rowIdx + 1
                return (
                  <tr
                    key={rowIdx}
                    className="hover:bg-accent/40 transition-colors even:bg-muted/10"
                  >
                    <td className="w-12 px-3 py-1.5 text-center text-[10px] text-muted-foreground border-r border-border/40 select-none">
                      {globalIdx}
                    </td>
                    {result.columns.map((col) => {
                      const val = row[col]
                      const isNull = val === null || val === undefined

                      return (
                        <td
                          key={col}
                          className="px-3 py-1.5 whitespace-nowrap text-foreground border-r border-border/40 last:border-r-0 max-w-xs truncate"
                          title={isNull ? 'NULL' : String(val)}
                        >
                          {isNull ? (
                            <span className="italic text-muted-foreground/60 select-none">
                              NULL
                            </span>
                          ) : typeof val === 'boolean' ? (
                            <span
                              className={cn(
                                'rounded px-1 text-[10px] font-semibold',
                                val
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-destructive/10 text-destructive'
                              )}
                            >
                              {String(val)}
                            </span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          <span>
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length} results
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-7 w-7 items-center justify-center rounded border border-border bg-card hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-medium text-foreground">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-7 w-7 items-center justify-center rounded border border-border bg-card hover:bg-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
