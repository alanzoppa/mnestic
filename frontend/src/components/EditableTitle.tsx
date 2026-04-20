'use client'

import { useState, useRef, useEffect } from 'react'

interface EditableTitleProps {
  value: string
  onSave: (value: string) => Promise<void>
  className?: string
}

export function EditableTitle({ value, onSave, className }: EditableTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleStartEdit = () => {
    setDraft(value)
    setError(null)
    setEditing(true)
  }

  const handleSave = async () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('Title cannot be empty')
      return
    }
    if (trimmed === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
      setEditing(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setDraft(value)
    setError(null)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          data-testid="title-input"
          className="flex-1 text-3xl font-bold bg-zinc-800 border border-blue-500/50 rounded-lg px-3 py-1 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
          aria-label="Save title"
        >
          {saving ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors disabled:opacity-50"
          aria-label="Cancel editing"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {error && (
          <span className="text-red-400 text-sm ml-2">{error}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group" data-testid="editable-title">
      <h1 className={className || 'text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent'}>
        {value || 'Untitled'}
      </h1>
      <button
        onClick={handleStartEdit}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Edit title"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </div>
  )
}