'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  fetchTableData,
  insertTableRow,
  updateTableRow,
  deleteTableRow,
  type TableColumnMetadata,
} from '@/lib/schema-api'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  Database,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTableModalProps {
  tableName: string | null
  onClose: () => void
  tables?: { id: string; name: string }[]
  onSelectTable?: (name: string) => void
  isDemo?: boolean
}

export function DataTableModal({
  tableName: initialTableName,
  onClose,
  tables = [],
  onSelectTable,
  isDemo = false,
}: DataTableModalProps) {
  const [currentTable, setCurrentTable] = useState<string | null>(initialTableName)
  const [data, setData] = useState<Record<string, any>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [columnMeta, setColumnMeta] = useState<TableColumnMetadata[]>([])
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // CRUD Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null)
  const [deletingRow, setDeletingRow] = useState<Record<string, any> | null>(null)
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)

  const pageSize = 25

  useEffect(() => {
    setCurrentTable(initialTableName)
  }, [initialTableName])

  function showToast(type: 'success' | 'error', message: string) {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev))
    }, 4000)
  }

  // Load table data and metadata
  async function loadData() {
    if (!currentTable) return
    setLoading(true)
    setError(null)

    try {
      const offset = (page - 1) * pageSize
      const result = await fetchTableData(currentTable, pageSize, offset)
      setData(result.rows || [])
      setTotal(result.totalCount || 0)
      setPrimaryKeys(result.primaryKeys || [])

      if (result.columns && result.columns.length > 0) {
        setColumnMeta(result.columns)
        setColumns(result.columns.map((c) => c.name))
      } else if (result.rows && result.rows.length > 0) {
        setColumns(Object.keys(result.rows[0]))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch table records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentTable, page])

  // Filter rows locally by searchTerm
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data
    const term = searchTerm.toLowerCase()
    return data.filter((row) =>
      Object.values(row).some((val) => {
        if (val === null || val === undefined) return false
        return String(val).toLowerCase().includes(term)
      })
    )
  }, [data, searchTerm])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Open Create Dialog
  function openCreateDialog() {
    const initial: Record<string, any> = {}
    columns.forEach((col) => {
      initial[col] = ''
    })
    setFormValues(initial)
    setIsCreateOpen(true)
  }

  // Open Edit Dialog
  function openEditDialog(row: Record<string, any>) {
    setEditingRow(row)
    setFormValues({ ...row })
  }

  // Submit Create Record
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentTable) return

    setSubmitting(true)
    try {
      // Build clean payload: omit empty auto-increment fields or empty strings on nullable fields
      const payload: Record<string, any> = {}
      for (const [key, val] of Object.entries(formValues)) {
        const meta = columnMeta.find((c) => c.name === key)
        const isAutoInc = meta?.extra?.toLowerCase().includes('auto_increment')

        if (isAutoInc && (val === '' || val === null || val === undefined)) {
          continue // skip auto-increment PK when empty
        }

        if (val === '' && meta?.nullable) {
          payload[key] = null
        } else {
          payload[key] = val
        }
      }

      await insertTableRow(currentTable, payload)
      showToast('success', 'Record created successfully.')
      setIsCreateOpen(false)
      loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create record.')
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Update Record
  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentTable || !editingRow) return

    setSubmitting(true)
    try {
      // Build criteria using primary keys if available, else original row
      const criteria: Record<string, any> = {}
      if (primaryKeys.length > 0) {
        primaryKeys.forEach((pk) => {
          criteria[pk] = editingRow[pk]
        })
      } else {
        Object.keys(editingRow).forEach((k) => {
          if (editingRow[k] !== null) criteria[k] = editingRow[k]
        })
      }

      // Build update payload
      const updates: Record<string, any> = {}
      for (const [key, val] of Object.entries(formValues)) {
        // Exclude primary key columns from update payload (they belong in criteria)
        if (primaryKeys.includes(key)) continue

        const meta = columnMeta.find((c) => c.name === key)
        if (val === '' && meta?.nullable) {
          updates[key] = null
        } else {
          updates[key] = val
        }
      }

      await updateTableRow(currentTable, criteria, updates)
      showToast('success', 'Record updated successfully.')
      setEditingRow(null)
      loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update record.')
    } finally {
      setSubmitting(false)
    }
  }

  // Submit Delete Record
  async function handleDeleteConfirm() {
    if (!currentTable || !deletingRow) return

    setSubmitting(true)
    try {
      const criteria: Record<string, any> = {}
      if (primaryKeys.length > 0) {
        primaryKeys.forEach((pk) => {
          criteria[pk] = deletingRow[pk]
        })
      } else {
        Object.keys(deletingRow).forEach((k) => {
          if (deletingRow[k] !== null) criteria[k] = deletingRow[k]
        })
      }

      await deleteTableRow(currentTable, criteria)
      showToast('success', 'Record deleted successfully.')
      setDeletingRow(null)
      loadData()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete record.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!currentTable) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative flex h-[85vh] w-full max-w-6xl animate-in fade-in zoom-in-95 flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Toast Notification */}
        {notification && (
          <div
            className={cn(
              'absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border px-4 py-2 text-xs shadow-lg backdrop-blur-md transition-all',
              notification.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            )}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-border bg-frost px-6 py-3.5 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Record Manager (CRUD)</h2>
                {/* Table Switcher Dropdown */}
                {tables.length > 0 ? (
                  <select
                    value={currentTable}
                    onChange={(e) => {
                      setCurrentTable(e.target.value)
                      setPage(1)
                      if (onSelectTable) onSelectTable(e.target.value)
                    }}
                    className="h-7 rounded-md border border-border bg-background px-2 text-xs font-semibold text-primary outline-none focus:border-ring"
                  >
                    {tables.map((t) => (
                      <option key={t.id || t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono text-sm font-semibold text-primary">{currentTable}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {total} total records · {columns.length} columns
                {primaryKeys.length > 0 && ` · PK: [${primaryKeys.join(', ')}]`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isDemo && (
              <button
                type="button"
                onClick={openCreateDialog}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Record</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Refresh records"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/20 px-6 py-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search in ${currentTable} records...`}
              className="h-7 w-full rounded-md border border-input bg-background/80 pl-8 pr-7 text-xs outline-none transition-colors focus:border-ring"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {primaryKeys.length === 0 && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              Note: Table has no primary key defined.
            </span>
          )}
        </div>

        {/* Main Table Area */}
        <div className="flex-1 overflow-auto p-4">
          {loading && data.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 text-destructive">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="text-sm font-semibold">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground"
              >
                Retry
              </button>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8">
              <Database className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm font-medium">
                {searchTerm ? 'No records match your search.' : 'Table contains 0 records.'}
              </p>
              {!isDemo && !searchTerm && (
                <button
                  type="button"
                  onClick={openCreateDialog}
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Insert First Record</span>
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-background overflow-hidden shadow-2xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur-md font-semibold text-muted-foreground border-b border-border z-10">
                  <tr>
                    <th className="w-12 px-3 py-2 text-center text-[10px] font-mono uppercase tracking-wider border-r border-border/40">
                      #
                    </th>
                    {columns.map((col) => {
                      const isPk = primaryKeys.includes(col)
                      return (
                        <th
                          key={col}
                          className="px-3 py-2 font-mono text-[11px] text-foreground tracking-tight whitespace-nowrap border-r border-border/40 last:border-r-0"
                        >
                          <div className="flex items-center gap-1.5">
                            {isPk && <KeyRound className="h-3 w-3 text-amber-500 shrink-0" />}
                            <span>{col}</span>
                          </div>
                        </th>
                      )
                    })}
                    {!isDemo && (
                      <th className="w-24 px-3 py-2 text-center font-medium whitespace-nowrap">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                  {filteredData.map((row, rowIdx) => {
                    const rowNumber = (page - 1) * pageSize + rowIdx + 1
                    return (
                      <tr key={rowIdx} className="hover:bg-accent/40 transition-colors even:bg-muted/10">
                        <td className="w-12 px-3 py-1.5 text-center text-[10px] text-muted-foreground border-r border-border/40 select-none">
                          {rowNumber}
                        </td>
                        {columns.map((col) => {
                          const val = row[col]
                          const isNull = val === null || val === undefined
                          return (
                            <td
                              key={col}
                              className="px-3 py-1.5 whitespace-nowrap text-foreground border-r border-border/40 last:border-r-0 max-w-xs truncate"
                              title={isNull ? 'NULL' : String(val)}
                            >
                              {isNull ? (
                                <span className="italic text-muted-foreground/60 select-none">NULL</span>
                              ) : typeof val === 'boolean' ? (
                                <span
                                  className={cn(
                                    'rounded px-1 text-[10px] font-semibold',
                                    val ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
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
                        {!isDemo && (
                          <td className="w-24 px-3 py-1.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditDialog(row)}
                                className="rounded p-1 text-primary hover:bg-primary/10 transition-colors"
                                title="Edit record"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingRow(row)}
                                className="rounded p-1 text-destructive hover:bg-destructive/10 transition-colors"
                                title="Delete record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between border-t border-border bg-frost px-6 py-3 text-xs text-muted-foreground">
          <div>
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, total)} of {total} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="flex items-center rounded-lg border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Prev
            </button>
            <span className="text-xs font-medium text-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="flex items-center rounded-lg border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-40 transition-colors"
            >
              Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── CREATE RECORD MODAL ── */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  Insert Record into <span className="font-mono text-primary">{currentTable}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {columns.map((col) => {
                  const meta = columnMeta.find((c) => c.name === col)
                  const isAutoInc = meta?.extra?.toLowerCase().includes('auto_increment')
                  const isPk = primaryKeys.includes(col)

                  return (
                    <div key={col} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <label className="font-mono font-medium text-foreground flex items-center gap-1">
                          {isPk && <KeyRound className="h-3 w-3 text-amber-500" />}
                          <span>{col}</span>
                        </label>
                        <span className="text-[10px] text-muted-foreground">
                          {meta?.type?.toUpperCase() || 'VARCHAR'}
                          {isAutoInc ? ' (auto_inc)' : meta?.nullable ? ' (optional)' : ' (required)'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formValues[col] ?? ''}
                        onChange={(e) => setFormValues({ ...formValues, [col]: e.target.value })}
                        placeholder={isAutoInc ? 'Auto-generated ID (can leave blank)' : `Value for ${col}`}
                        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring focus:ring-1"
                      />
                    </div>
                  )
                })}

                <div className="flex justify-end gap-2 pt-3 border-t border-border mt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── EDIT RECORD MODAL ── */}
        {editingRow && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  Edit Record in <span className="font-mono text-primary">{currentTable}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateSubmit} className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {columns.map((col) => {
                  const meta = columnMeta.find((c) => c.name === col)
                  const isPk = primaryKeys.includes(col)

                  return (
                    <div key={col} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <label className="font-mono font-medium text-foreground flex items-center gap-1">
                          {isPk && <KeyRound className="h-3 w-3 text-amber-500" />}
                          <span>{col}</span>
                        </label>
                        <span className="text-[10px] text-muted-foreground">
                          {meta?.type?.toUpperCase() || 'VARCHAR'}
                          {isPk ? ' (Primary Key)' : meta?.nullable ? ' (optional)' : ' (required)'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formValues[col] ?? ''}
                        disabled={isPk}
                        onChange={(e) => setFormValues({ ...formValues, [col]: e.target.value })}
                        className={cn(
                          'w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring focus:ring-1',
                          isPk && 'opacity-60 bg-muted cursor-not-allowed'
                        )}
                      />
                    </div>
                  )
                })}

                <div className="flex justify-end gap-2 pt-3 border-t border-border mt-4">
                  <button
                    type="button"
                    onClick={() => setEditingRow(null)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── DELETE CONFIRMATION MODAL ── */}
        {deletingRow && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm animate-in fade-in zoom-in-95 rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl">
              <div className="flex items-center gap-3 text-destructive">
                <Trash2 className="h-5 w-5" />
                <h3 className="text-sm font-semibold">Delete Record</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete this record from{' '}
                <strong className="text-foreground font-mono">{currentTable}</strong>?
                This action is permanent and cannot be undone.
              </p>

              <div className="mt-3 rounded-lg border border-border bg-muted/40 p-2 font-mono text-[11px] max-h-32 overflow-y-auto">
                {Object.entries(deletingRow).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">{k}:</span>
                    <span className="text-foreground font-semibold">{String(v)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setDeletingRow(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={submitting}
                  className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {submitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
