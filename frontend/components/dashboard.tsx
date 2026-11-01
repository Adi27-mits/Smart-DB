'use client'

import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import {
  Database, Download, KeyRound, Link2, Search, Waypoints, X,
  RefreshCw, LogOut, Upload, FileDown, AlertCircle, Check, Activity, Terminal,
  Plus, MoreHorizontal,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { DatabaseSchema } from '@/lib/schema'
import { schemaStats } from '@/lib/schema'
import { AppSidebar } from './app-sidebar'
// Modern React Flow Schema Visualization (Phase 4 integration)
import { SchemaCanvas } from './visualization/SchemaCanvas'
import { SchemaSearch, type SearchResult } from './visualization/SchemaSearch'
// DetailPanel retained in codebase; Phase 5 uses TableDetailsPanel inside SchemaCanvas
// import { DetailPanel } from './detail-panel'
import { downloadSQL, importSQL, runAnalysis, type AnalysisResult } from '@/lib/schema-api'
import { EditorModals } from './editor-modals'
import { DataTableModal } from './data-modal'
import { HealthDashboard } from './health/health-dashboard'
import { QueryConsole } from './query/query-console'
import { CrudInterface } from './crud/crud-interface'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

type ActiveColumn = { table: string; column: string } | null

type Props = {
  schema: DatabaseSchema
  isDemo: boolean
  onDisconnect: () => void
  onRefresh: () => void
}

export function Dashboard({ schema, isDemo, onDisconnect, onRefresh }: Props) {
  const [activeView, setActiveView] = useState<'schema' | 'health' | 'query' | 'crud'>('schema')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [activeColumn, setActiveColumn] = useState<ActiveColumn>(null)
  const [explainRelId, setExplainRelId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [focusSignal, setFocusSignal] = useState<{
    tableId: string
    columnName?: string | null
    ruleId?: string | null
    nonce: number
  } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editAction, setEditAction] = useState<any>(null)
  const [viewingData, setViewingData] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Single shared health analysis state for entire dashboard
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const analysisFetchedRef = useRef(false)
  const prevSchemaRef = useRef<DatabaseSchema | null>(null)

  const fetchAnalysis = useCallback(async (force = false) => {
    if (isDemo) return
    if (analysisFetchedRef.current && !force) return
    analysisFetchedRef.current = true
    setLoadingAnalysis(true)
    setAnalysisError(null)
    try {
      const res = await runAnalysis()
      setAnalysis(res)
    } catch (err: any) {
      console.error('[DASHBOARD] Error loading analysis:', err)
      setAnalysisError(err?.message || 'Unable to complete health analysis.')
    } finally {
      setLoadingAnalysis(false)
    }
  }, [isDemo])

  useEffect(() => {
    fetchAnalysis()
  }, [fetchAnalysis])

  // Invalidate and refetch analysis when schema prop changes (e.g. refresh, DB switch, mutations)
  useEffect(() => {
    if (prevSchemaRef.current !== null && prevSchemaRef.current !== schema) {
      analysisFetchedRef.current = false
      if (!isDemo) {
        fetchAnalysis(true)
      } else {
        setAnalysis(null)
      }
    }
    prevSchemaRef.current = schema
  }, [schema, isDemo, fetchAnalysis])

  const stats = schemaStats(schema)

  const matchedTables = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    const set = new Set<string>()
    schema.tables.forEach((t) => {
      if (t.name.toLowerCase().includes(q) || t.columns.some((c) => c.name.toLowerCase().includes(q))) {
        set.add(t.id)
      }
    })
    return set
  }, [search, schema.tables])

  const focusTable = useCallback((id: string) => {
    const target = schema.tables.find((t) => t.id === id || t.name === id)
    const targetId = target ? target.id : id
    setSelectedTable(targetId)
    setActiveColumn(null)
    setExplainRelId(null)
    setFocusSignal({ tableId: targetId, nonce: Date.now() })
  }, [schema.tables])

  const selectFromCanvas = useCallback((id: string | null) => {
    setSelectedTable(id)
    setActiveColumn(null)
    setExplainRelId(null)
  }, [])

  const handleColumnClick = useCallback((tableId: string, column: string) => {
    setExplainRelId(null)
    setSelectedTable(tableId)
    setActiveColumn((prev) => (prev && prev.table === tableId && prev.column === column ? null : { table: tableId, column }))
  }, [])

  const handleSelectSearchResult = useCallback((result: SearchResult) => {
    if (result.type === 'table') {
      setSelectedTable(result.tableId)
      setActiveColumn(null)
      setFocusSignal({ tableId: result.tableId, nonce: Date.now() })
      setSearch(result.tableName)
    } else {
      setSelectedTable(result.tableId)
      setActiveColumn({ table: result.tableId, column: result.columnName })
      setFocusSignal({ tableId: result.tableId, nonce: Date.now() })
      setSearch(`${result.tableName}.${result.columnName}`)
    }
  }, [])

  function handleExplainRelationship(relId: string) {
    setExplainRelId(relId)
  }

  function closeDetail() {
    setSelectedTable(null)
    setActiveColumn(null)
    setExplainRelId(null)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (matchedTables && matchedTables.size > 0) {
      const first = schema.tables.find((t) => matchedTables.has(t.id))
      if (first) setFocusSignal({ tableId: first.id, nonce: Date.now() })
    }
  }

  function showNotification(type: 'success' | 'error', text: string) {
    setNotification({ type, text })
    setTimeout(() => setNotification(null), 4000)
  }

  function handleEditSuccess() {
    showNotification('success', 'Operation completed successfully.')
    onRefresh()
    fetchAnalysis(true)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      onRefresh()
      fetchAnalysis(true)
      showNotification('success', 'Schema refreshed successfully')
    } catch {
      showNotification('error', 'Failed to refresh schema')
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  async function handleExportSQL() {
    try {
      await downloadSQL()
      showNotification('success', 'SQL file downloaded successfully')
    } catch {
      showNotification('error', 'Failed to export SQL')
    }
  }

  function handleExportJSON() {
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${schema.name}-schema.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportSQL(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await importSQL(file)
      showNotification(
        'success',
        `Import complete: ${result.executed} statements executed, ${result.skipped} skipped.`
      )
      // Refresh schema after import
      onRefresh()
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Import failed')
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* ── ROW 1: PRIMARY APPLICATION HEADER ── */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-frost px-4 backdrop-blur-xl">
        {/* Left: Branding & Database context */}
        <div className="flex min-w-0 items-center gap-3 pr-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              Smart Database Visualizer
            </p>
            <p
              className="truncate text-[11px] text-muted-foreground"
              title={`Schema map · ${schema.name}${isDemo ? ' (Demo)' : ''}`}
            >
              Schema map · <span className="font-medium text-foreground/80">{schema.name}</span>
              {isDemo && <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">(Demo)</span>}
            </p>
          </div>
        </div>

        {/* Center / Available: Segmented View Navigation (Schema, Health, Query, CRUD) */}
        <nav
          aria-label="Main Navigation"
          className="mx-2 flex shrink-0 items-center rounded-lg border border-border bg-background/70 p-0.5 text-xs font-medium shadow-xs"
        >
          <button
            type="button"
            onClick={() => setActiveView('schema')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1.5 transition-all',
              activeView === 'schema'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="View database schema diagram"
          >
            <Waypoints className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Schema</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('health')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1.5 transition-all',
              activeView === 'health'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="View database health analysis and recommendations"
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Health</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('query')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1.5 transition-all',
              activeView === 'query'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Open SQL Query Console"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Query</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('crud')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 sm:px-3 py-1.5 transition-all',
              activeView === 'crud'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Open CRUD Data Manager"
          >
            <Database className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CRUD</span>
          </button>
        </nav>

        {/* Right: Global actions */}
        <div className="flex shrink-0 items-center gap-2 pl-2">
          {isDemo && (
            <span className="hidden md:inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              Demo
            </span>
          )}
          <button
            type="button"
            onClick={onDisconnect}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-destructive/30 bg-card px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            title="Disconnect from database"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Disconnect</span>
          </button>
        </div>
      </header>

      {/* ── ROW 2: CONTEXTUAL SCHEMA TOOLBAR (Active in Schema view) ── */}
      {activeView === 'schema' && (
        <section
          aria-label="Schema Tools"
          className="sticky top-14 z-20 flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-frost/95 px-4 backdrop-blur-md"
        >
          {/* Left toolbar items: Visualizer Link + Search + Primary Actions */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            {/* Visualizer route shortcut */}
            <Link
              href="/visualize"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              title="Open full interactive visualizer view"
            >
              <Waypoints className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Visualizer</span>
            </Link>

            {/* Unified Schema Search Component */}
            <SchemaSearch
              schema={schema}
              value={search}
              onChange={setSearch}
              onSelectResult={handleSelectSearchResult}
              className="w-36 sm:w-48 md:w-56 lg:w-64 shrink-0 transition-all"
            />

            <div className="hidden sm:block h-4 w-px bg-border/60 shrink-0" />

            {/* Table & Relation Creation */}
            {!isDemo && (
              <>
                <button
                  type="button"
                  onClick={() => setEditAction({ type: 'createTable' })}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                  title="Create a new database table"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Table</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditAction({ type: 'addRelationship' })}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-link/30 bg-link/10 px-2.5 py-1.5 text-xs font-medium text-link transition-colors hover:bg-link/20"
                  title="Add a foreign key relationship"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Relation</span>
                </button>

                {/* Data preview button */}
                <button
                  type="button"
                  onClick={() => setViewingData(schema.tables[0]?.name || null)}
                  className="hidden md:flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                  title="Quick View Table Records"
                >
                  <Database className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden lg:inline">Data</span>
                </button>
              </>
            )}
          </div>

          {/* Right toolbar items: Refresh & More Dropdown */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {!isDemo && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="hidden lg:flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
                title="Refresh schema from database"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                <span className="hidden xl:inline">Refresh</span>
              </button>
            )}

            {/* Hidden File Input for SQL import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql,.txt"
              onChange={handleImportSQL}
              className="hidden"
            />

            {/* More Menu Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus:outline-none"
                title="More actions and utilities"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">More</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs">
                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Schema Actions
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={handleRefresh} className="cursor-pointer">
                  <RefreshCw className={cn('mr-2 h-3.5 w-3.5 text-muted-foreground', refreshing && 'animate-spin')} />
                  <span>Refresh Schema</span>
                </DropdownMenuItem>
                {!isDemo && (
                  <DropdownMenuItem
                    onClick={() => setViewingData(schema.tables[0]?.name || null)}
                    className="cursor-pointer md:hidden"
                  >
                    <Database className="mr-2 h-3.5 w-3.5 text-primary" />
                    <span>View Table Records</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Import & Export
                </DropdownMenuLabel>
                {!isDemo && (
                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer"
                  >
                    <Upload className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <span>Import SQL File...</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleExportSQL} className="cursor-pointer">
                  <FileDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span>Export as SQL</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJSON} className="cursor-pointer">
                  <Download className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span>Export as JSON</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>
      )}

      {/* notification toast */}
      {notification && (
        <div
          className={cn(
            'absolute left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-md transition-all',
            activeView === 'schema' ? 'top-28' : 'top-18',
            notification.type === 'success'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-destructive/40 bg-destructive/10 text-destructive'
          )}
        >
          {notification.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Modals */}
      <EditorModals 
        action={editAction} 
        schema={schema} 
        onClose={() => setEditAction(null)} 
        onSuccess={handleEditSuccess} 
        onError={(msg) => showNotification('error', msg)} 
      />
      <DataTableModal
        tableName={viewingData}
        onClose={() => setViewingData(null)}
        tables={schema.tables}
        onSelectTable={(tbl) => setViewingData(tbl)}
        isDemo={isDemo}
      />

      {/* body */}
      {activeView === 'crud' ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <CrudInterface
            databaseName={schema.name}
            isDemo={isDemo}
            tables={schema.tables}
            initialSelectedTable={selectedTable}
          />
        </div>
      ) : activeView === 'query' ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <QueryConsole
            databaseName={schema.name}
            isDemo={isDemo}
            tables={schema.tables}
          />
        </div>
      ) : activeView === 'health' ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <HealthDashboard
            databaseName={schema.name}
            isDemo={isDemo}
            analysis={analysis}
            loading={loadingAnalysis}
            error={analysisError}
            onRefreshAnalysis={() => fetchAnalysis(true)}
            onFocusTable={(tableId, columnName, ruleId) => {
              setActiveView('schema')
              const target = schema.tables.find((t) => t.id === tableId || t.name === tableId)
              const targetId = target ? target.id : tableId
              setSelectedTable(targetId)
              if (columnName) {
                setActiveColumn({ table: targetId, column: columnName })
              } else {
                setActiveColumn(null)
              }
              setExplainRelId(null)
              setFocusSignal({
                tableId: targetId,
                columnName: columnName ?? null,
                ruleId: ruleId ?? null,
                nonce: Date.now(),
              })
            }}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="hidden md:block">
            <AppSidebar schema={schema} selectedTable={selectedTable} onSelectTable={focusTable} />
          </div>

          <main className="relative min-w-0 flex-1 h-full overflow-hidden">
            <SchemaCanvas
              schema={schema}
              analysis={analysis}
              selectedTableId={selectedTable}
              activeColumn={activeColumn}
              matchedTableIds={matchedTables}
              focusSignal={focusSignal}
              onSelectTable={selectFromCanvas}
              onColumnClick={handleColumnClick}
              showInternalSearch={false}
              showInternalDetails={true}
              onViewData={(tbl) => setViewingData(tbl)}
              onAddColumn={(tbl) => setEditAction({ type: 'addColumn', tableName: tbl })}
              onDropTable={(tbl) => setEditAction({ type: 'dropTable', tableName: tbl })}
              isDemo={isDemo}
            />
          </main>
        </div>
      )}

      {/* status bar */}
      <footer className="z-30 flex items-center gap-4 border-t border-border bg-frost px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-xl">
        <span className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', isDemo ? 'bg-amber-500' : 'bg-primary')} />
          {isDemo ? 'Demo Mode' : 'Connected to'}{' '}
          <span className="font-mono text-foreground">{schema.name}</span>
        </span>
        <span className="ml-auto font-mono">
          {stats.tables} Tables · {stats.relationships} Relations · {stats.columns} Columns
        </span>
      </footer>
    </div>
  )
}
