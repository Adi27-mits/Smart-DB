'use client'

import React, { useRef, useEffect } from 'react'
import { Play, RotateCcw, Sparkles, History, Database, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QueryEditorProps {
  query: string
  onChange: (val: string) => void
  onExecute: () => void
  loading: boolean
  tables: string[]
  history: string[]
  onSelectHistory: (q: string) => void
}

export function QueryEditor({
  query,
  onChange,
  onExecute,
  loading,
  tables,
  history,
  onSelectHistory,
}: QueryEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle Ctrl+Enter or Cmd+Enter to execute
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!loading && query.trim()) {
        onExecute()
      }
    }
  }

  function insertTemplate(template: string) {
    onChange(template)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const defaultTable = tables[0] || 'students'

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur-md">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Code2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground">SQL Query Console</span>
        </div>

        {/* Quick template helpers */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">Templates:</span>
          <button
            type="button"
            onClick={() => insertTemplate(`SELECT * FROM \`${defaultTable}\` LIMIT 50;`)}
            className="rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={`SELECT * FROM ${defaultTable}`}
          >
            SELECT *
          </button>
          <button
            type="button"
            onClick={() => insertTemplate('SHOW TABLES;')}
            className="rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            SHOW TABLES
          </button>
          <button
            type="button"
            onClick={() => insertTemplate(`DESCRIBE \`${defaultTable}\`;`)}
            className="rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            DESCRIBE
          </button>
          <button
            type="button"
            onClick={() => insertTemplate(`EXPLAIN SELECT * FROM \`${defaultTable}\`;`)}
            className="rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            EXPLAIN
          </button>

          {/* Quick Table Selector dropdown */}
          {tables.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  insertTemplate(`SELECT * FROM \`${e.target.value}\` LIMIT 50;`)
                  e.target.value = ''
                }
              }}
              defaultValue=""
              className="h-6 rounded-md border border-border bg-background/80 px-2 text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus:border-ring"
              title="Query a specific table"
            >
              <option value="" disabled>
                Query Table...
              </option>
              {tables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {/* Recent queries history dropdown */}
          {history.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onSelectHistory(e.target.value)
                  e.target.value = ''
                }
              }}
              defaultValue=""
              className="h-6 rounded-md border border-border bg-background/80 px-2 text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus:border-ring"
              title="Query history"
            >
              <option value="" disabled>
                History ({history.length})
              </option>
              {history.map((h, i) => (
                <option key={i} value={h}>
                  {h.length > 40 ? h.slice(0, 40) + '…' : h}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Code Textarea Area */}
      <div className="relative p-3">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter read-only SQL statement here (e.g. SELECT * FROM students LIMIT 25;)"
          rows={5}
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-input bg-background/90 p-3 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* Bottom Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-4 py-2.5 bg-muted/20 rounded-b-xl">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Shortcuts:</span>
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono shadow-2xs">
            Ctrl
          </kbd>
          <span>+</span>
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono shadow-2xs">
            Enter
          </kbd>
          <span className="hidden sm:inline">to execute</span>
        </div>

        <div className="flex items-center gap-2">
          {query && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExecute}
            disabled={loading || !query.trim()}
            className={cn(
              'flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none'
            )}
          >
            <Play className={cn('h-3.5 w-3.5 fill-current', loading && 'animate-spin')} />
            <span>{loading ? 'Executing...' : 'Run Query'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
