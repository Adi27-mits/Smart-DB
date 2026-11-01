/**
 * dependencyAnalysis.js — Rule R005: Structural Dependency Analysis
 *
 * Builds a directed dependency graph using declared foreign keys.
 * For each table, computes:
 *   - incoming dependencies (tables that reference this table)
 *   - outgoing dependencies (tables this table references)
 *   - related tables
 *   - root tables, leaf tables, isolated tables
 *   - dependency chains and depths
 *   - cycle detection (circular foreign key references)
 *
 * Note: Following Milestone 4 specifications, dependencies are not
 * treated as errors unless an anti-pattern (such as a circular dependency)
 * is detected.
 */

const RULE_ID = 'R005'
const CATEGORY = 'STRUCTURE'
const SEVERITY = 'LOW'

/**
 * Normalizes endpoints from relationship objects.
 *
 * @param {object} rel
 * @returns {{ from: string, to: string }}
 */
function getEndpoints(rel) {
  const from = rel.from?.table || rel.sourceTable || ''
  const to = rel.to?.table || rel.targetTable || ''
  return { from, to }
}

/**
 * Builds the complete dependency graph and computes structural metrics
 * for every table in the normalized schema.
 *
 * @param {object} schema - Normalized database schema
 * @returns {object} Map of table name -> structural metrics
 */
function buildDependencyGraph(schema) {
  const tables = schema?.tables || []
  const relationships = schema?.relationships || []

  const graph = {}

  // Initialize graph nodes
  for (const t of tables) {
    const tName = t.name || t.id
    graph[tName] = {
      tableName: tName,
      referencingTables: [], // incoming (tables pointing to this table)
      referencedTables: [],  // outgoing (tables this table points to)
      incomingCount: 0,
      outgoingCount: 0,
      isIsolated: false,
      isRoot: false,
      isLeaf: false,
      depth: 0,
      dependencyChain: [],
    }
  }

  // Populate edges from relationships
  for (const rel of relationships) {
    const { from, to } = getEndpoints(rel)
    if (from && to && graph[from] && graph[to]) {
      if (!graph[from].referencedTables.includes(to)) {
        graph[from].referencedTables.push(to)
      }
      if (!graph[to].referencingTables.includes(from)) {
        graph[to].referencingTables.push(from)
      }
    }
  }

  // Also check per-table foreignKeys if available
  for (const t of tables) {
    const tName = t.name || t.id
    if (Array.isArray(t.foreignKeys)) {
      for (const fk of t.foreignKeys) {
        const to = fk.references?.table
        if (to && graph[tName] && graph[to]) {
          if (!graph[tName].referencedTables.includes(to)) {
            graph[tName].referencedTables.push(to)
          }
          if (!graph[to].referencingTables.includes(tName)) {
            graph[to].referencingTables.push(tName)
          }
        }
      }
    }
  }

  // Calculate counts and classifications
  for (const tName of Object.keys(graph)) {
    const node = graph[tName]
    node.incomingCount = node.referencingTables.length
    node.outgoingCount = node.referencedTables.length

    node.isIsolated = node.incomingCount === 0 && node.outgoingCount === 0
    node.isRoot = node.incomingCount > 0 && node.outgoingCount === 0
    node.isLeaf = node.incomingCount === 0 && node.outgoingCount > 0

    // Trace longest outgoing dependency chain (depth)
    node.dependencyChain = getLongestChain(tName, graph, new Set())
    node.depth = Math.max(0, node.dependencyChain.length - 1)
  }

  return graph
}

/**
 * Traces the longest outgoing dependency chain for a table.
 */
function getLongestChain(current, graph, visited) {
  if (visited.has(current)) return [current] // cycle guard

  const node = graph[current]
  if (!node || node.referencedTables.length === 0) {
    return [current]
  }

  const nextVisited = new Set(visited).add(current)
  let longest = []

  for (const next of node.referencedTables) {
    const chain = getLongestChain(next, graph, nextVisited)
    if (chain.length > longest.length) {
      longest = chain
    }
  }

  return [current, ...longest]
}

/**
 * Detects circular foreign-key dependencies in the graph.
 *
 * @param {object} graph
 * @returns {Array<string[]>} List of circular dependency paths
 */
function findCycles(graph) {
  const cycles = []
  const visited = new Set()
  const recStack = new Set()

  function dfs(node, path) {
    visited.add(node)
    recStack.add(node)

    const neighbors = graph[node]?.referencedTables || []
    for (const next of neighbors) {
      if (!visited.has(next)) {
        dfs(next, [...path, next])
      } else if (recStack.has(next)) {
        const cycleStartIndex = path.indexOf(next)
        if (cycleStartIndex !== -1) {
          cycles.push(path.slice(cycleStartIndex).concat(next))
        } else {
          cycles.push([node, next])
        }
      }
    }

    recStack.delete(node)
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node, [node])
    }
  }

  return cycles
}

/**
 * Analyze schema for structural dependency issues.
 *
 * @param {object} schema - Normalized database schema
 * @returns {Array<object>} List of detected structural issues
 */
function analyze(schema) {
  const issues = []
  const graph = buildDependencyGraph(schema)

  // 1. Check for circular dependencies
  const cycles = findCycles(graph)
  for (const cycle of cycles) {
    const pathStr = cycle.join(' → ')
    issues.push({
      ruleId: RULE_ID,
      category: CATEGORY,
      severity: 'HIGH',
      table: cycle[0],
      column: null,
      title: 'Circular Dependency Detected',
      evidence: `Circular foreign-key dependency detected along path: ${pathStr}`,
      recommendation:
        'Refactor foreign key relationships or make at least one relationship nullable to prevent deadlocks during insertions and deletions.',
    })
  }

  // 2. Check for excessively deep dependency chains (depth >= 5)
  for (const [tName, node] of Object.entries(graph)) {
    if (node.depth >= 5) {
      issues.push({
        ruleId: RULE_ID,
        category: CATEGORY,
        severity: SEVERITY,
        table: tName,
        column: null,
        title: 'Deep Dependency Chain',
        evidence: `Table '${tName}' has a foreign key dependency chain of depth ${node.depth}: ${node.dependencyChain.join(' → ')}.`,
        recommendation:
          'Review the deep hierarchy to ensure cascade operations and joins do not encounter performance degradation.',
      })
    }
  }

  return issues
}

module.exports = {
  ruleId: RULE_ID,
  category: CATEGORY,
  severity: SEVERITY,
  analyze,
  buildDependencyGraph,
  findCycles,
}
