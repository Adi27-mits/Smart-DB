'use client'

import { CornerDownRight, KeyRound, Link2, Sparkles, Table2, X, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DatabaseSchema, DepNode } from '@/lib/schema'
import { dependents, explainRelationship, relationshipsForTable } from '@/lib/schema'

type Props = {
  schema: DatabaseSchema
  selectedTable: string | null
  explainRelId: string | null
  onClose: () => void
  onExplainRelationship: (relId: string) => void
  onSelectTable: (id: string) => void
  setEditAction: (action: any) => void
  onViewData: (tableName: string) => void
  isDemo: boolean
}

export function DetailPanel({
  schema,
  selectedTable,
  explainRelId,
  onClose,
  onExplainRelationship,
  onSelectTable,
  setEditAction,
  onViewData,
  isDemo,
}: Props) {
  const table = selectedTable ? schema.tables.find((t) => t.id === selectedTable) ?? null : null
  const rel = explainRelId ? schema.relationships.find((r) => r.id === explainRelId) ?? null : null

  const open = Boolean(table || rel)
  if (!open) return null

  const rels = table ? relationshipsForTable(schema, table.id) : []
  const deps = table ? dependents(schema, table.id) : []

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-full max-w-sm p-3">
      <div className="pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-frost shadow-2xl shadow-primary/10 backdrop-blur-2xl">
        {/* explanation takes priority */}
        {rel ? (
          <>
            <Header
              icon={<Sparkles className="h-4 w-4" />}
              title="Explain Relationship"
              onClose={onClose}
            />
            <div className="flex-1 overflow-y-auto p-4">
              <div className="rounded-xl border border-link/40 bg-card/60 p-4">
                <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                  <Pill tone="link">
                    {rel.from.table}.{rel.from.column}
                  </Pill>
                  <span className="text-muted-foreground">references</span>
                  <Pill tone="key">
                    {rel.to.table}.{rel.to.column}
                  </Pill>
                </div>
                <p className="mt-3 leading-relaxed text-foreground/90">{explainRelationship(rel)}</p>
                <span className="mt-3 inline-block rounded-full bg-link/15 px-2.5 py-1 font-mono text-xs font-semibold text-link">
                  {rel.cardinality}
                </span>
              </div>
              
              {!isDemo && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setEditAction({ type: 'dropRelationship', tableName: rel.from.table, constraintName: rel.id })}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" /> Drop Relationship
                  </button>
                </div>
              )}

              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                A foreign key ties each row on the left to exactly one row on the right, while that right-hand row can be
                referenced by many rows on the left.
              </p>
            </div>
          </>
        ) : table ? (
          <>
            <Header
              icon={<Table2 className="h-4 w-4" />}
              title={table.name}
              subtitle={`${table.columns.length} columns`}
              mono
              onClose={onClose}
            />
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {/* columns */}
              <Section title="Columns">
                <ul className="overflow-hidden rounded-xl border border-border">
                  {table.columns.map((c, i) => (
                    <li
                      key={c.name}
                      className={cn(
                        'group flex items-center gap-2 px-3 py-2 font-mono text-[13px]',
                        i % 2 ? 'bg-card/40' : 'bg-card/70',
                      )}
                    >
                      {c.pk ? (
                        <KeyRound className="h-3.5 w-3.5 shrink-0 text-key" />
                      ) : c.fk ? (
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-link" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className={cn('truncate', c.pk && 'font-semibold')}>{c.name}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{c.type}</span>
                      
                      {!isDemo && !c.pk && (
                        <button
                          type="button"
                          onClick={() => setEditAction({ type: 'dropColumn', tableName: table.id, columnName: c.name })}
                          className="invisible ml-2 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:visible"
                          aria-label="Delete column"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                
                {!isDemo && (
                  <button
                    type="button"
                    onClick={() => setEditAction({ type: 'addColumn', tableName: table.id })}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Column
                  </button>
                )}
              </Section>

              {/* relationships */}
              {rels.length > 0 && (
                <Section title={`Relationships · ${rels.length}`}>
                  <ul className="grid gap-2">
                    {rels.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2"
                      >
                        <div className="min-w-0 font-mono text-xs">
                          <span className="text-link">{r.from.table}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="text-key">{r.to.table}</span>
                        </div>
                        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {r.cardinality}
                        </span>
                        <button
                          type="button"
                          onClick={() => onExplainRelationship(r.id)}
                          className="rounded-md p-1 text-primary transition-colors hover:bg-accent"
                          aria-label="Explain relationship"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* dependency analysis */}
              {deps.length > 0 && (
                <Section title="Dependency Analysis">
                  <p className="mb-2 text-xs text-muted-foreground">Records that depend on this table:</p>
                  <div className="rounded-xl border border-border bg-card/60 p-3">
                    <p className="font-mono text-sm font-semibold text-primary">{table.name}</p>
                    <DepTree nodes={deps} onSelectTable={onSelectTable} />
                  </div>
                </Section>
              )}

              {/* Dangerous & Data actions */}
              {!isDemo && (
                <div className="pt-4 border-t border-border grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onViewData(table.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    View Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAction({ type: 'dropTable', tableName: table.id })}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                  >
                    Drop Table
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function DepTree({ nodes, onSelectTable, depth = 0 }: { nodes: DepNode[]; onSelectTable: (id: string) => void; depth?: number }) {
  return (
    <ul className={cn('mt-1 grid gap-1', depth === 0 ? 'pl-1' : 'pl-3')}>
      {nodes.map((n) => (
        <li key={`${n.table}-${n.via}`}>
          <div className="flex items-center gap-1.5">
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <button
              type="button"
              onClick={() => onSelectTable(n.table)}
              className="rounded font-mono text-xs text-foreground/90 underline-offset-2 hover:text-primary hover:underline"
            >
              {n.table}
            </button>
          </div>
          {n.children.length > 0 && <DepTree nodes={n.children} onSelectTable={onSelectTable} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

function Header({
  icon,
  title,
  subtitle,
  mono,
  onClose,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  mono?: boolean
  onClose: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className={cn('truncate font-semibold leading-tight', mono && 'font-mono')}>{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Close panel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone: 'link' | 'key' }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-1 text-xs font-semibold',
        tone === 'link' ? 'bg-link/15 text-link' : 'bg-key/20 text-key',
      )}
    >
      {children}
    </span>
  )
}
