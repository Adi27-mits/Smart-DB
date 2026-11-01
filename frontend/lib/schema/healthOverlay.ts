/**
 * healthOverlay.ts — Pure transformation utility for Milestone 5 Phase 7
 *
 * Connects Milestone 4 health analysis results to the schema visualization:
 * - Maps issues by table name
 * - Computes display-only highest severity
 * - Builds heuristic overlay edges for R003 (Possible Missing Foreign Key)
 *
 * Strict Architectural Rules:
 * - Never mutates normalized schema
 * - Never modifies declared relationship array
 * - Never parses human-readable recommendation or evidence strings
 * - Uses only structured candidate metadata from backend
 * - Generates stable, deterministic edge IDs
 */

import type { AnalysisResult, AnalysisIssue } from '@/lib/schema-api'
import type { ParsedTable } from './schemaParser'
import { REL_EDGE_TYPE, type RelEdgeData } from './graphBuilder'
import type { Edge } from '@xyflow/react'

export type HealthSeverity = 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * Maps all issues by table name for O(1) lookup during node rendering.
 */
export function getIssuesByTable(analysis: AnalysisResult | null): Map<string, AnalysisIssue[]> {
  const map = new Map<string, AnalysisIssue[]>()
  if (!analysis?.issues) return map

  for (const issue of analysis.issues) {
    if (!issue.table) continue
    const key = issue.table.toLowerCase()
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(issue)
  }
  return map
}

/**
 * Returns the highest severity among a set of issues according to HIGH > MEDIUM > LOW priority.
 */
export function getHighestSeverity(issues: AnalysisIssue[]): HealthSeverity | null {
  if (!issues || issues.length === 0) return null

  let hasHigh = false
  let hasMedium = false
  let hasLow = false

  for (const issue of issues) {
    const sev = (issue.severity || '').toUpperCase()
    if (sev === 'HIGH') hasHigh = true
    else if (sev === 'MEDIUM') hasMedium = true
    else if (sev === 'LOW') hasLow = true
  }

  if (hasHigh) return 'HIGH'
  if (hasMedium) return 'MEDIUM'
  if (hasLow) return 'LOW'
  return null
}

/**
 * Pure generator for R003 heuristic overlay edges.
 *
 * Reads ONLY structured metadata (candidateTargetTable, candidateTargetColumn)
 * without parsing human-readable recommendation or evidence strings.
 *
 * Returned edges are separate from declared FK edges and visually styled as dashed warning curves.
 */
export function buildHealthOverlayEdges(
  analysis: AnalysisResult | null,
  tables: ParsedTable[] = []
): Edge<RelEdgeData>[] {
  if (!analysis?.issues || analysis.issues.length === 0) return []

  const tableNames = new Set(tables.map((t) => (t.name || t.id).toLowerCase()))
  const overlayEdges: Edge<RelEdgeData>[] = []

  for (const issue of analysis.issues) {
    if (issue.ruleId !== 'R003') continue

    const sourceTable = issue.table
    const sourceColumn = issue.column

    // Read ONLY structured candidate properties
    const targetTable =
      issue.candidateTargetTable || issue.metadata?.candidateTable
    const targetColumn =
      issue.candidateTargetColumn || issue.metadata?.candidateColumn

    if (!sourceTable || !sourceColumn || !targetTable || !targetColumn) {
      continue
    }

    // Graph integrity: both endpoints must exist in the loaded table collection
    if (!tableNames.has(sourceTable.toLowerCase()) || !tableNames.has(targetTable.toLowerCase())) {
      continue
    }

    // Stable deterministic ID
    const edgeId = `health-r003-${sourceTable}-${sourceColumn}-${targetTable}-${targetColumn}`

    const edgeData: RelEdgeData = {
      sourceTable,
      sourceColumn,
      targetTable,
      targetColumn,
      cardinality: 'Possible FK',
      ruleId: 'R003',
      title: issue.title || 'Possible Missing Foreign Key',
      evidence: issue.evidence,
      recommendation: issue.recommendation,
      severity: issue.severity || 'MEDIUM',
      isHeuristic: true,
      type: 'possibleRelationship',
    }

    overlayEdges.push({
      id: edgeId,
      source: sourceTable,
      target: targetTable,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: REL_EDGE_TYPE,
      animated: true,
      data: edgeData,
      style: {
        stroke: '#f59e0b', // Amber warning token
        strokeWidth: 2,
        strokeDasharray: '6 4',
        opacity: 1,
      },
    })
  }

  return overlayEdges
}
