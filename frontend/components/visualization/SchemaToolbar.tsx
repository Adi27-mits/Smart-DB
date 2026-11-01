'use client'

/**
 * SchemaToolbar.tsx  (visualization/SchemaToolbar)
 *
 * Floating toolbar inside the canvas with:
 * - Auto-layout / Re-arrange button
 * - Zoom in / out / fit controls
 * - Layout direction toggle (LR / TB)
 */

import { LayoutGrid, Minus, Maximize2, Plus, ArrowRightLeft, ArrowUpDown } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { cn } from '@/lib/utils'

type Props = {
  onAutoLayout: (direction: 'LR' | 'TB') => void
  layoutDirection: 'LR' | 'TB'
}

export function SchemaToolbar({ onAutoLayout, layoutDirection }: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-frost px-2 py-1.5 shadow-md backdrop-blur-md">
      {/* Auto layout */}
      <ToolBtn
        onClick={() => onAutoLayout(layoutDirection)}
        title="Auto-arrange tables with Dagre layout"
        label="Auto Layout"
        icon={<LayoutGrid className="h-3.5 w-3.5" />}
        showLabel
        testId="auto-layout-btn"
      />

      <div className="mx-1 h-5 w-px bg-border" />

      {/* Direction toggle */}
      <ToolBtn
        onClick={() => onAutoLayout(layoutDirection === 'LR' ? 'TB' : 'LR')}
        title={layoutDirection === 'LR' ? 'Switch to Top-to-Bottom layout (TB)' : 'Switch to Left-to-Right layout (LR)'}
        label={layoutDirection === 'LR' ? 'TB' : 'LR'}
        icon={layoutDirection === 'LR' ? <ArrowUpDown className="h-3.5 w-3.5" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
        showLabel
        testId="layout-direction-btn"
      />

      <div className="mx-1 h-5 w-px bg-border" />

      {/* Zoom controls */}
      <ToolBtn onClick={() => zoomIn()} title="Zoom in" icon={<Plus className="h-3.5 w-3.5" />} testId="zoom-in-btn" />
      <ToolBtn onClick={() => zoomOut()} title="Zoom out" icon={<Minus className="h-3.5 w-3.5" />} testId="zoom-out-btn" />
      <ToolBtn onClick={() => fitView({ padding: 0.15, duration: 400 })} title="Fit diagram to viewport" icon={<Maximize2 className="h-3.5 w-3.5" />} testId="fit-view-btn" />
    </div>
  )
}

function ToolBtn({
  onClick,
  title,
  icon,
  label,
  showLabel,
  testId,
}: {
  onClick: () => void
  title: string
  icon: React.ReactNode
  label?: string
  showLabel?: boolean
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      data-testid={testId}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      {showLabel && label && <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}
