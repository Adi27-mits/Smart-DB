'use client'

import React from 'react'
import { Activity, ShieldAlert, ShieldCheck, ShieldAlert as ShieldWarning } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HealthScoreCardProps {
  score: number
  grade?: string
  label?: string
  note?: string
}

export function HealthScoreCard({
  score,
  grade,
  label = 'Project-Defined Health Score',
  note = 'This is a project-defined indicator and not an industry-standard database health score.',
}: HealthScoreCardProps) {
  // Presentation-level status based on project requirements:
  // 80–100 → Good
  // 60–79  → Review Recommended
  // 0–59   → Needs Attention
  let statusText = grade || 'Needs Attention'
  let strokeColor = 'stroke-destructive text-destructive'
  let badgeColor = 'bg-destructive/10 text-destructive border-destructive/30'
  let Icon = ShieldAlert

  if (score >= 80) {
    statusText = 'Good'
    strokeColor = 'stroke-emerald-600 dark:stroke-emerald-400 text-emerald-600 dark:text-emerald-400'
    badgeColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    Icon = ShieldCheck
  } else if (score >= 60) {
    statusText = 'Review Recommended'
    strokeColor = 'stroke-amber-500 text-amber-500'
    badgeColor = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
    Icon = ShieldWarning
  }

  // Circular gauge math (radius = 36, circumference = 2 * PI * 36 ≈ 226.2)
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.max(0, Math.min(100, score))
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{label}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
            badgeColor
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {statusText}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-6">
        {/* SVG Circular Progress Meter */}
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
          <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 96 96">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/30"
              fill="transparent"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={cn('transition-all duration-700 ease-out', strokeColor)}
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold tracking-tight text-foreground">{clampedScore}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>80–100: Good</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>60–79: Review Recommended</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            <span>0–59: Needs Attention</span>
          </div>
        </div>
      </div>
    </div>
  )
}
