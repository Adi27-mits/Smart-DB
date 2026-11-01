'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ModalProps = {
  title: string
  children: React.ReactNode
  onClose: () => void
}

export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function InputField({ label, value, onChange, placeholder, type = 'text', required = false }: any) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
  )
}

export function SelectField({ label, value, onChange, options, required = false }: any) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CheckboxField({ label, checked, onChange }: any) {
  return (
    <label className="mb-3 flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-input text-primary focus:ring-primary"
      />
      <span className="text-sm font-medium">{label}</span>
    </label>
  )
}

export function SubmitButton({ label, loading, disabled = false, variant = 'primary' }: any) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={cn(
        "mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variant === 'primary' ? "bg-primary text-primary-foreground hover:brightness-110" : "bg-destructive text-destructive-foreground hover:brightness-110"
      )}
    >
      {loading ? 'Processing...' : label}
    </button>
  )
}
