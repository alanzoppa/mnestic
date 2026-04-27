'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useCombobox } from 'downshift'
import { Lock, X } from 'lucide-react'
import { STRUCTURAL_TAGS } from '@/lib/constants'

const MAX_TAGS = 8

interface TagInputProps {
  tags: string[]
  allTags: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ tags, allTags, onChange }: TagInputProps) {
  const [input, setInput] = useState('')
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

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!normalized || tags.includes(normalized) || tags.length >= MAX_TAGS) return
    onChange([...tags, normalized])
    setInput('')
  }

  const removeTag = (tag: string) => {
    if (STRUCTURAL_TAGS.includes(tag)) return
    onChange(tags.filter(t => t !== tag))
  }

  const {
    isOpen,
    getInputProps,
    getMenuProps,
    getItemProps,
    highlightedIndex,
    closeMenu,
  } = useCombobox({
    items: suggestions,
    inputValue: input,
    onInputValueChange: (changes) => {
      setInput(changes.inputValue || '')
    },
    onSelectedItemChange: (changes) => {
      const item = changes.selectedItem
      if (item) {
        addTag(item)
        closeMenu()
      }
    },
    itemToString: (item) => (item || ''),
  })

  const inputProps = getInputProps({
    placeholder: tags.length === 0 ? 'Add tag...' : '+',
    className: 'w-24 px-2 py-0.5 text-xs bg-transparent border border-zinc-700 rounded-full text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50',
    'data-testid': 'tag-add-input',
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && input.trim()) {
        e.preventDefault()
        if (suggestions.length > 0 && highlightedIndex >= 0) {
          addTag(suggestions[highlightedIndex])
        } else {
          addTag(input.trim())
        }
      } else if (e.key === 'Escape') {
        closeMenu()
      } else if (e.key === 'Backspace' && !input && editableTags.length > 0) {
        removeTag(editableTags[editableTags.length - 1])
      }
    },
  })

  const { ref: dsInputRef, ...restInputProps } = inputProps as React.HTMLAttributes<HTMLInputElement> & { ref: React.Ref<HTMLInputElement> }

  const menuProps = getMenuProps()
  const { ref: dsMenuRef, ...restMenuProps } = menuProps as React.HTMLAttributes<HTMLDivElement> & { ref: React.Ref<HTMLDivElement> }

  return (
    <div ref={containerRef} className="flex flex-wrap gap-2 mt-3 items-center">
      {structuralTags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 cursor-default"
          title="Structural tag (immutable)"
        >
          <Lock className="w-3 h-3 opacity-50" strokeWidth={2} />
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
            <X className="w-3 h-3" strokeWidth={2} />
          </button>
        </span>
      ))}
      {canAdd && (
        <div className="relative">
          <input {...restInputProps} ref={dsInputRef} />
          <div
            {...restMenuProps}
            ref={dsMenuRef}
            className={`absolute z-20 mt-1 py-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto ${
              (!isOpen || suggestions.length === 0) ? 'hidden' : ''
            }`}
          >
            {isOpen && suggestions.length > 0 && suggestions.map((tag, i) => (
              <button
                key={tag}
                {...getItemProps({ item: tag, index: i })}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  i === highlightedIndex
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
      {!canAdd && (
        <span className="text-xs text-zinc-600">Max {MAX_TAGS} tags</span>
      )}
    </div>
  )
}
