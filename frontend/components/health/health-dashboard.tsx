'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Database,
  SearchX,
  RotateCcw,
} from 'lucide-react'
import { runAnalysis } from '@/lib/schema-api'
import type { AnalysisResult, AnalysisIssue, AnalysisRecommendation } from '@/lib/schema-api'
import { HealthScoreCard } from './health-score-card'
import { HealthSummaryBar } from './health-summary-bar'
import { IssueFilters, type SeverityFilter } from './issue-filters'
import { IssueCard } from './issue-card'
import { cn } from '@/lib/utils'

interface HealthDashboardProps {
  databaseName?: string
  isDemo?: boolean
  analysis?: AnalysisResult | null
  loading?: boolean
  error?: string | null
  onRefreshAnalysis?: () => void
  onFocusTable?: (tableName: string, columnName?: string | null, ruleId?: string) => void
}

export function HealthDashboard({
  databaseName = 'database',
  isDemo = false,
  analysis: externalAnalysis,
  loading: externalLoading,
  error: externalError,
  onRefreshAnalysis,
  onFocusTable,
}: HealthDashboardProps) {
  const [internalAnalysis, setInternalAnalysis] = useState<AnalysisResult | null>(null)
  const [internalLoading, setInternalLoading] = useState<boolean>(true)
  const [internalError, setInternalError] = useState<string | null>(null)

  const isControlled = externalAnalysis !== undefined
  const analysis = isControlled ? externalAnalysis : internalAnalysis
  const loading = externalLoading !== undefined ? externalLoading : internalLoading
  const error = externalError !== undefined ? externalError : internalError

  // Filters state
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityFilter>('ALL')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedTable, setSelectedTable] = useState<string>('ALL')
  const [search, setSearch] = useState<string>('')

  // Load analysis data dynamically from POST /api/analysis/run
  const loadAnalysis = useCallback(async () => {
    if (isControlled) {
      onRefreshAnalysis?.()
      return
    }

    if (isDemo) {
      setInternalLoading(false)
      setInternalError('Connect to a database to run health analysis.')
      return
    }

    setInternalLoading(true)
    setInternalError(null)
    try {
      const res = await runAnalysis()
      setInternalAnalysis(res)
    } catch (err: any) {
      console.error('[HEALTH DASHBOARD] Error loading analysis:', err)
      const msg =
        err?.message ||
        'Unable to complete health analysis. Please ensure the backend is running and a database is connected.'
      setInternalError(msg)
    } finally {
      setInternalLoading(false)
    }
  }, [isControlled, onRefreshAnalysis, isDemo])

  useEffect(() => {
    if (!isControlled) {
      loadAnalysis()
    }
  }, [isControlled, loadAnalysis])

  // Map recommendations by table + column for fast lookup
  const recommendationsMap = useMemo(() => {
    const map = new Map<string, AnalysisRecommendation>()
    if (!analysis?.recommendations) return map

    for (const rec of analysis.recommendations) {
      const key = `${rec.ruleId}::${rec.table}::${rec.column || ''}`
      map.set(key, rec)
    }
    return map
  }, [analysis?.recommendations])

  // Dynamically extract unique categories from issues
  const categories = useMemo(() => {
    if (!analysis?.issues) return []
    const set = new Set<string>()
    for (const i of analysis.issues) {
      if (i.category) set.add(i.category)
    }
    return Array.from(set).sort()
  }, [analysis?.issues])

  // Dynamically extract unique affected tables from issues
  const tables = useMemo(() => {
    if (!analysis?.issues) return []
    const set = new Set<string>()
    for (const i of analysis.issues) {
      if (i.table) set.add(i.table)
    }
    return Array.from(set).sort()
  }, [analysis?.issues])

  // Compute dynamic counts for filters based on all issues
  const allIssues = useMemo(() => analysis?.issues || [], [analysis?.issues])

  const severityCounts = useMemo(() => {
    const counts = { ALL: allIssues.length, HIGH: 0, MEDIUM: 0, LOW: 0 }
    for (const issue of allIssues) {
      const s = (issue.severity || '').toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW'
      if (counts[s] !== undefined) counts[s]++
    }
    return counts
  }, [allIssues])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allIssues.length }
    for (const issue of allIssues) {
      const c = issue.category || 'GENERAL'
      counts[c] = (counts[c] || 0) + 1
    }
    return counts
  }, [allIssues])

  const tableCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allIssues.length }
    for (const issue of allIssues) {
      const t = issue.table
      if (t) counts[t] = (counts[t] || 0) + 1
    }
    return counts
  }, [allIssues])

  // Filter issues based on active filters
  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase()

    return allIssues.filter((issue) => {
      // Severity filter
      if (selectedSeverity !== 'ALL') {
        if ((issue.severity || '').toUpperCase() !== selectedSeverity) {
          return false
        }
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        if ((issue.category || '') !== selectedCategory) {
          return false
        }
      }

      // Table filter
      if (selectedTable !== 'ALL') {
        if (issue.table !== selectedTable) {
          return false
        }
      }

      // Search filter
      if (q) {
        const inTitle = (issue.title || '').toLowerCase().includes(q)
        const inTable = (issue.table || '').toLowerCase().includes(q)
        const inColumn = (issue.column || '').toLowerCase().includes(q)
        const inEvidence = (issue.evidence || '').toLowerCase().includes(q)
        const inRecommendation = (issue.recommendation || '').toLowerCase().includes(q)

        if (!inTitle && !inTable && !inColumn && !inEvidence && !inRecommendation) {
          return false
        }
      }

      return true
    })
  }, [allIssues, selectedSeverity, selectedCategory, selectedTable, search])

  const hasActiveFilters =
    selectedSeverity !== 'ALL' ||
    selectedCategory !== 'ALL' ||
    selectedTable !== 'ALL' ||
    search.trim().length > 0

  function handleResetFilters() {
    setSelectedSeverity('ALL')
    setSelectedCategory('ALL')
    setSelectedTable('ALL')
    setSearch('')
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Database Health Analysis
              </h2>
              <p className="text-xs text-muted-foreground">
                Rule-based diagnostics & design recommendations for{' '}
                <span className="font-semibold text-foreground">{databaseName}</span>
                {isDemo && ' (Demo Mode)'}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={loadAnalysis}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-60 shadow-xs"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          <span>{loading ? 'Analyzing...' : 'Re-run Analysis'}</span>
        </button>
      </div>

      {/* Main Content Area based on UI States */}
      <div className="mt-6 flex-1 space-y-6">
        {/* State A: Loading Analysis */}
        {loading && !analysis && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Analyzing database schema...
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Evaluating relational constraints, keys, indexes, and dependencies.
            </p>
          </div>
        )}

        {/* State B & C: Error / Disconnected */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {error.toLowerCase().includes('connect')
                ? 'Database Not Connected'
                : 'Health Analysis Unavailable'}
            </h3>
            <p className="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
              {error.toLowerCase().includes('connect') || error.toLowerCase().includes('no database')
                ? 'Connect to a database to run health analysis.'
                : error}
            </p>
            {!isDemo && (
              <button
                type="button"
                onClick={loadAnalysis}
                className="mt-5 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry Analysis</span>
              </button>
            )}
          </div>
        )}

        {/* Loaded Analysis View */}
        {analysis && (
          <>
            {/* Top Grid: Health Score Card & Summary Cards */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <HealthScoreCard
                  score={analysis.summary.healthScore}
                  grade={analysis.summary.healthGrade}
                  label={analysis.summary.healthScoreLabel}
                  note={analysis.summary.healthScoreNote}
                />
              </div>
              <div className="flex flex-col justify-center lg:col-span-2">
                <HealthSummaryBar summary={analysis.summary} />
              </div>
            </div>

            {/* Filter Bar */}
            <div className="mt-4">
              <IssueFilters
                selectedSeverity={selectedSeverity}
                onSelectSeverity={setSelectedSeverity}
                severityCounts={severityCounts}
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                categoryCounts={categoryCounts}
                tables={tables}
                selectedTable={selectedTable}
                onSelectTable={setSelectedTable}
                tableCounts={tableCounts}
                search={search}
                onSearchChange={setSearch}
                onResetFilters={handleResetFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </div>

            {/* Issues List Header */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                Showing <strong className="text-foreground">{filteredIssues.length}</strong> of{' '}
                <strong className="text-foreground">{allIssues.length}</strong> issues
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-primary hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>

            {/* State D: No Issues in Database */}
            {allIssues.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Great — no issues were detected by the currently enabled rules.
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  The evaluated tables comply with the primary key, relationship, and indexing rules.
                </p>
              </div>
            )}

            {/* State E: Filter returned 0 matches */}
            {allIssues.length > 0 && filteredIssues.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
                <SearchX className="h-8 w-8 text-muted-foreground" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  No issues match the selected filters.
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting or clearing your search criteria, severity, category, or table filter.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* Issue Cards Grid */}
            {filteredIssues.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                {filteredIssues.map((issue, idx) => {
                  const key = `${issue.ruleId}::${issue.table}::${issue.column || ''}`
                  const recommendation = recommendationsMap.get(key)

                  return (
                    <IssueCard
                      key={`${issue.ruleId}-${issue.table}-${issue.column || idx}`}
                      issue={issue}
                      recommendation={recommendation}
                      onFocusTable={onFocusTable}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
