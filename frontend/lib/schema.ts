export type Column = {
  name: string
  type: string
  pk?: boolean
  fk?: { table: string; column: string }
  nullable?: boolean
}

export type TableNode = {
  id: string
  name: string
  columns: Column[]
  /** layout position on the canvas, in canvas coordinate space */
  x: number
  y: number
}

export type Relationship = {
  id: string
  /** the table holding the foreign key */
  from: { table: string; column: string }
  /** the referenced table (primary key side) */
  to: { table: string; column: string }
  /** e.g. "N:1" read as: many `from` rows reference one `to` row */
  cardinality: string
}

export type DatabaseSchema = {
  name: string
  type: string
  tables: TableNode[]
  relationships: Relationship[]
}

/**
 * Mock schema that mimics what a backend schema-extraction step would return
 * for a typical `college_db`. In production this would come from the FastAPI
 * `/schema` endpoint after a successful connection.
 */
export const collegeDb: DatabaseSchema = {
  name: 'college_db',
  type: 'MySQL',
  tables: [
    {
      id: 'department',
      name: 'department',
      x: 40,
      y: 60,
      columns: [
        { name: 'dept_id', type: 'INT', pk: true },
        { name: 'dept_name', type: 'VARCHAR(80)' },
        { name: 'building', type: 'VARCHAR(60)', nullable: true },
      ],
    },
    {
      id: 'instructor',
      name: 'instructor',
      x: 40,
      y: 340,
      columns: [
        { name: 'instructor_id', type: 'INT', pk: true },
        { name: 'name', type: 'VARCHAR(80)' },
        { name: 'email', type: 'VARCHAR(120)' },
        { name: 'dept_id', type: 'INT', fk: { table: 'department', column: 'dept_id' } },
      ],
    },
    {
      id: 'student',
      name: 'student',
      x: 440,
      y: 40,
      columns: [
        { name: 'student_id', type: 'INT', pk: true },
        { name: 'name', type: 'VARCHAR(80)' },
        { name: 'email', type: 'VARCHAR(120)' },
        { name: 'enroll_year', type: 'YEAR' },
        { name: 'dept_id', type: 'INT', fk: { table: 'department', column: 'dept_id' } },
      ],
    },
    {
      id: 'course',
      name: 'course',
      x: 440,
      y: 360,
      columns: [
        { name: 'course_id', type: 'INT', pk: true },
        { name: 'title', type: 'VARCHAR(120)' },
        { name: 'credits', type: 'TINYINT' },
        { name: 'dept_id', type: 'INT', fk: { table: 'department', column: 'dept_id' } },
        { name: 'instructor_id', type: 'INT', fk: { table: 'instructor', column: 'instructor_id' } },
      ],
    },
    {
      id: 'enrollment',
      name: 'enrollment',
      x: 860,
      y: 60,
      columns: [
        { name: 'enrollment_id', type: 'INT', pk: true },
        { name: 'student_id', type: 'INT', fk: { table: 'student', column: 'student_id' } },
        { name: 'course_id', type: 'INT', fk: { table: 'course', column: 'course_id' } },
        { name: 'semester', type: 'VARCHAR(20)' },
        { name: 'grade', type: 'CHAR(2)', nullable: true },
      ],
    },
    {
      id: 'attendance',
      name: 'attendance',
      x: 860,
      y: 380,
      columns: [
        { name: 'attendance_id', type: 'INT', pk: true },
        { name: 'student_id', type: 'INT', fk: { table: 'student', column: 'student_id' } },
        { name: 'course_id', type: 'INT', fk: { table: 'course', column: 'course_id' } },
        { name: 'date', type: 'DATE' },
        { name: 'present', type: 'BOOLEAN' },
      ],
    },
    {
      id: 'examination',
      name: 'examination',
      x: 1280,
      y: 80,
      columns: [
        { name: 'exam_id', type: 'INT', pk: true },
        { name: 'enrollment_id', type: 'INT', fk: { table: 'enrollment', column: 'enrollment_id' } },
        { name: 'exam_type', type: 'VARCHAR(30)' },
        { name: 'marks', type: 'DECIMAL(5,2)', nullable: true },
      ],
    },
  ],
  relationships: [
    { id: 'r1', from: { table: 'instructor', column: 'dept_id' }, to: { table: 'department', column: 'dept_id' }, cardinality: 'N:1' },
    { id: 'r2', from: { table: 'student', column: 'dept_id' }, to: { table: 'department', column: 'dept_id' }, cardinality: 'N:1' },
    { id: 'r3', from: { table: 'course', column: 'dept_id' }, to: { table: 'department', column: 'dept_id' }, cardinality: 'N:1' },
    { id: 'r4', from: { table: 'course', column: 'instructor_id' }, to: { table: 'instructor', column: 'instructor_id' }, cardinality: 'N:1' },
    { id: 'r5', from: { table: 'enrollment', column: 'student_id' }, to: { table: 'student', column: 'student_id' }, cardinality: 'N:1' },
    { id: 'r6', from: { table: 'enrollment', column: 'course_id' }, to: { table: 'course', column: 'course_id' }, cardinality: 'N:1' },
    { id: 'r7', from: { table: 'attendance', column: 'student_id' }, to: { table: 'student', column: 'student_id' }, cardinality: 'N:1' },
    { id: 'r8', from: { table: 'attendance', column: 'course_id' }, to: { table: 'course', column: 'course_id' }, cardinality: 'N:1' },
    { id: 'r9', from: { table: 'examination', column: 'enrollment_id' }, to: { table: 'enrollment', column: 'enrollment_id' }, cardinality: 'N:1' },
  ],
}

export const databaseTypes = ['MySQL', 'PostgreSQL', 'SQLite', 'MariaDB', 'SQL Server'] as const

/* ---------- derived helpers ---------- */

export function schemaStats(schema: DatabaseSchema) {
  const columns = schema.tables.reduce((n, t) => n + t.columns.length, 0)
  const primaryKeys = schema.tables.reduce((n, t) => n + t.columns.filter((c) => c.pk).length, 0)
  const foreignKeys = schema.tables.reduce((n, t) => n + t.columns.filter((c) => c.fk).length, 0)
  return {
    tables: schema.tables.length,
    columns,
    relationships: schema.relationships.length,
    primaryKeys,
    foreignKeys,
  }
}

/** relationship ids that touch a given table (either side) */
export function relationshipsForTable(schema: DatabaseSchema, tableId: string) {
  return schema.relationships.filter((r) => r.from.table === tableId || r.to.table === tableId)
}

/**
 * Dependency tree: tables whose foreign keys (directly or transitively) point
 * INTO the given table — i.e. records that depend on it.
 */
export type DepNode = { table: string; via: string; children: DepNode[] }

export function dependents(schema: DatabaseSchema, tableId: string, seen: Set<string> = new Set()): DepNode[] {
  const direct = schema.relationships.filter((r) => r.to.table === tableId && !seen.has(r.from.table))
  return direct.map((r) => {
    const nextSeen = new Set(seen)
    nextSeen.add(tableId)
    nextSeen.add(r.from.table)
    return {
      table: r.from.table,
      via: `${r.from.column} → ${r.to.table}.${r.to.column}`,
      children: dependents(schema, r.from.table, nextSeen),
    }
  })
}

export function explainRelationship(r: Relationship) {
  return `${r.from.table}.${r.from.column} references ${r.to.table}.${r.to.column}. This means one ${r.to.table} record can be linked to many ${r.from.table} records (${r.cardinality}).`
}
