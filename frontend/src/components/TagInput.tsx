'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const STRUCTURAL_TAGS = [
  '1:1', 'interview', 'work', 'personal', 'notes', 'zeig',
  'evernote', 'zendesk', 'enova', 'skitch', 'alanzoppas-notebook',
  'artificial-memory', 'chinese', 'hindi', 'household',
  'personal-receipts', 'stories', 'werk', 'aperture',
  'interview-notes', 'journal', 'raven', 'handwritten', 'image-only',
]

const MAX_TAGS = 8

interface TagInputProps {
  tags: string[]
  allTags: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ tags, allTags, onChange }: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const editableTags = tags.filter(t => !STRUCTURAL_TAGS.includes(t))
  const structuralTags = tags.filter(t => STRUCTURAL_TAGS.includes(t))
  const canAdd = tags.length < MAX_TAGS

  const suggestions = input.trim()
    ? allTags
        .filter(t => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase()))
        .slice(0, 8)
    : allTags
        .filter(t => !tags.includes(t))
        .slice(0, 8)

  useEffect(() => {
    setSelectedIdx(0)
  }, [input])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!normalized || tags.includes(normalized) || tags.length >= MAX_TAGS) return
    onChange([...tags, normalized])
    setInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeTag = (tag: string) => {
    if (STRUCTURAL_TAGS.includes(tag)) return
    onChange(tags.filter(t => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0 && showSuggestions) {
        addTag(suggestions[selectedIdx])
      } else if (input.trim()) {
        addTag(input.trim())
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    } else if (e.key === 'Backspace' && !input && editableTags.length > 0) {
      removeTag(editableTags[editableTags.length - 1])
    }
  }

  return (
    <div ref={containerRef} className="flex flex-wrap gap-2 mt-3 items-center">
      {structuralTags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 cursor-default"
          title="Structural tag (immutable)"
        >
          <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {tag}
        </span>
      ))}
      {editableTags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors group"
        >
          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="no-underline text-purple-400 hover:text-purple-300"
            onClick={e => e.stopPropagation()}
          >
            {tag}
          </Link>
          <button
            onClick={() => removeTag(tag)}
            className="ml-0.5 text-purple-400/50 hover:text-red-400 transition-colors"
            aria-label={`Remove tag ${tag}`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      {canAdd && (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => {
              setInput(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? 'Add tag...' : '+'}
            className="w-24 px-2 py-0.5 text-xs bg-transparent border border-zinc-700 rounded-full text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
            data-testid="tag-add-input"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 py-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {suggestions.map((tag, i) => (
                <button
                  key={tag}
                  onMouseDown={e => {
                    e.preventDefault()
                    addTag(tag)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${i === selectedIdx ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!canAdd && (
        <span className="text-xs text-zinc-600">Max {MAX_TAGS} tags</span>
      )}
    </div>
  )
}