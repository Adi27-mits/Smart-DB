'use client'

import React, { useState } from 'react'
import {
  AlertOctagon,
  AlertCircle,
  Info,
  Table as TableIcon,
  Columns,
  Check,
  Copy,
  ExternalLink,
  Code2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnalysisIssue, AnalysisRecommendation } from '@/lib/schema-api'

interface IssueCardProps {
  issue: AnalysisIssue
  recommendation?: AnalysisRecommendation
  onFocusTable?: (tableName: string, columnName?: string | null, ruleId?: string) => void
}

export function IssueCard({ issue, recommendation, onFocusTable }: IssueCardProps) {
  const [copied, setCopied] = useState(false)

  const severity = (issue.severity || 'LOW').toUpperCase()
  let severityBadge = 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
  let SeverityIcon = Info

  if (severity === 'HIGH') {
    severityBadge = 'border-destructive/30 bg-destructive/10 text-destructive'
    SeverityIcon = AlertOctagon
  } else if (severity === 'MEDIUM') {
    severityBadge = 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
    SeverityIcon = AlertCircle
  }

  const sqlSuggestion = recommendation?.sqlSuggestion

  function handleCopySQL() {
    if (!sqlSuggestion) return
    navigator.clipboard.writeText(sqlSuggestion)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card/90 p-4 shadow-xs backdrop-blur-md transition-all hover:border-primary/40 hover:shadow-sm">
      {/* Header: Title, Severity, Category, and Action */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity Badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
              severityBadge
            )}
          >
            <SeverityIcon className="h-3.5 w-3.5 shrink-0" />
            {severity}
          </span>

          {/* Category Tag */}
          <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {issue.category || 'GENERAL'}
          </span>

          {/* Rule ID */}
          <span className="font-mono text-xs text-muted-foreground">
            [{issue.ruleId}]
          </span>
        </div>

        {/* Focus in Diagram Button */}
        {onFocusTable && (
          <button
            type="button"
            data-testid="focus-in-diagram-btn"
            onClick={() => onFocusTable(issue.table, issue.column, issue.ruleId)}
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            title={`Focus '${issue.table}' in schema visualization`}
          >
            <span>Focus in Diagram</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Issue Title */}
      <h4 className="mt-2 text-base font-semibold text-foreground">
        {issue.title}
      </h4>

      {/* Location Pills: Table and Column */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground">
          <TableIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Table:</span>
          <span className="font-mono font-semibold">{issue.table}</span>
        </span>

        {issue.column && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground">
            <Columns className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Column:</span>
            <span className="font-mono font-semibold">{issue.column}</span>
          </span>
        )}

        {issue.candidateReference && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground">
            <span className="text-muted-foreground">Candidate target:</span>
            <span className="font-mono font-semibold text-primary">{issue.candidateReference}</span>
          </span>
        )}
      </div>

      {/* Evidence */}
      <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground">
        <p className="font-medium text-foreground/90">
          <span className="font-semibold text-foreground">Evidence: </span>
          {issue.evidence}
        </p>
      </div>

      {/* Actionable Recommendation */}
      <div className="mt-2 text-xs text-foreground/90 leading-relaxed">
        <p>
          <span className="font-semibold text-primary">Recommendation: </span>
          {issue.recommendation}
        </p>
      </div>

      {/* SQL Suggestion or Review Guidance Block */}
      {sqlSuggestion && (() => {
        const isExecutableSql =
          !sqlSuggestion.trim().startsWith('--') && !sqlSuggestion.trim().startsWith('/*')

        return (
          <div className="mt-3 rounded-lg border border-border bg-background/95 p-3 text-xs">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                {isExecutableSql ? (
                  <Code2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Info className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span className="font-medium text-foreground">
                  {isExecutableSql ? 'Suggested SQL — Review before execution' : 'Review Guidance'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopySQL}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={isExecutableSql ? 'Copy SQL suggestion' : 'Copy review guidance'}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-500 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span className="text-[10px]">{isExecutableSql ? 'Copy SQL' : 'Copy Note'}</span>
                  </>
                )}
              </button>
            </div>
            <pre className={cn(
              "mt-2 overflow-x-auto text-[11px] whitespace-pre-wrap break-all",
              isExecutableSql ? "font-mono text-foreground/90" : "font-sans italic text-muted-foreground"
            )}>
              {sqlSuggestion}
            </pre>
          </div>
        )
      })()}
    </div>
  )
}
