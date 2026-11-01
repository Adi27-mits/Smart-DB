/**
 * schema-api.ts — Typed wrappers for every backend endpoint
 *
 * Import these in components/pages instead of writing raw fetch calls.
 */

import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiUpload } from './api'
import type { DatabaseSchema } from './schema'

// ── Types that mirror the backend's responses ────────────────────────────────

export interface ConnectPayload {
  host: string
  port: number
  user?: string
  username?: string
  password: string
  database: string
}

export interface ConnectResponse {
  host: string
  port: number
  database: string
  user: string
}

export interface TableSummary {
  name: string
}

export interface ColumnDetail {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  primaryKey: boolean
  unique: boolean
  autoIncrement: boolean
  foreignKey: { table: string; column: string; constraintName: string } | null
}

export interface TableDetail {
  tableName: string
  columns: ColumnDetail[]
}

export interface Relationship {
  id: string
  sourceTable: string
  sourceColumn: string
  targetTable: string
  targetColumn: string
  constraintName: string
  relationship: string
}

// ── Connection APIs ──────────────────────────────────────────────────────────

/** Test DB credentials without persisting a connection */
export function testConnection(payload: ConnectPayload) {
  return apiPost<{ message: string }>('/api/database/test', payload)
}

/** Connect to the database — backend stores the pool for subsequent requests */
export function connectToDatabase(payload: ConnectPayload) {
  return apiPost<ConnectResponse>('/api/database/connect', payload)
}

/** Disconnect from the active database */
export function disconnectFromDatabase() {
  return apiPost<{ message: string }>('/api/database/disconnect', {})
}

// ── Schema Read APIs ─────────────────────────────────────────────────────────

/** Fetch the list of all tables */
export function fetchTables() {
  return apiGet<{ tables: TableSummary[] }>('/api/schema/tables')
}

/** Fetch column + key details for a specific table */
export function fetchTableDetails(tableName: string) {
  return apiGet<TableDetail>(`/api/schema/tables/${encodeURIComponent(tableName)}`)
}

/** Fetch all foreign-key relationships */
export function fetchRelationships() {
  return apiGet<{ relationships: Relationship[] }>('/api/schema/relationships')
}

/**
 * Fetch the complete schema overview.
 * The response shape matches DatabaseSchema from lib/schema.ts so the
 * existing visualiser components work without modification.
 */
export function fetchOverview() {
  return apiGet<DatabaseSchema>('/api/schema/overview')
}

// ── Data Read & CRUD APIs (Phase 7) ─────────────────────────────────────────

export interface TableColumnMetadata {
  name: string
  type: string
  nullable: boolean
  defaultValue?: any
  columnKey?: string
  extra?: string
}

export interface TableDataResult {
  tableName: string
  rows: Record<string, any>[]
  totalCount: number
  primaryKeys?: string[]
  columns?: TableColumnMetadata[]
  limit: number
  offset: number
}

/** Fetch actual row data for a table */
export function fetchTableData(tableName: string, limit: number = 50, offset: number = 0) {
  return apiGet<TableDataResult>(`/api/data/${encodeURIComponent(tableName)}?limit=${limit}&offset=${offset}`)
}

export interface InsertRowResult {
  insertId: number | null
  affectedRows: number
}

export interface UpdateRowResult {
  affectedRows: number
  changedRows?: number
}

export interface DeleteRowResult {
  affectedRows: number
}

/** Insert a row into a table */
export function insertTableRow(tableName: string, data: Record<string, any>) {
  return apiPost<InsertRowResult>(`/api/data/${encodeURIComponent(tableName)}`, { data })
}

/** Update a row in a table by criteria */
export function updateTableRow(tableName: string, criteria: Record<string, any>, data: Record<string, any>) {
  return apiPut<UpdateRowResult>(`/api/data/${encodeURIComponent(tableName)}`, { criteria, data })
}

/** Delete a row from a table by criteria */
export function deleteTableRow(tableName: string, criteria: Record<string, any>) {
  return apiDelete<DeleteRowResult>(`/api/data/${encodeURIComponent(tableName)}`, criteria)
}

// ── Schema Edit APIs (Phase 7) ───────────────────────────────────────────────

export interface CreateTablePayload {
  tableName: string
  columns: {
    name: string
    type: string
    nullable?: boolean
    primaryKey?: boolean
    autoIncrement?: boolean
    defaultValue?: string
    unique?: boolean
  }[]
}

export function createTable(payload: CreateTablePayload) {
  return apiPost<{ tableName: string; columnsCreated: number }>('/api/schema/table', payload)
}

export function dropTable(tableName: string) {
  return apiDelete<{ tableName: string }>(`/api/schema/table/${encodeURIComponent(tableName)}`)
}

export interface AddColumnPayload {
  tableName: string
  columnName: string
  type: string
  nullable?: boolean
  defaultValue?: string
  after?: string
  unique?: boolean
}

export function addColumn(payload: AddColumnPayload) {
  return apiPost<{ tableName: string; columnName: string }>('/api/schema/column', payload)
}

export interface ModifyColumnPayload {
  tableName: string
  columnName: string
  newName?: string
  newType?: string
  nullable?: boolean
  defaultValue?: string | null
}

export function modifyColumn(payload: ModifyColumnPayload) {
  return apiPatch<{ tableName: string; columnName: string; newName: string }>('/api/schema/column', payload)
}

export interface DeleteColumnPayload {
  tableName: string
  columnName: string
}

export function deleteColumn(payload: DeleteColumnPayload) {
  return apiDelete<{ tableName: string; columnName: string }>('/api/schema/column', payload)
}

export interface AddRelationshipPayload {
  sourceTable: string
  sourceColumn: string
  targetTable: string
  targetColumn: string
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

export function addRelationship(payload: AddRelationshipPayload) {
  return apiPost<{ constraintName: string }>('/api/schema/relationship', payload)
}

export interface RemoveRelationshipPayload {
  tableName: string
  constraintName: string
}

export function removeRelationship(payload: RemoveRelationshipPayload) {
  return apiDelete<{ tableName: string; constraintName: string }>('/api/schema/relationship', payload)
}

// ── Export/Import APIs (Phase 8) ─────────────────────────────────────────────

export interface ExportResult {
  database: string
  sql: string
  tableCount: number
}

/** Export the current database schema + data as SQL */
export function exportSQL(options?: { structure?: boolean; data?: boolean }) {
  const params = new URLSearchParams()
  if (options?.structure === false) params.set('structure', 'false')
  if (options?.data === false) params.set('data', 'false')
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiGet<ExportResult>(`/api/schema/export${qs}`)
}

/** Download the SQL export as a file */
export async function downloadSQL() {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
  const res = await fetch(`${BASE_URL}/api/schema/export?download=true`)
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'database_export.sql'
  a.click()
  URL.revokeObjectURL(url)
}

/** Import a .sql file into the connected database */
export function importSQL(file: File) {
  const formData = new FormData()
  formData.append('sqlFile', file)
  return apiUpload<{
    totalStatements: number
    executed: number
    skipped: number
    errors: { statement: string; error: string }[]
  }>('/api/database/import', formData)
}

// ── Analysis APIs (Milestone 4) ─────────────────────────────────────────────

export interface AnalysisIssue {
  ruleId: string
  category: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  table: string
  column: string | null
  title: string
  evidence: string
  recommendation: string
  candidateReference?: string
  candidateTargetTable?: string
  candidateTargetColumn?: string
  metadata?: {
    candidateTable?: string
    candidateColumn?: string
    [key: string]: any
  }
}

export interface AnalysisRecommendation {
  ruleId: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  table: string
  column: string | null
  location: string
  title: string
  what: string
  why: string
  action: string
  sqlSuggestion: string | null
}

export interface AnalysisSummary {
  tables: number
  relationships: number
  issues: number
  high: number
  medium: number
  low: number
  healthScore: number
  healthGrade: string
  healthScoreLabel: string
  healthScoreNote: string
}

export interface AnalysisResult {
  success: boolean
  summary: AnalysisSummary
  issues: AnalysisIssue[]
  recommendations: AnalysisRecommendation[]
  dependencyGraph?: Record<string, any>
}

/** Run rule-based analysis and retrieve recommendations & health score */
export function runAnalysis() {
  return apiPost<AnalysisResult>('/api/analysis/run', {})
}

// ── SQL Query APIs (Phase 6) ────────────────────────────────────────────────

export interface QueryResult {
  query: string
  statementType: 'SELECT' | 'SHOW' | 'DESCRIBE' | 'EXPLAIN' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL' | 'OTHER'
  isResultSet: boolean
  columns: string[]
  rows: Record<string, any>[]
  rowCount: number
  truncated?: boolean
  affectedRows?: number
  insertId?: number | null
  changedRows?: number | null
  warningStatus?: number
  executionTimeMs: number
  message: string
}

export interface ExecuteQueryResponse {
  success: boolean
  data: QueryResult
}

/** Execute arbitrary SQL query against the connected database */
export async function executeQuery(query: string, limit?: number): Promise<QueryResult> {
  return apiPost<QueryResult>('/api/query/execute', { query, limit })
}


