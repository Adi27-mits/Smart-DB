'use client'

import { KeyRound, Link2, Table2, Columns3, Waypoints, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DatabaseSchema } from '@/lib/schema'
import { schemaStats } from '@/lib/schema'

type Props = {
  schema: DatabaseSchema
  selectedTable: string | null
  onSelectTable: (id: string) => void
}

export function AppSidebar({ schema, selectedTable, onSelectTable }: Props) {
  const stats = schemaStats(schema)

  const statItems = [
    { label: 'Tables', value: stats.tables, icon: Table2 },
    { label: 'Columns', value: stats.columns, icon: Columns3 },
    { label: 'Relationships', value: stats.relationships, icon: Waypoints },
    { label: 'Primary Keys', value: stats.primaryKeys, icon: KeyRound },
    { label: 'Foreign Keys', value: stats.foreignKeys, icon: Link2 },
  ]

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground backdrop-blur-xl">
      {/* database */}
      <div className="border-b border-sidebar-border p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Database</p>
        <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-card/60 px-3 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-semibold">{schema.name}</p>
            <p className="text-[11px] text-muted-foreground">{schema.type}</p>
          </div>
        </div>
      </div>

      {/* tables */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tables · {stats.tables}
        </p>
        <nav className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <ul className="grid gap-0.5">
            {schema.tables.map((t) => {
              const isActive = t.id === selectedTable
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTable(t.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent',
                    )}
                  >
                    <Table2 className={cn('h-4 w-4 shrink-0', isActive ? 'opacity-90' : 'text-primary')} />
                    <span className="truncate font-mono">{t.name}</span>
                    <span
                      className={cn(
                        'ml-auto text-[11px]',
                        isActive ? 'text-sidebar-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {t.columns.length}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {/* statistics */}
      <div className="border-t border-sidebar-border p-4">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Statistics</p>
        <dl className="grid grid-cols-2 gap-2">
          {statItems.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-card/50 px-2.5 py-2"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <dd className="font-mono text-base font-semibold leading-none">{value}</dd>
                <dt className="mt-0.5 truncate text-[10px] text-muted-foreground">{label}</dt>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  )
}
