'use client'

import { useState } from 'react'
import { Database, Loader2, Lock, Server, ShieldCheck, User, Waypoints, Zap, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { databaseTypes } from '@/lib/schema'
import { connectToDatabase } from '@/lib/schema-api'

type Props = {
  onConnect: () => void
  onDemo: () => void
}

export function ConnectScreen({ onConnect, onDemo }: Props) {
  const [dbType, setDbType] = useState<string>('MySQL')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('3306')
  const [database, setDatabase] = useState('')
  const [username, setUsername] = useState('root')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('connecting')
    setErrorMessage(null)

    try {
      await connectToDatabase({
        host,
        port: Number(port),
        user: username,
        password,
        database,
      })
      // Backend confirmed the connection — hand off to the parent page
      onConnect()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed. Please try again.'
      setStatus('error')
      setErrorMessage(message)
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* frosted ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 80% -10%, color-mix(in oklch, var(--primary) 24%, transparent), transparent 55%), radial-gradient(90% 80% at -10% 110%, color-mix(in oklch, var(--link) 22%, transparent), transparent 50%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--primary) 20%, transparent) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative grid w-full max-w-4xl gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        {/* brand / pitch */}
        <div className="hidden flex-col gap-6 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Smart</p>
              <h1 className="text-lg font-semibold leading-tight">Database Visualizer</h1>
            </div>
          </div>

          <h2 className="text-pretty text-4xl font-semibold leading-[1.05] tracking-tight">
            Turn your database into a{' '}
            <span className="bg-gradient-to-r from-primary to-link bg-clip-text text-transparent">visual map</span>.
          </h2>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            Connect a database and instantly explore its tables, columns, primary and foreign keys, and relationships as
            an interactive diagram — no manual ER diagrams required.
          </p>

          <ul className="grid gap-3">
            {[
              { icon: Waypoints, text: 'Auto-generated relationship diagram' },
              { icon: Zap, text: 'Smart search & dependency analysis' },
              { icon: ShieldCheck, text: 'Reads schema only — never your data' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* connect card */}
        <div className="rounded-2xl border border-border bg-frost p-6 shadow-xl shadow-primary/10 backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Database className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold">Smart Database Visualizer</h1>
          </div>

          <h3 className="text-xl font-semibold tracking-tight">Connect Database</h3>
          <p className="mt-1 text-sm text-muted-foreground">Enter your connection details to load the schema.</p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <Field label="Database Type">
              <div className="relative">
                <select
                  value={dbType}
                  onChange={(e) => setDbType(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {databaseTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <Database className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </Field>

            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Field label="Host" icon={Server}>
                <InputBase value={host} onChange={setHost} placeholder="localhost" hasIcon />
              </Field>
              <Field label="Port">
                <InputBase value={port} onChange={setPort} placeholder="3306" />
              </Field>
            </div>

            <Field label="Database Name" icon={Database}>
              <InputBase value={database} onChange={setDatabase} placeholder="college_db" hasIcon />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Username" icon={User}>
                <InputBase value={username} onChange={setUsername} placeholder="root" hasIcon />
              </Field>
              <Field label="Password" icon={Lock}>
                <InputBase value={password} onChange={setPassword} placeholder="••••••••" type="password" hasIcon />
              </Field>
            </div>

            {/* Error banner — shown when the backend rejects the connection */}
            {status === 'error' && errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'connecting'}
              className={cn(
                'mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-80',
              )}
            >
              {status === 'connecting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting & reading schema…
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  Connect Database
                </>
              )}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={onDemo}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Waypoints className="h-4 w-4" />
              Explore with Demo Schema
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Demo loads a sample <span className="font-mono text-foreground">college_db</span> schema without needing MySQL.
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      {children}
    </label>
  )
}

function InputBase({
  value,
  onChange,
  placeholder,
  type = 'text',
  hasIcon,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  hasIcon?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-lg border border-input bg-background py-2.5 pr-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30',
        hasIcon ? 'pl-3' : 'pl-3',
      )}
    />
  )
}
