'use client'

import { useState, useRef, useEffect } from 'react'

const MAX_PARTICIPANTS = 10

interface PersonInfo {
  name: string
  aliases: string[]
  context: string
}

interface PersonInputProps {
  participants: string[]
  people: PersonInfo[]
  onChange: (participants: string[]) => void
}

export function PersonInput({ participants, people, onChange }: PersonInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const canAdd = participants.length < MAX_PARTICIPANTS

  const matchPerson = (query: string): PersonInfo[] => {
    if (!query.trim()) return people.filter(p => !participants.includes(p.name)).slice(0, 8)
    const q = query.toLowerCase()
    return people
      .filter(p => {
        if (participants.includes(p.name)) return false
        if (p.name.toLowerCase().includes(q)) return true
        return p.aliases.some(a => a.toLowerCase().includes(q))
      })
      .slice(0, 8)
  }

  const suggestions = matchPerson(input)

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

  const addPerson = (name: string) => {
    if (participants.includes(name) || participants.length >= MAX_PARTICIPANTS) return
    onChange([...participants, name])
    setInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removePerson = (name: string) => {
    onChange(participants.filter(p => p !== name))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0 && showSuggestions) {
        addPerson(suggestions[selectedIdx].name)
      } else if (input.trim()) {
        addPerson(input.trim())
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    } else if (e.key === 'Backspace' && !input && participants.length > 0) {
      removePerson(participants[participants.length - 1])
    }
  }

  return (
    <div ref={containerRef} className="flex flex-wrap gap-2 mt-4 items-center">
      {participants.map(p => (
        <span
          key={p}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 transition-colors group"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {p}
          <button
            onClick={() => removePerson(p)}
            className="ml-0.5 text-zinc-500 hover:text-red-400 transition-colors"
            aria-label={`Remove participant ${p}`}
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
            placeholder={participants.length === 0 ? 'Add person...' : '+'}
            className="w-28 px-2 py-0.5 text-xs bg-transparent border border-zinc-700 rounded-full text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
            data-testid="person-add-input"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 py-1 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {suggestions.map((person, i) => {
                const aliasMatch = person.aliases.find(a => a.toLowerCase().includes(input.toLowerCase()))
                return (
                  <button
                    key={person.name}
                    onMouseDown={e => {
                      e.preventDefault()
                      addPerson(person.name)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${i === selectedIdx ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-400 hover:bg-zinc-700'}`}
                  >
                    <span className="font-medium">{person.name}</span>
                    {aliasMatch && (
                      <span className="text-zinc-500 ml-1">({aliasMatch})</span>
                    )}
                    {person.context && (
                      <span className="text-zinc-600 ml-1">— {person.context}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      {!canAdd && (
        <span className="text-xs text-zinc-600">Max {MAX_PARTICIPANTS} participants</span>
      )}
    </div>
  )
}