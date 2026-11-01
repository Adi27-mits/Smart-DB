'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Terminal, Database, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { executeQuery, type QueryResult } from '@/lib/schema-api'
import { QueryEditor } from './query-editor'
import { QueryResults } from './query-results'

interface QueryConsoleProps {
  databaseName?: string
  isDemo?: boolean
  tables?: { name: string }[]
  initialQuery?: string
}

export function QueryConsole({
  databaseName = 'database',
  isDemo = false,
  tables = [],
  initialQuery = 'SELECT * FROM students LIMIT 25;',
}: QueryConsoleProps) {
  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<{
    code?: string
    message: string
    sqlState?: string | null
  } | null>(null)
  const [history, setHistory] = useState<string[]>([])

  const tableNames = tables.map((t) => t.name)

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sdv_query_history')
      if (stored) {
        setHistory(JSON.parse(stored))
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [])

  // Execute query handler
  const handleExecute = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    if (isDemo) {
      setError({
        code: 'DEMO_MODE_RESTRICTION',
        message:
          'SQL query execution is unavailable in Demo Mode. Connect to a real database to execute live queries.',
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await executeQuery(trimmed)
      setResult(res)

      // Add to query history (limit to 15 unique recent queries)
      setHistory((prev) => {
        const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 15)
        try {
          localStorage.setItem('sdv_query_history', JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    } catch (err: any) {
      console.error('[QUERY CONSOLE ERROR]', err)
      setError({
        code: err.code || 'QUERY_ERROR',
        message: err.message || 'An unexpected error occurred while executing query.',
        sqlState: err.sqlState || null,
      })
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [query, isDemo])

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top View Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              SQL Query Console
            </h2>
            <p className="text-xs text-muted-foreground">
              Execute read-only queries (SELECT, SHOW, DESCRIBE, EXPLAIN) and inspect results on{' '}
              <span className="font-semibold text-foreground">{databaseName}</span>
              {isDemo && ' (Demo Mode)'}
            </p>
          </div>
        </div>

        {isDemo && (
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Connect to live MySQL to run queries</span>
          </div>
        )}
      </div>

      {/* Query Editor Box */}
      <QueryEditor
        query={query}
        onChange={setQuery}
        onExecute={handleExecute}
        loading={loading}
        tables={tableNames}
        history={history}
        onSelectHistory={(q) => setQuery(q)}
      />

      {/* Query Results Box */}
      <div className="flex-1 min-h-[300px]">
        <QueryResults result={result} loading={loading} error={error} />
      </div>
    </div>
  )
}
