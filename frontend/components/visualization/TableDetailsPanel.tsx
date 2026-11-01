'use client'

/**
 * TableDetailsPanel.tsx  (visualization/TableDetailsPanel)
 *
 * Phase 5: Professional Table Explorer
 *
 * Dedicated inspection panel for the selected table in the database schema.
 * Features 5 distinct tabs:
 * 1. Overview       — Key metrics (columns, PKs, FKs, indexes, incoming/outgoing rels) + actions
 * 2. Columns        — Full column list with types, nullability, PK/FK/UQ/IDX badges, and FK pointers
 * 3. Keys & Constraints — Categorized: Primary Key, Foreign Keys, Unique constraints, NOT NULL
 * 4. Indexes        — Actual index definitions from INFORMATION_SCHEMA.STATISTICS
 * 5. Relationships  — Outgoing References (points to) vs Incoming References (referenced by)
 *
 * Strictly scoped:
 * - Real metadata only (no synthetic PKs, no R003 heuristic edges)
 * - Navigation across tables does NOT trigger Dagre auto-layout
 * - Table actions (View Data, Add Column, Drop Table) seamlessly bridge to existing dashboard modals
 */

import { useState, useMemo, useEffect } from 'react'
import {
  Table2,
  X,
  KeyRound,
  Link2,
  ShieldCheck,
  Binary,
  Layers,
  LayoutDashboard,
  Columns as ColumnsIcon,
  GitFork,
  ArrowRight,
  Eye,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  AlertTriangle,
  CheckCircle2,
  Database,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  NormalizedSchema,
  ParsedTable,
  ParsedColumn,
  IndexInfo,
  ForeignKeyInfo,
} from '@/lib/schema/schemaParser'
import type { AnalysisIssue } from '@/lib/schema-api'

export type TableExplorerTab = 'overview' | 'columns' | 'keys' | 'indexes' | 'relationships'

export type TableDetailsPanelProps = {
  schema: NormalizedSchema
  selectedTableId: string | null
  activeColumn?: string | null
  tableIssues?: AnalysisIssue[]
  onClose: () => void
  onSelectTable: (id: string) => void
  onViewData?: (tableName: string) => void
  onAddColumn?: (tableName: string) => void
  onDropTable?: (tableName: string) => void
  isDemo?: boolean
}

export function TableDetailsPanel({
  schema,
  selectedTableId,
  activeColumn,
  tableIssues,
  onClose,
  onSelectTable,
  onViewData,
  onAddColumn,
  onDropTable,
  isDemo = false,
}: TableDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<TableExplorerTab>(activeColumn ? 'columns' : 'overview')
  const [columnSearch, setColumnSearch] = useState('')

  useEffect(() => {
    if (activeColumn) {
      setActiveTab('columns')
    }
  }, [activeColumn])

  const table: ParsedTable | null = useMemo(() => {
    if (!selectedTableId) return null
    return schema.tables.find((t) => t.id === selectedTableId || t.name === selectedTableId) ?? null
  }, [schema.tables, selectedTableId])

  // Relationships involving this table
  const outgoingRelationships = useMemo(() => {
    if (!table) return []
    return schema.relationships.filter((r) => r.sourceTable === table.id || r.sourceTable === table.name)
  }, [schema.relationships, table])

  const incomingRelationships = useMemo(() => {
    if (!table) return []
    return schema.relationships.filter((r) => r.targetTable === table.id || r.targetTable === table.name)
  }, [schema.relationships, table])

  if (!table) return null

  // Metric derivations
  const pkColumns = table.columns.filter((c) => c.primaryKey)
  const pkCount = table.primaryKeys ? table.primaryKeys.length : pkColumns.length
  const fkColumns = table.columns.filter((c) => c.foreignKey)
  const notNullColumns = table.columns.filter((c) => !c.nullable)
  const uniqueColumns = table.columns.filter((c) => c.isUnique)

  // Indexes from metadata
  const indexes: IndexInfo[] = table.indexes || []
  const indexCount = indexes.length

  // Filtered columns for Columns tab search
  const filteredColumns = table.columns.filter((c) =>
    c.name.toLowerCase().includes(columnSearch.trim().toLowerCase()) ||
    c.dataType.toLowerCase().includes(columnSearch.trim().toLowerCase())
  )

  return (
    <aside
      aria-label="Table Explorer"
      data-testid="table-details-panel"
      className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-full sm:w-[420px] max-w-full p-2.5 sm:p-3"
    >
      <div className="pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-frost shadow-2xl shadow-primary/10 backdrop-blur-2xl">
        {/* ── Top Header ──────────────────────────────────────────────── */}
        <header className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Table2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-mono text-sm font-semibold text-foreground" title={table.name}>
                {table.name}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{table.columns.length} columns</span>
                <span>•</span>
                <span className={cn(pkCount > 0 ? 'text-key font-medium' : 'text-amber-500 font-medium')}>
                  {pkCount > 0 ? `${pkCount} PK` : 'No PK'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1">
            {onViewData && (
              <button
                type="button"
                onClick={() => onViewData(table.id)}
                className="flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                title="View table data records"
              >
                <Eye className="h-3 w-3 text-primary" />
                <span className="hidden xs:inline">Data</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close table explorer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── Navigation Tabs ─────────────────────────────────────────── */}
        <nav className="flex items-center border-b border-border bg-card/30 px-2 py-1.5 overflow-x-auto no-scrollbar">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<LayoutDashboard className="h-3.5 w-3.5" />}
            label="Overview"
          />
          <TabButton
            active={activeTab === 'columns'}
            onClick={() => setActiveTab('columns')}
            icon={<ColumnsIcon className="h-3.5 w-3.5" />}
            label="Columns"
            badge={table.columns.length}
          />
          <TabButton
            active={activeTab === 'keys'}
            onClick={() => setActiveTab('keys')}
            icon={<KeyRound className="h-3.5 w-3.5" />}
            label="Keys"
          />
          <TabButton
            active={activeTab === 'indexes'}
            onClick={() => setActiveTab('indexes')}
            icon={<Binary className="h-3.5 w-3.5" />}
            label="Indexes"
            badge={indexCount > 0 ? indexCount : undefined}
          />
          <TabButton
            active={activeTab === 'relationships'}
            onClick={() => setActiveTab('relationships')}
            icon={<GitFork className="h-3.5 w-3.5" />}
            label="Relations"
            badge={outgoingRelationships.length + incomingRelationships.length || undefined}
          />
        </nav>

        {/* ── Tab Content Body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Metric Highlights Grid */}
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label="Columns" value={table.columns.length} />
                <MetricCard
                  label="Primary Key"
                  value={pkCount}
                  tone={pkCount > 0 ? 'key' : 'warn'}
                />
                <MetricCard label="Foreign Keys" value={outgoingRelationships.length} tone="link" />
                <MetricCard label="Referenced By" value={incomingRelationships.length} tone="primary" />
                <MetricCard label="Indexes" value={indexCount} />
                <MetricCard label="Unique Cols" value={uniqueColumns.length} />
              </div>

              {/* Primary Key Status Notice */}
              {pkCount === 0 ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No Primary Key Defined</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      This table does not define a primary key constraint. Point lookups and updates require full table scans.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card/60 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Primary Key Definition</span>
                    <span className="rounded-full bg-key/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-key">
                      {pkCount > 1 ? `Composite (${pkCount})` : 'Single PK'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(table.primaryKeys && table.primaryKeys.length > 0
                      ? table.primaryKeys
                      : pkColumns.map((c) => c.name)
                    ).map((pkName) => (
                      <span
                        key={pkName}
                        className="flex items-center gap-1 rounded-md border border-key/30 bg-key/10 px-2 py-1 font-mono text-xs font-semibold text-key"
                      >
                        <KeyRound className="h-3 w-3" />
                        {pkName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions Card */}
              <div className="rounded-xl border border-border bg-card/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Table Actions
                </p>
                <div className="mt-2.5 flex flex-col gap-2">
                  {onViewData && (
                    <button
                      type="button"
                      onClick={() => onViewData(table.id)}
                      className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                    >
                      <Database className="h-3.5 w-3.5" />
                      View Table Records ({table.name})
                    </button>
                  )}

                  {!isDemo && (
                    <div className="grid grid-cols-2 gap-2">
                      {onAddColumn && (
                        <button
                          type="button"
                          onClick={() => onAddColumn(table.id)}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          Add Column
                        </button>
                      )}

                      {onDropTable && (
                        <button
                          type="button"
                          onClick={() => onDropTable(table.id)}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Drop Table
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Structural Relationship Summary */}
              <div className="rounded-xl border border-border bg-card/40 p-3 text-xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Relationship Topology
                </p>
                <div className="mt-2 space-y-1.5 text-muted-foreground">
                  <p>
                    • Points to{' '}
                    <strong className="text-foreground">{outgoingRelationships.length}</strong> parent tables via declared foreign keys.
                  </p>
                  <p>
                    • Referenced by{' '}
                    <strong className="text-foreground">{incomingRelationships.length}</strong> child tables.
                  </p>
                  {outgoingRelationships.length === 0 && incomingRelationships.length === 0 && (
                    <p className="mt-1 text-amber-500 font-medium">
                      • Isolated table (no foreign key connections declared in schema).
                    </p>
                  )}
                </div>
              </div>

              {/* Health Findings Summary */}
              {tableIssues && tableIssues.length > 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Activity className="h-3.5 w-3.5 text-amber-500" />
                      Health Findings
                    </span>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      {tableIssues.length} issue{tableIssues.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <ul className="mt-2.5 space-y-1.5">
                    {tableIssues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                        <span
                          className={cn(
                            'mt-0.5 shrink-0 rounded px-1.5 py-0.2 font-mono text-[9px] font-bold',
                            issue.severity === 'HIGH'
                              ? 'bg-destructive/15 text-destructive'
                              : issue.severity === 'MEDIUM'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
                          )}
                        >
                          {issue.ruleId}
                        </span>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">{issue.title}</span>
                          {issue.column && (
                            <span className="font-mono text-muted-foreground ml-1">
                              ({issue.column})
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : tableIssues && tableIssues.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>No health findings detected for this table</span>
                </div>
              ) : null}
            </div>
          )}

          {/* 2. COLUMNS TAB */}
          {activeTab === 'columns' && (
            <div className="space-y-3">
              {/* Search Columns */}
              {table.columns.length > 5 && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filter columns..."
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card/60 pl-8 pr-3 py-1.5 text-xs font-mono placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  />
                  {columnSearch && (
                    <button
                      type="button"
                      onClick={() => setColumnSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}

              {/* Column Count Indicator */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                <span>Showing {filteredColumns.length} of {table.columns.length} columns</span>
                {!isDemo && onAddColumn && (
                  <button
                    type="button"
                    onClick={() => onAddColumn(table.id)}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add column
                  </button>
                )}
              </div>

              {/* Columns List */}
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card/60">
                {filteredColumns.map((col) => {
                  const isActiveCol = activeColumn === col.name
                  return (
                    <li
                      key={col.name}
                      className={cn(
                        'px-3 py-2 text-xs transition-colors hover:bg-accent/40',
                        isActiveCol && 'bg-primary/15 ring-1 ring-primary/40 rounded-lg'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5 font-mono">
                        {col.primaryKey ? (
                          <KeyRound className="h-3.5 w-3.5 shrink-0 text-key" />
                        ) : col.foreignKey ? (
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-link" />
                        ) : (
                          <span className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className={cn('truncate font-medium', col.primaryKey && 'font-bold text-key')}>
                          {col.name}
                        </span>

                        {/* Badges */}
                        <div className="flex shrink-0 items-center gap-1 ml-1">
                          {col.primaryKey && (
                            <span className="rounded bg-key/15 px-1 py-0.2 font-mono text-[9px] font-bold text-key">
                              PK
                            </span>
                          )}
                          {col.foreignKey && (
                            <span className="rounded bg-link/15 px-1 py-0.2 font-mono text-[9px] font-semibold text-link">
                              FK
                            </span>
                          )}
                          {col.isUnique && !col.primaryKey && (
                            <span className="rounded bg-purple-500/15 px-1 py-0.2 font-mono text-[9px] font-semibold text-purple-600 dark:text-purple-400">
                              UQ
                            </span>
                          )}
                          {col.isIndexed && !col.primaryKey && !col.isUnique && (
                            <span className="rounded bg-emerald-500/15 px-1 py-0.2 font-mono text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                              IDX
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Data type & Nullability */}
                      <div className="flex shrink-0 items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-muted-foreground">{col.dataType}</span>
                        {!col.nullable ? (
                          <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground">
                            NOT NULL
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60">
                            NULL
                          </span>
                        )}
                      </div>
                    </div>

                    {/* FK Target Pointer */}
                    {col.foreignKey && col.references && (
                      <div className="mt-1 flex items-center gap-1.5 pl-5 text-[11px] text-muted-foreground">
                        <span className="text-link">↳ points to:</span>
                        <button
                          type="button"
                          onClick={() => onSelectTable(col.references!.table)}
                          className="font-mono font-medium text-link underline-offset-2 hover:underline"
                        >
                          {col.references.table}.{col.references.column}
                        </button>
                      </div>
                    )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* 3. KEYS & CONSTRAINTS TAB */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              {/* Primary Key Section */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Primary Key
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {pkCount > 0 ? `${pkCount} column${pkCount > 1 ? 's' : ''}` : 'None'}
                  </span>
                </div>

                {pkCount > 0 ? (
                  <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-key" />
                      <span className="font-mono text-xs font-semibold">PRIMARY</span>
                      <span className="ml-auto rounded bg-key/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-key">
                        {pkCount > 1 ? 'Composite Key' : 'Single Column'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(table.primaryKeys && table.primaryKeys.length > 0
                        ? table.primaryKeys
                        : pkColumns.map((c) => c.name)
                      ).map((colName) => (
                        <span
                          key={colName}
                          className="rounded-md border border-key/30 bg-key/10 px-2.5 py-1 font-mono text-xs font-semibold text-key"
                        >
                          {colName}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                    <p className="font-semibold">No Primary Key Defined</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      This table has no primary key. Rows cannot be uniquely referenced by a primary key constraint.
                    </p>
                  </div>
                )}
              </section>

              {/* Foreign Keys Section */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Foreign Key Constraints
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {outgoingRelationships.length} declared
                  </span>
                </div>

                {outgoingRelationships.length > 0 ? (
                  <ul className="grid gap-2">
                    {outgoingRelationships.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-xl border border-border bg-card/60 p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-semibold text-foreground">
                            {r.constraintName || r.id}
                          </span>
                          <span className="rounded bg-link/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-link">
                            {r.cardinality || 'N:1'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="font-semibold text-link">{r.sourceColumn}</span>
                          <span className="text-muted-foreground">references</span>
                          <button
                            type="button"
                            onClick={() => onSelectTable(r.targetTable)}
                            className="flex items-center gap-1 font-semibold text-key underline-offset-2 hover:underline"
                            title={`Jump to table ${r.targetTable}`}
                          >
                            <span>{r.targetTable}.{r.targetColumn}</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-card/30 p-3 text-center text-xs text-muted-foreground">
                    No foreign key constraints declared on this table.
                  </div>
                )}
              </section>

              {/* Unique Constraints Section */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Unique Constraints & Indexes
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {uniqueColumns.length} columns
                  </span>
                </div>

                {uniqueColumns.length > 0 ? (
                  <div className="rounded-xl border border-border bg-card/60 p-3">
                    <p className="text-[11px] text-muted-foreground mb-2">Columns with unique constraint:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueColumns.map((c) => (
                        <span
                          key={c.name}
                          className="flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-purple-600 dark:text-purple-400"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-card/30 p-3 text-center text-xs text-muted-foreground">
                    No unique constraints defined.
                  </div>
                )}
              </section>

              {/* NOT NULL Constraints Section */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    NOT NULL Constraints
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {notNullColumns.length} required
                  </span>
                </div>

                <div className="rounded-xl border border-border bg-card/60 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {notNullColumns.map((c) => (
                      <span
                        key={c.name}
                        className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* 4. INDEXES TAB */}
          {activeTab === 'indexes' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Index Definitions
                </p>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {indexes.length} total
                </span>
              </div>

              {indexes.length > 0 ? (
                <ul className="grid gap-2.5">
                  {indexes.map((idx, i) => (
                    <li
                      key={`${idx.name}-${i}`}
                      className="rounded-xl border border-border bg-card/60 p-3 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground">
                          <Binary className="h-3.5 w-3.5 text-primary" />
                          <span className="truncate">{idx.name}</span>
                        </div>

                        {/* Index Type Badges */}
                        <div className="flex shrink-0 items-center gap-1 font-mono text-[10px]">
                          {idx.primary ? (
                            <span className="rounded bg-key/15 px-1.5 py-0.5 font-semibold text-key">
                              PRIMARY
                            </span>
                          ) : idx.unique ? (
                            <span className="rounded bg-purple-500/15 px-1.5 py-0.5 font-semibold text-purple-600 dark:text-purple-400">
                              UNIQUE
                            </span>
                          ) : (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                              NON-UNIQUE
                            </span>
                          )}
                          {idx.indexType && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                              {idx.indexType}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Indexed Columns */}
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Indexed Columns ({idx.columns.length})
                        </p>
                        <div className="flex flex-wrap gap-1 font-mono">
                          {idx.columns.map((colName, colIdx) => (
                            <span
                              key={colName}
                              className="rounded bg-card border border-border px-1.5 py-0.5 text-[11px] text-foreground"
                            >
                              <span className="text-muted-foreground mr-1">#{colIdx + 1}</span>
                              {colName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center text-xs text-muted-foreground">
                  <Binary className="mx-auto h-6 w-6 text-muted-foreground/60 mb-2" />
                  <p className="font-medium text-foreground">No Indexes Found</p>
                  <p className="mt-1 text-[11px]">
                    No explicit indexes are registered for this table in database metadata.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 5. RELATIONSHIPS TAB */}
          {activeTab === 'relationships' && (
            <div className="space-y-4">
              {/* Outgoing References (This Table -> Others) */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Outgoing References ({outgoingRelationships.length})
                  </h3>
                  <span className="text-[10px] text-muted-foreground">Points to parent tables</span>
                </div>

                {outgoingRelationships.length > 0 ? (
                  <ul className="grid gap-2">
                    {outgoingRelationships.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-xl border border-border bg-card/60 p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {r.constraintName || r.id}
                          </span>
                          <span className="rounded bg-link/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-link">
                            {r.cardinality || 'N:1'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{r.sourceColumn}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-semibold text-link">
                              {r.targetTable}.{r.targetColumn}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onSelectTable(r.targetTable)}
                            className="flex shrink-0 items-center gap-1 rounded-md border border-link/30 bg-link/10 px-2 py-1 text-[11px] font-medium text-link transition-colors hover:bg-link/20"
                            title={`Inspect ${r.targetTable} in table explorer`}
                          >
                            <span>Inspect</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-card/30 p-3 text-center text-xs text-muted-foreground">
                    This table does not reference any other tables.
                  </div>
                )}
              </section>

              {/* Incoming References (Others -> This Table) */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Incoming References ({incomingRelationships.length})
                  </h3>
                  <span className="text-[10px] text-muted-foreground">Referenced by child tables</span>
                </div>

                {incomingRelationships.length > 0 ? (
                  <ul className="grid gap-2">
                    {incomingRelationships.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-xl border border-border bg-card/60 p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {r.constraintName || r.id}
                          </span>
                          <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                            {r.cardinality || 'N:1'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-primary">
                              {r.sourceTable}.{r.sourceColumn}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-semibold text-foreground">{r.targetColumn}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onSelectTable(r.sourceTable)}
                            className="flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                            title={`Inspect ${r.sourceTable} in table explorer`}
                          >
                            <span>Inspect</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-card/30 p-3 text-center text-xs text-muted-foreground">
                    No tables declare foreign keys pointing to this table.
                  </div>
                )}
              </section>

              {/* 3. Possible Relationships (Heuristic / Not Declared) */}
              {(() => {
                const r003Issues = (tableIssues || []).filter((i) => i.ruleId === 'R003')
                if (r003Issues.length === 0) return null
                return (
                  <section className="space-y-2 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Possible Relationships ({r003Issues.length})
                      </h3>
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                        Suggested / Not Declared
                      </span>
                    </div>

                    <ul className="grid gap-2">
                      {r003Issues.map((issue, idx) => {
                        const targetTable =
                          issue.candidateTargetTable || issue.metadata?.candidateTable || ''
                        const targetCol =
                          issue.candidateTargetColumn || issue.metadata?.candidateColumn || ''

                        return (
                          <li
                            key={idx}
                            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                [R003] {issue.title}
                              </span>
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                Heuristic
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 font-mono">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-foreground truncate">
                                  {issue.table}.{issue.column}
                                </span>
                                <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
                                <span className="font-semibold text-amber-600 dark:text-amber-400 truncate">
                                  {targetTable}.{targetCol}
                                </span>
                              </div>

                              {targetTable && (
                                <button
                                  type="button"
                                  onClick={() => onSelectTable(targetTable)}
                                  className="flex shrink-0 items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/20"
                                  title={`Inspect candidate target table ${targetTable}`}
                                >
                                  <span>Inspect</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })()}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="border-t border-border bg-card/40 px-4 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
          <span className="font-mono truncate">{table.name}</span>
          <span className="font-mono">
            {pkCount} PK · {outgoingRelationships.length} Out · {incomingRelationships.length} In
          </span>
        </footer>
      </div>
    </aside>
  )
}

// ── Tab Button Helper ────────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      type="button"
      data-testid={`tab-${label.toLowerCase()}`}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
        active
          ? 'bg-primary/15 text-primary shadow-xs'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && (
        <span
          className={cn(
            'ml-0.5 rounded-full px-1.5 py-0.2 font-mono text-[9px] font-semibold leading-tight',
            active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

// ── Metric Card Helper ───────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: 'key' | 'link' | 'primary' | 'warn'
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-2.5 text-center">
      <p
        className={cn(
          'font-mono text-lg font-bold leading-none',
          tone === 'key' && 'text-key',
          tone === 'link' && 'text-link',
          tone === 'primary' && 'text-primary',
          tone === 'warn' && 'text-amber-500',
          !tone && 'text-foreground'
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
        {label}
      </p>
    </div>
  )
}
