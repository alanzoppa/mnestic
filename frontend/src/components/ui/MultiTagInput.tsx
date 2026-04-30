'use client'

import { useState } from 'react'
import { useCombobox } from 'downshift'
import { X } from 'lucide-react'
import { Badge } from './Badge'

interface MultiTagInputProps {
  selectedTags: string[]
  allTags: { name: string; count: number }[]
  onChange: (tags: string[]) => void
  placeholder?: string
  label?: string
  error?: string
}

export function MultiTagInput({
  selectedTags,
  allTags,
  onChange,
  placeholder = 'Add tag...',
  label,
  error,
}: MultiTagInputProps) {
  const [input, setInput] = useState('')

  const filteredTags = input
    ? allTags.filter(
        (t) =>
          t.name.toLowerCase().includes(input.toLowerCase()) &&
          !selectedTags.includes(t.name)
      )
    : allTags.filter((t) => !selectedTags.includes(t.name))

  const visibleItems = filteredTags.slice(0, 20)

  const addTag = (name: string) => {
    if (!selectedTags.includes(name)) {
      onChange([...selectedTags, name])
    }
    setInput('')
  }

  const removeTag = (name: string) => {
    onChange(selectedTags.filter((t) => t !== name))
  }

  const {
    isOpen,
    getInputProps,
    getMenuProps,
    getItemProps,
    highlightedIndex,
    closeMenu,
  } = useCombobox({
    items: visibleItems,
    inputValue: input,
    onInputValueChange: (changes) => {
      setInput(changes.inputValue || '')
    },
    onSelectedItemChange: (changes) => {
      if (changes.selectedItem) {
        addTag(changes.selectedItem.name)
        closeMenu()
      }
    },
    itemToString: (item) => item?.name || '',
  })

  const inputProps = getInputProps({
    placeholder,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && input.trim()) {
        e.preventDefault()
        if (visibleItems.length > 0 && highlightedIndex >= 0) {
          addTag(visibleItems[highlightedIndex]!.name)
        }
      } else if (e.key === 'Escape') {
        closeMenu()
      } else if (e.key === 'Backspace' && !input && selectedTags.length > 0) {
        removeTag(selectedTags[selectedTags.length - 1]!)
      }
    },
  })

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-zinc-400 mb-1.5">
          {label}
        </label>
      )}
      <div
        data-testid="multitag-input"
        className={`flex flex-wrap gap-2 items-center w-full bg-zinc-900/80 border rounded-lg px-3 py-2 transition-all focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 ${
          error ? 'border-red-500/50' : 'border-zinc-800'
        }`}
      >
        {selectedTags.map((tag) => (
          <Badge
            key={tag}
            variant="purple"
            size="md"
            data-testid="tag-pill"
            aria-label={`Remove tag ${tag}`}
            className="gap-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 text-purple-400 hover:text-purple-300 transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          <input
            {...inputProps}
            className="w-full py-0.5 px-1 text-sm bg-transparent border-none text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            data-testid="tag-input"
          />
          <div
            {...getMenuProps({}, { suppressRefError: true })}
            data-testid="tag-dropdown"
            className={`absolute z-50 left-0 mt-1 py-1 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto ${
              !isOpen || visibleItems.length === 0 ? 'hidden' : ''
            }`}
          >
            {isOpen &&
              visibleItems.length > 0 &&
              visibleItems.map((tag, i) => (
                <button
                  key={tag.name}
                  data-testid="tag-option"
                  {...getItemProps({ item: tag, index: i })}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                    i === highlightedIndex
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <span className="truncate">{tag.name}</span>
                  <span className="ml-auto text-xs text-zinc-500 shrink-0">
                    {tag.count}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
}
