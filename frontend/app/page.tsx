'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, LogOut, Database } from 'lucide-react'
import { ConnectScreen } from '@/components/connect-screen'
import { Dashboard } from '@/components/dashboard'
import { collegeDb } from '@/lib/schema'
import type { DatabaseSchema } from '@/lib/schema'
import { fetchOverview, disconnectFromDatabase } from '@/lib/schema-api'

export default function Page() {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null)
  const [isDemo, setIsDemo] = useState(false)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  /**
   * Called after a successful POST /api/database/connect.
   * Fetches the real schema from the backend.
   * NEVER silently falls back to Demo Mode on real database connection.
   */
  async function handleConnect() {
    setIsRetrying(true)
    setSchemaError(null)
    try {
      const overview = await fetchOverview()
      setSchema(overview)
      setIsDemo(false)
      setSchemaError(null)
    } catch (err) {
      console.error('[SCHEMA LOAD ERROR]', err)
      const msg = err instanceof Error ? err.message : 'Failed to extract schema from the connected database.'
      setSchemaError(msg)
      setSchema(null)
      setIsDemo(false)
    } finally {
      setIsRetrying(false)
    }
  }

  /**
   * Called when the user clicks "Explore with Demo Schema".
   * Loads the hardcoded college_db schema without needing MySQL.
   */
  function handleDemo() {
    setSchema(collegeDb)
    setIsDemo(true)
    setSchemaError(null)
  }

  /**
   * Disconnect from the database and return to the connect screen.
   */
  async function handleDisconnect() {
    try {
      if (!isDemo) {
        await disconnectFromDatabase()
      }
    } catch {
      // Ignore disconnect errors
    }
    setSchema(null)
    setIsDemo(false)
    setSchemaError(null)
  }

  /**
   * Refresh the schema from the backend (re-fetch after modifications).
   */
  async function handleRefresh() {
    if (isDemo) return
    try {
      const overview = await fetchOverview()
      setSchema(overview)
    } catch (err) {
      console.warn('Could not refresh schema:', err)
    }
  }

  // Schema extraction failure state — controlled error with Retry and Disconnect
  if (schemaError && !schema) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-xl space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">Database Connected, Schema Load Failed</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Successfully established connection to MySQL, but could not extract database metadata via INFORMATION_SCHEMA.
            </p>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-left">
              <p className="font-mono text-xs text-destructive whitespace-pre-wrap break-all">
                {schemaError}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleConnect}
              disabled={isRetrying}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Retrying...' : 'Retry Loading Schema'}</span>
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (!schema) {
    return <ConnectScreen onConnect={handleConnect} onDemo={handleDemo} />
  }

  return (
    <Dashboard
      schema={schema}
      isDemo={isDemo}
      onDisconnect={handleDisconnect}
      onRefresh={handleRefresh}
    />
  )
}
