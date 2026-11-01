'use client'

/**
 * SchemaCanvas.tsx  (visualization/SchemaCanvas)
 *
 * The main React Flow canvas for the schema visualization module.
 *
 * Responsibilities:
 * - Parse DatabaseSchema → NormalizedSchema
 * - Build React Flow nodes + edges
 * - Apply Dagre auto-layout with node-size-aware positioning
 * - Handle table selection, related-table highlighting, dimming
 * - Handle search and external focusSignal (e.g. Health "Focus in Diagram")
 * - Bridge smoothly with the main Dashboard application shell
 * - Support zoom, pan, drag, minimap, fit-view
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { parseInternalSchema } from '@/lib/schema/schemaParser'
import { buildGraph, TABLE_NODE_TYPE, REL_EDGE_TYPE, type RelEdgeData } from '@/lib/schema/graphBuilder'
import { applyDagreLayout, getTopologySignature } from '@/lib/schema/autoLayout'
import type { DatabaseSchema } from '@/lib/schema'
import type { NormalizedSchema } from '@/lib/schema/schemaParser'
import type { TableNodeData } from '@/lib/schema/graphBuilder'
import type { AnalysisResult } from '@/lib/schema-api'
import {
  getIssuesByTable,
  getHighestSeverity,
  buildHealthOverlayEdges,
} from '@/lib/schema/healthOverlay'
import { Activity, LayoutGrid, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

import { TableNode } from './TableNode'
import { RelationshipEdge } from './RelationshipEdge'
import { RelationshipPopover } from './RelationshipPopover'
import { SchemaToolbar } from './SchemaToolbar'
import { SchemaFilters, type VisualizationFilters, DEFAULT_FILTERS } from './SchemaFilters'
import { SchemaSearch } from './SchemaSearch'
import { SchemaStats } from './SchemaStats'
import { SchemaLegend } from './SchemaLegend'
import { TableDetailsPanel } from './TableDetailsPanel'

// ── Custom node / edge type maps (stable references) ────────────────────────
const nodeTypes = { [TABLE_NODE_TYPE]: TableNode }
const edgeTypes = { [REL_EDGE_TYPE]: RelationshipEdge }

// ── In-memory cache for user-arranged node positions per topology signature ───
const positionCache = new Map<string, Record<string, { x: number; y: number }>>()

// ── Empty state UI ────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="rounded-2xl border border-border bg-frost px-8 py-10 text-center shadow-sm backdrop-blur-md">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="mt-1 text-xs text-muted-foreground">Connect a database or load the demo schema to begin.</p>
      </div>
    </div>
  )
}

// ── Inner canvas (must be wrapped in ReactFlowProvider) ───────────────────────
type InnerProps = {
  schema: DatabaseSchema
  normalizedSchema: NormalizedSchema
  initialNodes: Node[]
  initialEdges: Edge[]
  topologySignature: string
  analysis?: AnalysisResult | null
  selectedTableId?: string | null
  activeColumnProp?: { table: string; column: string } | null
  matchedTableIds?: Set<string> | null
  focusSignal?: { tableId: string; columnName?: string | null; ruleId?: string | null; nonce: number } | null
  onSelectTable?: (id: string | null) => void
  onColumnClick?: (tableId: string, column: string) => void
  showInternalSearch?: boolean
  showInternalLegend?: boolean
  showInternalDetails?: boolean
  onViewData?: (tableName: string) => void
  onAddColumn?: (tableName: string) => void
  onDropTable?: (tableName: string) => void
  isDemo?: boolean
}

function SchemaCanvasInner({
  schema,
  normalizedSchema,
  initialNodes,
  initialEdges,
  topologySignature,
  analysis,
  selectedTableId,
  activeColumnProp,
  matchedTableIds: externalMatchedTableIds,
  focusSignal,
  onSelectTable,
  onColumnClick: onColumnClickProp,
  showInternalSearch = true,
  showInternalLegend = true,
  showInternalDetails = true,
  onViewData,
  onAddColumn,
  onDropTable,
  isDemo = false,
}: InnerProps) {
  const { fitView, getNode, getNodes } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const [selectedTable, setSelectedTable] = useState<string | null>(selectedTableId ?? null)
  const selectedTableRef = useRef<string | null>(selectedTable)
  selectedTableRef.current = selectedTable
  const [selectedEdge, setSelectedEdge] = useState<RelEdgeData | null>(null)
  const [activeColumn, setActiveColumn] = useState<string | null>(activeColumnProp?.column ?? null)
  const [layoutDir, setLayoutDir] = useState<'LR' | 'TB'>('LR')
  const [filters, setFilters] = useState<VisualizationFilters>(DEFAULT_FILTERS)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'schema' | 'health'>('schema')

  // ── Health data derivations ──────────────────────────────────────────────
  const issuesByTable = useMemo(() => getIssuesByTable(analysis ?? null), [analysis])
  const healthOverlayEdges = useMemo(
    () => buildHealthOverlayEdges(analysis ?? null, normalizedSchema.tables),
    [analysis, normalizedSchema.tables],
  )

  // ── Initial fit view on mount ────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.15, duration: 400 })
    }, 60)
    return () => clearTimeout(timer)
  }, [fitView])

  // ── Sync external selectedTableId prop if provided ──────────────────────
  useEffect(() => {
    if (selectedTableId !== undefined) {
      setSelectedTable(selectedTableId)
    }
  }, [selectedTableId])

  // ── Sync external activeColumnProp if provided ──────────────────────────
  useEffect(() => {
    if (activeColumnProp !== undefined) {
      setActiveColumn(activeColumnProp?.column ?? null)
    }
  }, [activeColumnProp])

  // ── Focus in Diagram on focusSignal (from Health / AppSidebar / search) ─
  const lastHandledNonceRef = useRef<number | null>(null)
  useEffect(() => {
    if (!focusSignal || focusSignal.nonce === lastHandledNonceRef.current) return
    lastHandledNonceRef.current = focusSignal.nonce
    const targetId = focusSignal.tableId
    setSelectedTable(targetId)
    if (focusSignal.columnName) {
      setActiveColumn(focusSignal.columnName)
    }
    if (focusSignal.ruleId === 'R003') {
      setViewMode('health')
    }
    // Auto-clear restrictive filters that would hide the focused table
    setFilters((prev) => {
      let next = { ...prev }
      let changed = false
      // If onlyConnected is active, check if target is connected
      if (next.onlyConnected) {
        const connectedIds = new Set<string>()
        normalizedSchema.relationships.forEach((r) => {
          connectedIds.add(r.sourceTable)
          connectedIds.add(r.targetTable)
        })
        if (!connectedIds.has(targetId)) {
          next.onlyConnected = false
          changed = true
        }
      }
      // If onlyHealthIssues is active, check if target has health issues
      if (next.onlyHealthIssues) {
        const targetLower = targetId.toLowerCase()
        const hasIssues = (issuesByTable.get(targetLower)?.length ?? 0) > 0
        if (!hasIssues) {
          next.onlyHealthIssues = false
          changed = true
        }
      }
      return changed ? next : prev
    })
    // Note: Do not invoke onSelectTable?.(targetId) here because focusSignal originated
    // from the parent (dashboard / search / sidebar), which already manages selectedTable
    // and activeColumn. Calling onSelectTable would accidentally reset activeColumn in the parent.
    requestAnimationFrame(() => {
      fitView({
        nodes: [{ id: targetId }],
        padding: 0.6,
        duration: 400,
      })
    })
  }, [focusSignal, fitView, normalizedSchema.relationships, issuesByTable])

  // ── Compute related tables for the selected table (declared FKs only) ────
  const relatedTableIds = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    if (!selectedTable) return set
    normalizedSchema.relationships.forEach((r) => {
      if (r.sourceTable === selectedTable) set.add(r.targetTable)
      if (r.targetTable === selectedTable) set.add(r.sourceTable)
    })
    return set
  }, [selectedTable, normalizedSchema.relationships])

  // ── Compute matching tables for internal search ───────────────────────────
  const internalMatchedTableIds = useMemo<Set<string> | null>(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    const set = new Set<string>()
    normalizedSchema.tables.forEach((t) => {
      if (
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q))
      ) {
        set.add(t.id)
      }
    })
    return set
  }, [search, normalizedSchema.tables])

  // Prefer externally bridged search matches if provided, otherwise internal
  const effectiveMatchedIds =
    externalMatchedTableIds !== undefined ? externalMatchedTableIds : internalMatchedTableIds

  // ── Highlight columns connected to an active FK column ───────────────────
  const highlightColumnsByTable = useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (!activeColumn || !selectedTable) return map
    normalizedSchema.relationships.forEach((r) => {
      if (r.sourceTable === selectedTable && r.sourceColumn === activeColumn) {
        if (!map.has(r.sourceTable)) map.set(r.sourceTable, new Set())
        if (!map.has(r.targetTable)) map.set(r.targetTable, new Set())
        map.get(r.sourceTable)!.add(r.sourceColumn)
        map.get(r.targetTable)!.add(r.targetColumn)
      }
    })
    return map
  }, [activeColumn, selectedTable, normalizedSchema.relationships])

  // ── Derive node state: Selected table > Direct related > Search match > Dimmed ─
  function getNodeState(id: string): TableNodeData['state'] {
    if (selectedTable) {
      if (id === selectedTable) return 'active'
      if (relatedTableIds.has(id)) return 'related'
      return 'dimmed'
    }
    if (effectiveMatchedIds && effectiveMatchedIds.size > 0) {
      return effectiveMatchedIds.has(id) ? 'active' : 'dimmed'
    }
    if (viewMode === 'health') {
      const hasIssues = (issuesByTable.get(id.toLowerCase())?.length ?? 0) > 0
      return hasIssues ? 'normal' : 'dimmed'
    }
    return 'normal'
  }

  // ── Derive hidden table IDs from restrictive filters ─────────────────────
  const hiddenTableIds = useMemo(() => {
    if (!filters.onlyConnected && !filters.onlyHealthIssues) {
      return new Set<string>()
    }
    const connectedIds = new Set<string>()
    normalizedSchema.relationships.forEach((r) => {
      connectedIds.add(r.sourceTable)
      connectedIds.add(r.targetTable)
    })
    const healthTableIds = new Set<string>()
    if (filters.onlyHealthIssues) {
      issuesByTable.forEach((issues, tableLower) => {
        if (issues.length > 0) {
          normalizedSchema.tables.forEach((t) => {
            if (t.id.toLowerCase() === tableLower || t.name.toLowerCase() === tableLower) {
              healthTableIds.add(t.id)
            }
          })
        }
      })
    }
    const hidden = new Set<string>()
    normalizedSchema.tables.forEach((t) => {
      let visible = true
      if (filters.onlyConnected && !connectedIds.has(t.id)) visible = false
      if (filters.onlyHealthIssues && !healthTableIds.has(t.id)) visible = false
      if (!visible) hidden.add(t.id)
    })
    return hidden
  }, [filters.onlyConnected, filters.onlyHealthIssues, issuesByTable, normalizedSchema.relationships, normalizedSchema.tables])

  // ── Apply node data (state, handlers, columns, health findings) ────────────
  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) => {
        const originalTable = normalizedSchema.tables.find((t) => t.id === node.id)
        if (!originalTable) return node

        // Apply filter: hide columns
        const tableForNode = filters.showColumns
          ? originalTable
          : { ...originalTable, columns: [] }

        // Apply filter: hide data types
        const tableWithTypes = filters.showDataTypes
          ? tableForNode
          : {
              ...tableForNode,
              columns: tableForNode.columns.map((c) => ({ ...c, dataType: '' })),
            }

        const tableIssues = issuesByTable.get(node.id.toLowerCase()) || []
        const highestSeverity = getHighestSeverity(tableIssues)

        return {
          ...node,
          hidden: hiddenTableIds.has(node.id),
          data: {
            ...node.data,
            table: tableWithTypes,
            state: getNodeState(node.id),
            activeColumn: selectedTable === node.id ? activeColumn : null,
            highlightColumns: highlightColumnsByTable.get(node.id),
            healthIssuesCount: tableIssues.length,
            highestSeverity,
            onSelect: handleSelectTable,
            onColumnClick: handleColumnClick,
          },
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, activeColumn, effectiveMatchedIds, filters, highlightColumnsByTable, relatedTableIds, issuesByTable, viewMode, hiddenTableIds])

  // ── Apply edge visibility based on filters / selection / viewMode ────────
  useEffect(() => {
    const baseEdges = viewMode === 'health'
      ? [...initialEdges, ...healthOverlayEdges]
      : initialEdges

    setEdges(
      baseEdges.map((edge) => {
        const isHeuristic = Boolean(edge.data?.isHeuristic)
        const isTouchingSelected =
          Boolean(selectedTable) &&
          (edge.source === selectedTable || edge.target === selectedTable)

        const isMatchRelated =
          !effectiveMatchedIds ||
          effectiveMatchedIds.has(edge.source) ||
          effectiveMatchedIds.has(edge.target)

        const isEndpointHidden = hiddenTableIds.has(edge.source) || hiddenTableIds.has(edge.target)
        const hidden = !filters.showRelationships || isEndpointHidden
        const dimmed = selectedTable ? !isTouchingSelected : !isMatchRelated

        return {
          ...edge,
          hidden,
          style: {
            opacity: hidden ? 0 : dimmed ? 0.15 : 1,
            stroke: isHeuristic
              ? edge.selected
                ? '#d97706'
                : isTouchingSelected
                  ? '#f59e0b'
                  : '#f59e0b'
              : edge.selected
                ? 'var(--color-link, #3b82f6)'
                : isTouchingSelected
                  ? 'var(--color-link, #3b82f6)'
                  : 'color-mix(in oklch, var(--color-muted-foreground, #888) 55%, transparent)',
            strokeWidth: edge.selected ? 2.5 : isTouchingSelected ? 2.2 : isHeuristic ? 2 : 1.5,
            strokeDasharray: isHeuristic ? '6 4' : undefined,
            transition: 'opacity 0.15s, stroke 0.15s',
          },
        }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, initialEdges, healthOverlayEdges, selectedTable, effectiveMatchedIds, filters.showRelationships, hiddenTableIds])

  // ── Handle table selection ────────────────────────────────────────────────
  const handleSelectTable = useCallback(
    (id: string) => {
      const next = selectedTableRef.current === id ? null : id
      setSelectedTable(next)
      setActiveColumn(null)
      setSelectedEdge(null)
      onSelectTable?.(next)
    },
    [onSelectTable],
  )

  // ── Handle column click ───────────────────────────────────────────────────
  const handleColumnClick = useCallback(
    (tableId: string, column: string) => {
      setSelectedTable(tableId)
      setActiveColumn((prev) => (prev === column ? null : column))
      setSelectedEdge(null)
      onSelectTable?.(tableId)
      onColumnClickProp?.(tableId, column)
    },
    [onSelectTable, onColumnClickProp],
  )

  // ── Handle edge click (relationship inspection) ───────────────────────────
  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    if (edge.data) {
      setSelectedEdge(edge.data as RelEdgeData)
    }
  }, [])

  // ── Clear selection on canvas background click ────────────────────────────
  const handlePaneClick = useCallback(() => {
    setSelectedTable(null)
    setActiveColumn(null)
    setSelectedEdge(null)
    onSelectTable?.(null)
  }, [onSelectTable])

  // ── Dismiss popover on Escape key ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEdge(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Auto-layout ───────────────────────────────────────────────────────────
  const handleAutoLayout = useCallback(
    (direction: 'LR' | 'TB') => {
      setLayoutDir(direction)
      const liveNodes = getNodes()
      setNodes((prev) => {
        // Merge measured dimensions so applyDagreLayout uses actual DOM sizes (including collapsed heights)
        const nodesToLayout = prev.map((n) => {
          const live = liveNodes.find((ln) => ln.id === n.id)
          return live?.measured ? { ...n, measured: live.measured } : n
        })
        const laid = applyDagreLayout(nodesToLayout, edges, direction)
        // Update position cache with the fresh Auto Layout positions
        const newCache: Record<string, { x: number; y: number }> = {}
        laid.forEach((n) => {
          newCache[n.id] = n.position
        })
        positionCache.set(topologySignature, newCache)
        return laid
      })
      requestAnimationFrame(() => {
        fitView({ padding: 0.15, duration: 400 })
      })
    },
    [edges, fitView, getNodes, setNodes, topologySignature],
  )

  // ── Search: focus first match (internal search only) ───────────────────────
  useEffect(() => {
    if (!internalMatchedTableIds || internalMatchedTableIds.size === 0) return
    const firstId = [...internalMatchedTableIds][0]
    const node = getNode(firstId)
    if (!node) return
    setSelectedTable(firstId)
    setFilters((prev) => {
      let next = { ...prev }
      let changed = false
      if (next.onlyConnected) {
        const connectedIds = new Set<string>()
        normalizedSchema.relationships.forEach((r) => {
          connectedIds.add(r.sourceTable)
          connectedIds.add(r.targetTable)
        })
        if (!connectedIds.has(firstId)) {
          next.onlyConnected = false
          changed = true
        }
      }
      if (next.onlyHealthIssues) {
        const hasIssues = (issuesByTable.get(firstId.toLowerCase())?.length ?? 0) > 0
        if (!hasIssues) {
          next.onlyHealthIssues = false
          changed = true
        }
      }
      return changed ? next : prev
    })
    setTimeout(() => {
      fitView({
        nodes: [{ id: firstId }],
        padding: 0.6,
        duration: 400,
      })
    }, 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalMatchedTableIds, getNode, fitView, normalizedSchema.relationships, issuesByTable])

  // ── Detail panel close ────────────────────────────────────────────────────
  const handleDetailClose = useCallback(() => {
    setSelectedTable(null)
    setActiveColumn(null)
    onSelectTable?.(null)
  }, [onSelectTable])

  // ── Detail panel: jump to related table ──────────────────────────────────
  const handleDetailSelectTable = useCallback(
    (id: string) => {
      setSelectedTable(id)
      onSelectTable?.(id)
      setFilters((prev) => {
        let next = { ...prev }
        let changed = false
        if (next.onlyConnected) {
          const connectedIds = new Set<string>()
          normalizedSchema.relationships.forEach((r) => {
            connectedIds.add(r.sourceTable)
            connectedIds.add(r.targetTable)
          })
          if (!connectedIds.has(id)) {
            next.onlyConnected = false
            changed = true
          }
        }
        if (next.onlyHealthIssues) {
          const hasIssues = (issuesByTable.get(id.toLowerCase())?.length ?? 0) > 0
          if (!hasIssues) {
            next.onlyHealthIssues = false
            changed = true
          }
        }
        return changed ? next : prev
      })
      setTimeout(() => fitView({ nodes: [{ id }], padding: 0.5, duration: 400 }), 50)
    },
    [fitView, onSelectTable, normalizedSchema.relationships, issuesByTable],
  )

  // ── Node change handler (drag, etc.) with position caching ────────────────
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)
      // Save position updates to cache for this topology signature
      const cached = positionCache.get(topologySignature) || {}
      changes.forEach((change) => {
        if (change.type === 'position' && change.position && change.id) {
          cached[change.id] = change.position
        }
      })
      positionCache.set(topologySignature, cached)
    },
    [onNodesChange, topologySignature],
  )

  const matchCount = effectiveMatchedIds?.size ?? null

  // ── Compute visible table count for stats indicator ────────────────────────
  const visibleTableCount = normalizedSchema.tables.length - hiddenTableIds.size

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={handlePaneClick}
        onEdgeClick={handleEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        {/* Dot-grid background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="color-mix(in oklch, var(--color-primary, #16a34a) 20%, transparent)"
        />

        {/* Mini-map */}
        <MiniMap
          nodeColor={(n) => {
            const s = (n.data as TableNodeData)?.state
            if (s === 'active') return 'var(--color-primary, #16a34a)'
            if (s === 'related') return 'var(--color-link, #3b82f6)'
            return 'var(--color-border, #e2e8f0)'
          }}
          maskColor="color-mix(in oklch, var(--color-background, #fff) 80%, transparent)"
          style={{ borderRadius: 12, border: '1px solid var(--color-border)' }}
        />

        {/* Built-in zoom/fit controls (bottom-left, hidden — we use custom toolbar) */}
        <Controls showInteractive={false} className="!hidden" />
      </ReactFlow>

      {/* ── Overlay UI ─────────────────────────────────────────────────── */}

      {/* Top-left: title + legend + stats */}
      {showInternalLegend && (
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
          <div className="pointer-events-auto rounded-xl border border-border bg-frost px-3.5 py-2 shadow-sm backdrop-blur-md">
            <h1 className="text-sm font-semibold">Database Schema</h1>
            <p className="text-[11px] text-muted-foreground">
              {normalizedSchema.databaseName} · {normalizedSchema.databaseType}
            </p>
          </div>
          <div className="pointer-events-auto">
            <SchemaLegend hasHealthData={Boolean(analysis)} />
          </div>
          <div className="pointer-events-auto">
            <SchemaStats schema={normalizedSchema} visibleTableCount={visibleTableCount} />
          </div>
        </div>
      )}

      {/* Top-right: search (shown only when not handled externally by dashboard) */}
      {showInternalSearch && (
        <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
          <div className="pointer-events-auto">
            <SchemaSearch
              schema={schema}
              value={search}
              onChange={setSearch}
              onSelectResult={(res) => handleDetailSelectTable(res.tableId)}
              matchCount={matchCount}
            />
          </div>
        </div>
      )}

      {/* Bottom-left: View Mode + Filters + Toolbar */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2">
        {/* View Mode Toggle: Schema | Health */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-frost p-1 shadow-md backdrop-blur-md">
          <button
            type="button"
            onClick={() => setViewMode('schema')}
            data-testid="view-mode-schema"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
              viewMode === 'schema'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Schema</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('health')}
            data-testid="view-mode-health"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
              viewMode === 'health'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Health</span>
            {analysis?.summary?.issues !== undefined && analysis.summary.issues > 0 && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  viewMode === 'health'
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
                )}
              >
                {analysis.summary.issues}
              </span>
            )}
          </button>
        </div>

        {/* Health Score Pill in Health Mode */}
        {viewMode === 'health' && analysis?.summary && (
          <div
            data-testid="health-score-banner"
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-amber-500/30 bg-frost/95 px-3 py-1.5 text-xs shadow-md backdrop-blur-md animate-in fade-in duration-200"
          >
            <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-[11px] font-semibold text-foreground">
                {(analysis.summary.healthScoreLabel || 'Project-Defined Health Score') + ': '}
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                {analysis.summary.healthScore}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({analysis.summary.healthGrade})
              </span>
            </div>
          </div>
        )}

        <div className="pointer-events-auto">
          <SchemaFilters filters={filters} onChange={setFilters} healthDisabled={!analysis} />
        </div>
        <div className="pointer-events-auto">
          <SchemaToolbar onAutoLayout={handleAutoLayout} layoutDirection={layoutDir} />
        </div>
      </div>

      {/* Relationship inspection popover */}
      {selectedEdge && (
        <RelationshipPopover
          edge={selectedEdge}
          onClose={() => setSelectedEdge(null)}
        />
      )}

      {/* Right side: detail panel (shown only when not handled externally by dashboard) */}
      {showInternalDetails && selectedTable && (
        <TableDetailsPanel
          schema={normalizedSchema}
          selectedTableId={selectedTable}
          activeColumn={activeColumn}
          tableIssues={selectedTable ? issuesByTable.get(selectedTable.toLowerCase()) : undefined}
          onClose={handleDetailClose}
          onSelectTable={handleDetailSelectTable}
          onViewData={onViewData}
          onAddColumn={onAddColumn}
          onDropTable={onDropTable}
          isDemo={isDemo}
        />
      )}
    </div>
  )
}

// ── Public component (wraps in ReactFlowProvider) ────────────────────────────
export type SchemaCanvasProps = {
  schema: DatabaseSchema | null
  isLoading?: boolean
  error?: string | null
  analysis?: AnalysisResult | null
  selectedTableId?: string | null
  activeColumn?: { table: string; column: string } | null
  matchedTableIds?: Set<string> | null
  focusSignal?: { tableId: string; columnName?: string | null; ruleId?: string | null; nonce: number } | null
  onSelectTable?: (id: string | null) => void
  onColumnClick?: (tableId: string, column: string) => void
  showInternalSearch?: boolean
  showInternalLegend?: boolean
  showInternalDetails?: boolean
  onViewData?: (tableName: string) => void
  onAddColumn?: (tableName: string) => void
  onDropTable?: (tableName: string) => void
  isDemo?: boolean
}

export function SchemaCanvas({
  schema,
  isLoading,
  error,
  analysis,
  selectedTableId,
  activeColumn,
  matchedTableIds,
  focusSignal,
  onSelectTable,
  onColumnClick,
  showInternalSearch = true,
  showInternalLegend = true,
  showInternalDetails = true,
  onViewData,
  onAddColumn,
  onDropTable,
  isDemo = false,
}: SchemaCanvasProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="rounded-2xl border border-border bg-frost px-8 py-10 text-center shadow-sm backdrop-blur-md">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="text-sm font-medium">Loading schema…</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-8 py-10 text-center shadow-sm backdrop-blur-md">
          <p className="text-sm font-semibold text-destructive">Error loading schema</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  // Empty / no schema state
  if (!schema || schema.tables.length === 0) {
    return <EmptyState message="No schema loaded" />
  }

  // Compute topology signature to determine whether graph structure has changed
  const topologySignature = useMemo(() => getTopologySignature(schema), [schema])

  // Parse and build graph with initial Dagre layout only when topology signature changes
  const { normalizedSchema, initialNodes, initialEdges } = useMemo(() => {
    if (!schema || schema.tables.length === 0) {
      return { normalizedSchema: null, initialNodes: [], initialEdges: [] }
    }
    const normalized = parseInternalSchema(schema)
    const { nodes: rawNodes, edges: rawEdges } = buildGraph(normalized)
    const layoutNodes = applyDagreLayout(rawNodes, rawEdges, 'LR')

    // If user previously manually arranged nodes for this topology signature, restore them
    const cached = positionCache.get(topologySignature)
    const finalNodes = cached
      ? layoutNodes.map((n) => (cached[n.id] ? { ...n, position: cached[n.id] } : n))
      : layoutNodes

    return {
      normalizedSchema: normalized,
      initialNodes: finalNodes,
      initialEdges: rawEdges,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topologySignature])

  if (!normalizedSchema || initialNodes.length === 0) {
    return <EmptyState message="No schema loaded" />
  }

  return (
    <ReactFlowProvider>
      <SchemaCanvasInner
        key={topologySignature}
        schema={schema}
        normalizedSchema={normalizedSchema}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        topologySignature={topologySignature}
        analysis={analysis}
        selectedTableId={selectedTableId}
        activeColumnProp={activeColumn}
        matchedTableIds={matchedTableIds}
        focusSignal={focusSignal}
        onSelectTable={onSelectTable}
        onColumnClick={onColumnClick}
        showInternalSearch={showInternalSearch}
        showInternalLegend={showInternalLegend}
        showInternalDetails={showInternalDetails}
        onViewData={onViewData}
        onAddColumn={onAddColumn}
        onDropTable={onDropTable}
        isDemo={isDemo}
      />
    </ReactFlowProvider>
  )
}
