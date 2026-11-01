'use client'

import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Minus, Plus, Waypoints } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DatabaseSchema } from '@/lib/schema'
import { TableNodeCard } from './table-node'
import { HEADER_HEIGHT, ROW_HEIGHT, TABLE_WIDTH, tableHeight } from './diagram-constants'

type ActiveColumn = { table: string; column: string } | null

type Props = {
  schema: DatabaseSchema
  selectedTable: string | null
  activeColumn: ActiveColumn
  matchedTables: Set<string> | null
  onSelectTable: (id: string | null) => void
  onColumnClick: (tableId: string, column: string) => void
  onExplainRelationship: (relId: string) => void
  focusSignal: { tableId: string; nonce: number } | null
}

type Transform = { x: number; y: number; scale: number }

export function SchemaCanvas({
  schema,
  selectedTable,
  activeColumn,
  matchedTables,
  onSelectTable,
  onColumnClick,
  onExplainRelationship,
  focusSignal,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(schema.tables.map((t) => [t.id, { x: t.x, y: t.y }])),
  )
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })

  // reset positions when the schema (database) changes
  useEffect(() => {
    setPositions(Object.fromEntries(schema.tables.map((t) => [t.id, { x: t.x, y: t.y }])))
  }, [schema])

  const tables = useMemo(
    () => schema.tables.map((t) => ({ ...t, x: positions[t.id]?.x ?? t.x, y: positions[t.id]?.y ?? t.y })),
    [schema.tables, positions],
  )

  const colIndex = useCallback(
    (tableId: string, column: string) => {
      const t = schema.tables.find((x) => x.id === tableId)
      return t ? t.columns.findIndex((c) => c.name === column) : -1
    },
    [schema.tables],
  )

  /* ---------- related-table + relationship highlight sets ---------- */
  const relatedTables = useMemo(() => {
    const set = new Set<string>()
    if (selectedTable) {
      set.add(selectedTable)
      schema.relationships.forEach((r) => {
        if (r.from.table === selectedTable) set.add(r.to.table)
        if (r.to.table === selectedTable) set.add(r.from.table)
      })
    }
    if (activeColumn) {
      schema.relationships.forEach((r) => {
        if (
          (r.from.table === activeColumn.table && r.from.column === activeColumn.column) ||
          (r.to.table === activeColumn.table && r.to.column === activeColumn.column)
        ) {
          set.add(r.from.table)
          set.add(r.to.table)
        }
      })
    }
    return set
  }, [selectedTable, activeColumn, schema.relationships])

  const highlightAll = !selectedTable && !activeColumn && !matchedTables

  function tableState(id: string): 'normal' | 'active' | 'related' | 'dimmed' {
    if (matchedTables) return matchedTables.has(id) ? 'active' : 'dimmed'
    if (highlightAll) return 'normal'
    if (id === selectedTable) return 'active'
    if (relatedTables.has(id)) return 'related'
    return 'dimmed'
  }

  const activeColumnsByTable = useMemo(() => {
    // columns to highlight on each table when a relationship is active
    const map = new Map<string, Set<string>>()
    const add = (t: string, c: string) => {
      if (!map.has(t)) map.set(t, new Set())
      map.get(t)!.add(c)
    }
    if (activeColumn) {
      schema.relationships.forEach((r) => {
        if (r.from.table === activeColumn.table && r.from.column === activeColumn.column) {
          add(r.from.table, r.from.column)
          add(r.to.table, r.to.column)
        }
        if (r.to.table === activeColumn.table && r.to.column === activeColumn.column) {
          add(r.from.table, r.from.column)
          add(r.to.table, r.to.column)
        }
      })
    }
    return map
  }, [activeColumn, schema.relationships])

  /* ---------- connection geometry ---------- */
  const connections = useMemo(() => {
    return schema.relationships.map((r) => {
      const fromT = tables.find((t) => t.id === r.from.table)!
      const toT = tables.find((t) => t.id === r.to.table)!
      const fromIdx = colIndex(r.from.table, r.from.column)
      const toIdx = colIndex(r.to.table, r.to.column)

      const fromCenterX = fromT.x + TABLE_WIDTH / 2
      const toCenterX = toT.x + TABLE_WIDTH / 2
      const fromRight = fromCenterX < toCenterX

      const fx = fromRight ? fromT.x + TABLE_WIDTH : fromT.x
      const tx = fromRight ? toT.x : toT.x + TABLE_WIDTH
      const fy = fromT.y + HEADER_HEIGHT + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2
      const ty = toT.y + HEADER_HEIGHT + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2

      const dx = Math.max(40, Math.abs(tx - fx) * 0.4)
      const c1x = fromRight ? fx + dx : fx - dx
      const c2x = fromRight ? tx - dx : tx + dx
      const path = `M ${fx} ${fy} C ${c1x} ${fy}, ${c2x} ${ty}, ${tx} ${ty}`

      const active =
        (selectedTable && (r.from.table === selectedTable || r.to.table === selectedTable)) ||
        (activeColumn &&
          ((r.from.table === activeColumn.table && r.from.column === activeColumn.column) ||
            (r.to.table === activeColumn.table && r.to.column === activeColumn.column))) ||
        (matchedTables && (matchedTables.has(r.from.table) || matchedTables.has(r.to.table)))

      return {
        id: r.id,
        path,
        midX: (fx + tx) / 2,
        midY: (fy + ty) / 2,
        cardinality: r.cardinality,
        active: Boolean(active),
        dimmed: !highlightAll && !active,
      }
    })
  }, [schema.relationships, tables, colIndex, selectedTable, activeColumn, matchedTables, highlightAll])

  /* ---------- canvas size ---------- */
  const canvasSize = useMemo(() => {
    let maxX = 0
    let maxY = 0
    tables.forEach((t) => {
      maxX = Math.max(maxX, t.x + TABLE_WIDTH)
      maxY = Math.max(maxY, t.y + tableHeight(t.columns.length))
    })
    return { w: maxX + 120, h: maxY + 120 }
  }, [tables])

  /* ---------- dragging nodes ---------- */
  const drag = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const pan = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const onPointerDownHeader = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation()
      const p = positions[id] ?? { x: 0, y: 0 }
      drag.current = { id, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y }
    },
    [positions],
  )

  useEffect(() => {
    function move(e: PointerEvent) {
      if (drag.current) {
        const d = drag.current
        const dx = (e.clientX - d.startX) / transform.scale
        const dy = (e.clientY - d.startY) / transform.scale
        setPositions((prev) => ({ ...prev, [d.id]: { x: d.origX + dx, y: d.origY + dy } }))
      } else if (pan.current) {
        const p = pan.current
        setTransform((prev) => ({ ...prev, x: p.origX + (e.clientX - p.startX), y: p.origY + (e.clientY - p.startY) }))
      }
    }
    function up() {
      drag.current = null
      pan.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [transform.scale])

  function onBackgroundPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    pan.current = { startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y }
    onSelectTable(null)
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) {
      // treat plain wheel as zoom for a diagram-first canvas
    }
    e.preventDefault()
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setTransform((prev) => {
      const next = Math.min(2, Math.max(0.3, prev.scale * factor))
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      // keep the point under the cursor stable
      const cx = (mx - prev.x) / prev.scale
      const cy = (my - prev.y) / prev.scale
      return { scale: next, x: mx - cx * next, y: my - cy * next }
    })
  }

  const zoomBy = useCallback((factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    setTransform((prev) => {
      const next = Math.min(2, Math.max(0.3, prev.scale * factor))
      if (!rect) return { ...prev, scale: next }
      const mx = rect.width / 2
      const my = rect.height / 2
      const cx = (mx - prev.x) / prev.scale
      const cy = (my - prev.y) / prev.scale
      return { scale: next, x: mx - cx * next, y: my - cy * next }
    })
  }, [])

  const fit = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const scale = Math.min(1, Math.min(rect.width / canvasSize.w, rect.height / canvasSize.h) * 0.92)
    const x = (rect.width - canvasSize.w * scale) / 2
    const y = (rect.height - canvasSize.h * scale) / 2
    setTransform({ x, y, scale })
  }, [canvasSize])

  // fit once on mount / schema change
  useEffect(() => {
    const id = requestAnimationFrame(fit)
    return () => cancelAnimationFrame(id)
  }, [fit])

  // center on a focused table (from sidebar / search)
  useEffect(() => {
    if (!focusSignal) return
    const rect = viewportRef.current?.getBoundingClientRect()
    const t = tables.find((x) => x.id === focusSignal.tableId)
    if (!rect || !t) return
    const scale = Math.max(transform.scale, 0.8)
    const cx = t.x + TABLE_WIDTH / 2
    const cy = t.y + tableHeight(t.columns.length) / 2
    setTransform({ scale, x: rect.width / 2 - cx * scale, y: rect.height / 2 - cy * scale })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal?.nonce])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* frosted grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--primary) 22%, transparent) 1px, transparent 0)',
          backgroundSize: '26px 26px',
        }}
      />

      <div
        ref={viewportRef}
        onPointerDown={onBackgroundPointerDown}
        onWheel={onWheel}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            width: canvasSize.w,
            height: canvasSize.h,
          }}
        >
          {/* relationship lines */}
          <svg
            className="absolute left-0 top-0 overflow-visible"
            width={canvasSize.w}
            height={canvasSize.h}
            style={{ pointerEvents: 'none' }}
          >
            <defs>
              <marker id="arrow-active" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M0,0 L9,4.5 L0,9 Z" fill="var(--link)" />
              </marker>
              <marker id="arrow-idle" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="color-mix(in oklch, var(--muted-foreground) 60%, transparent)" />
              </marker>
            </defs>
            {connections.map((c) => (
              <g key={c.id} className={cn('transition-opacity', c.dimmed && 'opacity-20')}>
                <path
                  d={c.path}
                  fill="none"
                  stroke={c.active ? 'var(--link)' : 'color-mix(in oklch, var(--muted-foreground) 55%, transparent)'}
                  strokeWidth={c.active ? 2.5 : 1.5}
                  markerEnd={c.active ? 'url(#arrow-active)' : 'url(#arrow-idle)'}
                />
                <g
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onExplainRelationship(c.id)
                  }}
                  transform={`translate(${c.midX} ${c.midY})`}
                >
                  <rect
                    x={-16}
                    y={-11}
                    width={32}
                    height={20}
                    rx={6}
                    fill="var(--card)"
                    stroke={c.active ? 'var(--link)' : 'var(--border)'}
                    strokeWidth={1}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                    fill={c.active ? 'var(--link)' : 'var(--muted-foreground)'}
                    fontWeight={600}
                  >
                    {c.cardinality}
                  </text>
                </g>
              </g>
            ))}
          </svg>

          {/* table nodes */}
          {tables.map((t) => (
            <TableNodeCard
              key={t.id}
              table={t}
              state={tableState(t.id)}
              activeColumn={activeColumn?.table === t.id ? activeColumn.column : null}
              highlightColumns={activeColumnsByTable.get(t.id)}
              onPointerDownHeader={onPointerDownHeader}
              onSelect={onSelectTable}
              onColumnClick={onColumnClick}
            />
          ))}
        </div>
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-xl border border-border bg-frost p-1 shadow-md backdrop-blur-md">
        <button
          type="button"
          onClick={() => zoomBy(1.15)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.87)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={fit}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent"
          aria-label="Fit to screen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* zoom readout */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-border bg-frost px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-md">
        <Waypoints className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono">{Math.round(transform.scale * 100)}%</span>
        <span className="hidden sm:inline">· drag headers to move · scroll to zoom</span>
      </div>
    </div>
  )
}
