'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Check, X, Pencil } from 'lucide-react'

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
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
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} />
          ) : (
            <Check className="w-5 h-5" strokeWidth={2.5} />
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors disabled:opacity-50"
          aria-label="Cancel editing"
        >
          <X className="w-5 h-5" strokeWidth={2.5} />
        </button>
        {error && (
          <span className="text-red-400 text-sm ml-2">{error}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group" data-testid="editable-title">
        <h1 className={className || 'text-3xl font-bold text-zinc-100'}>
        {value || 'Untitled'}
      </h1>
      <button
        onClick={handleStartEdit}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Edit title"
      >
        <Pencil className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  )
}
