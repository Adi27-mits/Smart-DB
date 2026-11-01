'use client'

import React from 'react'
import { Database, Waypoints, AlertTriangle, AlertCircle, AlertOctagon, Info } from 'lucide-react'
import type { AnalysisSummary } from '@/lib/schema-api'

interface HealthSummaryBarProps {
  summary: AnalysisSummary
}

export function HealthSummaryBar({ summary }: HealthSummaryBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {/* Tables */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card/80 p-3.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Tables</span>
          <Database className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {summary.tables}
        </div>
      </div>

      {/* Relationships */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card/80 p-3.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Relationships</span>
          <Waypoints className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {summary.relationships}
        </div>
      </div>

      {/* Total Issues */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-card/80 p-3.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">Total Issues</span>
          <AlertTriangle className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {summary.issues}
        </div>
      </div>

      {/* HIGH Issues */}
      <div className="flex flex-col justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between text-destructive">
          <span className="text-xs font-semibold">HIGH</span>
          <AlertOctagon className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-destructive">
          {summary.high}
        </div>
      </div>

      {/* MEDIUM Issues */}
      <div className="flex flex-col justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
          <span className="text-xs font-semibold">MEDIUM</span>
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
          {summary.medium}
        </div>
      </div>

      {/* LOW Issues */}
      <div className="flex flex-col justify-between rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between text-sky-700 dark:text-sky-400">
          <span className="text-xs font-semibold">LOW</span>
          <Info className="h-4 w-4" />
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-sky-700 dark:text-sky-400">
          {summary.low}
        </div>
      </div>
    </div>
  )
}
