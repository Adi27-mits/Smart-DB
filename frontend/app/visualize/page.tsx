'use client'

/**
 * /visualize  — Standalone React Flow schema visualization page.
 *
 * Uses the mock college_db schema by default.
 * Can also accept a schema from a parent component or the backend API.
 *
 * This page is intentionally separate from the existing dashboard so it
 * can be developed and tested independently, then integrated later.
 */

import { useState } from 'react'
import { Database, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { collegeDb } from '@/lib/schema'
import type { DatabaseSchema } from '@/lib/schema'
import { SchemaCanvas } from '@/components/visualization/SchemaCanvas'
import { fetchOverview } from '@/lib/schema-api'

type LoadState = 'mock' | 'loading' | 'live' | 'error'

export default function VisualizePage() {
  const [schema, setSchema] = useState<DatabaseSchema>(collegeDb)
  const [loadState, setLoadState] = useState<LoadState>('mock')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleLoadLive() {
    setLoadState('loading')
    setErrorMsg(null)
    try {
      const live = await fetchOverview()
      setSchema(live)
      setLoadState('live')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not reach backend')
      setLoadState('error')
      // Fall back to mock
      setSchema(collegeDb)
    }
  }

  function handleResetMock() {
    setSchema(collegeDb)
    setLoadState('mock')
    setErrorMsg(null)
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="z-30 flex items-center gap-3 border-b border-border bg-frost px-4 py-2.5 backdrop-blur-xl">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Database className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Schema Visualizer</p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              {loadState === 'mock'
                ? 'Demo: college_db'
                : loadState === 'loading'
                ? 'Loading from backend…'
                : loadState === 'live'
                ? `Live: ${schema.name}`
                : 'Error — showing demo'}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span
          className={`ml-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            loadState === 'mock'
              ? 'bg-amber-100 text-amber-700'
              : loadState === 'live'
              ? 'bg-primary/15 text-primary'
              : loadState === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {loadState === 'mock' ? 'DEMO' : loadState === 'live' ? 'LIVE' : loadState === 'error' ? 'ERROR' : '…'}
        </span>

        {errorMsg && (
          <span className="ml-2 truncate text-xs text-destructive">{errorMsg}</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {loadState !== 'live' && loadState !== 'loading' && (
            <button
              type="button"
              onClick={handleLoadLive}
              className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Load from Backend</span>
            </button>
          )}
          {loadState !== 'mock' && (
            <button
              type="button"
              onClick={handleResetMock}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Reset Demo</span>
            </button>
          )}
        </div>
      </header>

      {/* Canvas — fills all remaining space */}
      <main className="relative min-h-0 flex-1">
        <SchemaCanvas
          schema={schema}
          isLoading={loadState === 'loading'}
          error={loadState === 'error' ? errorMsg : null}
        />
      </main>
    </div>
  )
}
