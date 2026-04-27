'use client'

import { useState, useEffect } from 'react'
import { useCombobox } from 'downshift'
import { Tag, X } from 'lucide-react'

interface TagAutocompleteProps {
  tags: { name: string; count: number }[]
  selectedTag: string
  onTagSelect: (tag: string) => void
  placeholder?: string
  className?: string
}

export function TagAutocomplete({
  tags,
  selectedTag,
  onTagSelect,
  placeholder = 'Filter by tag...',
  className = '',
}: TagAutocompleteProps) {
  // Local inputValue drives what's shown in the field and the filtered list.
  // When selectedTag changes externally (e.g., initial load, reset), sync it in.
  const [inputValue, setInputValue] = useState(selectedTag)

  useEffect(() => {
    setInputValue(selectedTag)
  }, [selectedTag])

  // Filter tags by whatever the user typed.
  const lowerQuery = inputValue.toLowerCase()
  const filteredTags = inputValue
    ? tags.filter((t) => t.name.toLowerCase().includes(lowerQuery))
    : tags

  const visibleItems = filteredTags.slice(0, 20)

  const {
    isOpen,
    getInputProps,
    getMenuProps,
    getItemProps,
    highlightedIndex,
    openMenu,
  } = useCombobox({
    items: visibleItems,
    inputValue,
    itemToString: (item) => item?.name || '',
    onInputValueChange: ({ inputValue: newInputValue }) => {
      setInputValue(newInputValue || '')
    },
    onSelectedItemChange: ({ selectedItem, inputValue: newInputValue }) => {
      if (selectedItem) {
        setInputValue(selectedItem.name)
        onTagSelect(selectedItem.name)
      } else if (newInputValue === '') {
        setInputValue('')
        onTagSelect('')
      }
    },
  })

  return (
    <div className={`relative w-56 ${className}`}>
      <div className="relative">
        <input
          {...getInputProps({
            placeholder,
            className:
              'w-full h-9 pl-8 pr-8 text-sm bg-zinc-900 border border-zinc-700 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
            onFocus: () => openMenu(),
          })}
        />
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
          <Tag className="w-4 h-4" strokeWidth={2} />
        </div>
        {selectedTag && (
          <button
            type="button"
            onClick={() => {
              setInputValue('')
              onTagSelect('')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            data-testid="clear-tag-filter"
            aria-label="Clear tag filter"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>

      <div
        data-testid="tag-autocomplete-menu"
        {...getMenuProps()}
        className={`absolute z-50 w-full mt-1 max-h-80 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl ${
          !isOpen || visibleItems.length === 0 ? 'hidden' : ''
        }`}
      >
        {isOpen &&
          visibleItems.length > 0 &&
          visibleItems.map((tag, i) => (
            <div
              key={tag.name}
              data-testid="tag-autocomplete-item"
              {...getItemProps({ item: tag, index: i })}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer text-sm ${
                i === highlightedIndex
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <Tag
                className="w-3.5 h-3.5 text-purple-400 shrink-0"
                strokeWidth={2}
              />
              <span className="truncate">{tag.name}</span>
              <span className="ml-auto text-xs text-zinc-500 shrink-0">
                {tag.count}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}
