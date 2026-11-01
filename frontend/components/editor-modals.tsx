'use client'

import { useState } from 'react'
import { Modal, InputField, SubmitButton, SelectField, CheckboxField } from './ui/modal'
import { createTable, addColumn, dropTable, deleteColumn, addRelationship, removeRelationship } from '@/lib/schema-api'
import type { DatabaseSchema } from '@/lib/schema'

type EditAction = 
  | { type: 'createTable' }
  | { type: 'dropTable'; tableName: string }
  | { type: 'addColumn'; tableName: string }
  | { type: 'dropColumn'; tableName: string; columnName: string }
  | { type: 'addRelationship' }
  | { type: 'dropRelationship'; constraintName: string; tableName: string }
  | null

export function EditorModals({
  action,
  schema,
  onClose,
  onSuccess,
  onError,
}: {
  action: EditAction
  schema: DatabaseSchema
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  if (!action) return null

  if (action.type === 'createTable') {
    return <CreateTableModal onClose={onClose} onSuccess={onSuccess} onError={onError} />
  }
  if (action.type === 'dropTable') {
    return <DropTableModal tableName={action.tableName} onClose={onClose} onSuccess={onSuccess} onError={onError} />
  }
  if (action.type === 'addColumn') {
    return <AddColumnModal tableName={action.tableName} onClose={onClose} onSuccess={onSuccess} onError={onError} />
  }
  if (action.type === 'dropColumn') {
    return <DropColumnModal tableName={action.tableName} columnName={action.columnName} onClose={onClose} onSuccess={onSuccess} onError={onError} />
  }
  if (action.type === 'addRelationship') {
    return <AddRelationshipModal schema={schema} onClose={onClose} onSuccess={onSuccess} onError={onError} />
  }
  if (action.type === 'dropRelationship') {
    return <DropRelationshipModal tableName={action.tableName} constraintName={action.constraintName} onClose={onClose} onSuccess={onSuccess} onError={onError} />
  }

  return null
}

function CreateTableModal({ onClose, onSuccess, onError }: any) {
  const [tableName, setTableName] = useState('')
  const [colName, setColName] = useState('id')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await createTable({
        tableName,
        columns: [{ name: colName, type: 'INT', primaryKey: true, autoIncrement: true }]
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Create New Table" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <InputField label="Table Name" value={tableName} onChange={setTableName} required />
        <InputField label="Primary Key Column Name" value={colName} onChange={setColName} required />
        <p className="mb-4 text-xs text-muted-foreground">The table will be created with an INT AUTO_INCREMENT primary key. You can add more columns later.</p>
        <SubmitButton label="Create Table" loading={loading} />
      </form>
    </Modal>
  )
}

function DropTableModal({ tableName, onClose, onSuccess, onError }: any) {
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await dropTable(tableName)
      onSuccess()
      onClose()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <Modal title="Drop Table" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4">Are you sure you want to permanently delete table <strong>{tableName}</strong>? This action cannot be undone.</p>
        <SubmitButton label="Yes, Delete Table" loading={loading} variant="destructive" />
      </form>
    </Modal>
  )
}

function AddColumnModal({ tableName, onClose, onSuccess, onError }: any) {
  const [columnName, setColumnName] = useState('')
  const [type, setType] = useState('VARCHAR(255)')
  const [nullable, setNullable] = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await addColumn({ tableName, columnName, type, nullable })
      onSuccess()
      onClose()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Add Column to ${tableName}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <InputField label="Column Name" value={columnName} onChange={setColumnName} required />
        <InputField label="Data Type (e.g. INT, VARCHAR(255), DATE)" value={type} onChange={setType} required />
        <CheckboxField label="Nullable (Allow NULL)" checked={nullable} onChange={setNullable} />
        <SubmitButton label="Add Column" loading={loading} />
      </form>
    </Modal>
  )
}

function DropColumnModal({ tableName, columnName, onClose, onSuccess, onError }: any) {
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await deleteColumn({ tableName, columnName })
      onSuccess()
      onClose()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <Modal title="Drop Column" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4">Are you sure you want to delete column <strong>{columnName}</strong> from table <strong>{tableName}</strong>?</p>
        <SubmitButton label="Delete Column" loading={loading} variant="destructive" />
      </form>
    </Modal>
  )
}

function AddRelationshipModal({ schema, onClose, onSuccess, onError }: any) {
  const tables = schema.tables.map((t: any) => ({ value: t.id, label: t.name }))
  const [sourceTable, setSourceTable] = useState(tables[0]?.value || '')
  const [sourceColumn, setSourceColumn] = useState('')
  const [targetTable, setTargetTable] = useState(tables[0]?.value || '')
  const [targetColumn, setTargetColumn] = useState('')
  const [loading, setLoading] = useState(false)

  const sourceTableObj = schema.tables.find((t: any) => t.id === sourceTable)
  const targetTableObj = schema.tables.find((t: any) => t.id === targetTable)

  // Format source columns with data types
  const sourceCols = (sourceTableObj?.columns || []).map((c: any) => ({
    value: c.name,
    label: `${c.name} (${c.type})`,
  }))

  // Format target columns prioritizing PK / Unique / Index
  const targetCols = (targetTableObj?.columns || [])
    .map((c: any) => {
      const isPk = c.pk || targetTableObj?.primaryKeys?.includes(c.name)
      const isUq = targetTableObj?.indexes?.some((idx: any) => idx.unique && !idx.primary && idx.columns?.[0] === c.name)
      const isIdx = targetTableObj?.indexes?.some((idx: any) => !idx.unique && idx.columns?.[0] === c.name)
      const badge = isPk ? ' [PK]' : isUq ? ' [UQ]' : isIdx ? ' [IDX]' : ''
      return {
        value: c.name,
        label: `${c.name} (${c.type})${badge}`,
        isKey: Boolean(isPk || isUq),
      }
    })
    .sort((a: any, b: any) => (b.isKey ? 1 : 0) - (a.isKey ? 1 : 0))

  // Ensure selected columns are valid when table changes
  if (!sourceCols.find((c: any) => c.value === sourceColumn) && sourceCols[0]) {
    setSourceColumn(sourceCols[0].value)
  }
  if (!targetCols.find((c: any) => c.value === targetColumn) && targetCols[0]) {
    setTargetColumn(targetCols[0].value)
  }

  const sourceColObj = sourceTableObj?.columns.find((c: any) => c.name === sourceColumn)
  const targetColObj = targetTableObj?.columns.find((c: any) => c.name === targetColumn)

  // Real-time client-side pre-validation
  let compatibilityError: string | null = null
  let warningMessage: string | null = null

  if (sourceTable === targetTable && sourceColumn === targetColumn && sourceColumn) {
    compatibilityError = `Self-referencing foreign key cannot reference the same column ('${sourceColumn}').`
  } else if (sourceColObj && targetColObj) {
    const srcBase = sourceColObj.type.split('(')[0].trim().toUpperCase()
    const tgtBase = targetColObj.type.split('(')[0].trim().toUpperCase()
    const intTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'INTEGER', 'BIGINT']
    const isSrcInt = intTypes.includes(srcBase)
    const isTgtInt = intTypes.includes(tgtBase)

    if (isSrcInt !== isTgtInt) {
      compatibilityError = `Cannot create relationship: source ${srcBase} and target ${tgtBase} are incompatible.`
    } else if (isSrcInt && isTgtInt) {
      if (srcBase !== tgtBase) {
        compatibilityError = `Cannot create relationship: source ${srcBase} and target ${tgtBase} are incompatible.`
      } else {
        const srcUnsigned = sourceColObj.type.toUpperCase().includes('UNSIGNED')
        const tgtUnsigned = targetColObj.type.toUpperCase().includes('UNSIGNED')
        if (srcUnsigned !== tgtUnsigned) {
          compatibilityError = `Cannot create relationship: source integer is ${srcUnsigned ? 'UNSIGNED' : 'SIGNED'} while target is ${tgtUnsigned ? 'UNSIGNED' : 'SIGNED'}.`
        }
      }
    } else if (srcBase !== tgtBase) {
      compatibilityError = `Cannot create relationship: source ${srcBase} and target ${tgtBase} are incompatible.`
    }

    const targetIsIndexed =
      targetColObj.pk ||
      targetTableObj?.primaryKeys?.includes(targetColObj.name) ||
      targetTableObj?.indexes?.some((idx: any) => idx.columns?.[0] === targetColObj.name)

    if (!targetIsIndexed && !compatibilityError) {
      warningMessage = `Target column '${targetTable}.${targetColumn}' should have a PRIMARY KEY, UNIQUE, or secondary index in MySQL.`
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (compatibilityError) {
      onError(compatibilityError)
      return
    }
    setLoading(true)
    try {
      await addRelationship({ sourceTable, sourceColumn, targetTable, targetColumn })
      onSuccess()
      onClose()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Create Foreign Key" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Source Table (Child)" value={sourceTable} onChange={setSourceTable} options={tables} required />
          <SelectField label="Source Column" value={sourceColumn} onChange={setSourceColumn} options={sourceCols} required />
        </div>
        <div className="flex items-center justify-center py-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">References</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Target Table (Parent)" value={targetTable} onChange={setTargetTable} options={tables} required />
          <SelectField label="Target Column" value={targetColumn} onChange={setTargetColumn} options={targetCols} required />
        </div>

        {compatibilityError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive font-medium">
            {compatibilityError}
          </div>
        )}

        {warningMessage && !compatibilityError && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
            {warningMessage}
          </div>
        )}

        <SubmitButton
          label="Create Relationship"
          loading={loading}
          disabled={loading || !!compatibilityError}
        />
      </form>
    </Modal>
  )
}

function DropRelationshipModal({ tableName, constraintName, onClose, onSuccess, onError }: any) {
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await removeRelationship({ tableName, constraintName })
      onSuccess()
      onClose()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <Modal title="Drop Relationship" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4">Remove foreign key <strong>{constraintName}</strong> from table <strong>{tableName}</strong>?</p>
        <SubmitButton label="Remove Relationship" loading={loading} variant="destructive" />
      </form>
    </Modal>
  )
}
