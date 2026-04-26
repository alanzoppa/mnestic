'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCombobox } from 'downshift'
import { Search, Tag, FileText } from 'lucide-react'
import { useDebouncedValue } from '@/lib/hooks'

interface AutocompleteSuggestion {
  type: 'tag' | 'note' | 'action'
  text: string
  subtext?: string
  href?: string
  onSelect?: () => void
}

interface SearchAutocompleteProps {
  query: string
  onQueryChange: (query: string) => void
  tags: { name: string; count: number }[]
  noteTitles: { id: string; title: string; note_id?: string }[]
  onSubmit: () => void
  placeholder?: string
  className?: string
}

export function SearchAutocomplete({
  query,
  onQueryChange,
  tags,
  noteTitles,
  onSubmit,
  placeholder = 'Search your notes...',
  className = '',
}: SearchAutocompleteProps) {
  const router = useRouter()
  const debouncedQuery = useDebouncedValue(query, 150)

  const suggestions = buildSuggestions(debouncedQuery, tags, noteTitles)
  const maxVisible = 8
  const visibleSuggestions = suggestions.slice(0, maxVisible)

  const handleSelection = useCallback(
    (item: AutocompleteSuggestion | null) => {
      if (!item) return
      if (item.onSelect) {
        item.onSelect()
      } else if (item.href) {
        router.push(item.href)
      }
    },
    [router]
  )

  const {
    isOpen,
    getInputProps,
    getMenuProps,
    getItemProps,
    highlightedIndex,
    openMenu,
  } = useCombobox({
    items: visibleSuggestions,
    inputValue: query,
    onInputValueChange: (changes) => {
      onQueryChange(changes.inputValue || '')
    },
    onSelectedItemChange: (changes) => {
      handleSelection(changes.selectedItem)
    },
    itemToString: (item) => (item ? item.text : ''),
  })

  const inputProps = getInputProps({
    placeholder,
    className: 'input h-12 pl-10 pr-10',
    'data-search-input': '',
    onFocus: () => openMenu(),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && highlightedIndex === -1) {
        e.preventDefault()
        onSubmit()
      }
    },
  })

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          {...inputProps}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
          <Search className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs pointer-events-none select-none hidden sm:block">
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">⌘K</kbd>
        </div>
      </div>

      {isOpen && debouncedQuery.length > 0 && visibleSuggestions.length > 0 && (
        <div
          {...getMenuProps()}
          className="absolute z-50 w-full mt-1 max-h-80 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
        >
          {visibleSuggestions.map((suggestion, i) => (
            <div
              key={`${suggestion.type}-${suggestion.text}`}
              {...getItemProps({ item: suggestion, index: i })}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                i === highlightedIndex
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <span className="shrink-0">
                {suggestion.type === 'tag' && (
                  <Tag className="w-4 h-4 text-purple-400" strokeWidth={2} />
                )}
                {suggestion.type === 'note' && (
                  <FileText className="w-4 h-4 text-blue-400" strokeWidth={2} />
                )}
                {suggestion.type === 'action' && (
                  <Search className="w-4 h-4 text-emerald-400" strokeWidth={2} />
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-medium truncate block">{suggestion.text}</span>
                {suggestion.subtext && (
                  <span className="text-xs text-zinc-500 truncate block">{suggestion.subtext}</span>
                )}
              </span>
              {suggestion.type === 'tag' && (
                <span className="text-xs text-zinc-600 shrink-0">tag</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function buildSuggestions(
  query: string,
  tags: { name: string; count: number }[],
  noteTitles: { id: string; title: string; note_id?: string }[]
): AutocompleteSuggestion[] {
  if (!query.trim()) return []

  const lower = query.toLowerCase()
  const suggestions: AutocompleteSuggestion[] = []

  const matchingTags = tags
    .filter(t => t.name.toLowerCase().includes(lower))
    .slice(0, 4)

  for (const tag of matchingTags) {
    suggestions.push({
      type: 'tag',
      text: tag.name,
      subtext: `${tag.count} notes`,
      href: `/tags/${encodeURIComponent(tag.name)}`,
    })
  }

  const matchingNotes = noteTitles
    .filter(n => n.title.toLowerCase().includes(lower))
    .slice(0, 4)

  for (const note of matchingNotes) {
    const noteId = note.note_id || note.id
    suggestions.push({
      type: 'note',
      text: note.title,
      subtext: noteId,
      href: `/notes/${encodeURIComponent(noteId)}`,
    })
  }

  if (query.trim().length > 0) {
    suggestions.push({
      type: 'action',
      text: `Semantic search: "${query.trim()}"`,
      subtext: 'Search by meaning, not just keywords',
    })
  }

  return suggestions
}
