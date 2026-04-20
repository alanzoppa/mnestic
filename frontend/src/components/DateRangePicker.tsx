'use client'

import { useState, useRef, useEffect } from 'react'

interface DateRange {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

const PRESETS: { label: string; from: string; to: string }[] = (() => {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()

  return [
    { label: 'Last 30 days', from: fmt(new Date(y, m, d - 30)), to: fmt(now) },
    { label: 'Last 90 days', from: fmt(new Date(y, m, d - 90)), to: fmt(now) },
    { label: 'Last 6 months', from: fmt(new Date(y, m - 6, d)), to: fmt(now) },
    { label: 'Last year', from: fmt(new Date(y - 1, m, d)), to: fmt(now) },
    { label: 'This year', from: fmt(new Date(y, 0, 1)), to: fmt(now) },
    { label: 'Last year (full)', from: fmt(new Date(y - 1, 0, 1)), to: fmt(new Date(y - 1, 11, 31)) },
    { label: 'All time', from: '', to: '' },
  ]
})()

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activePreset = PRESETS.find(p => p.from === value.from && p.to === value.to)
  const hasRange = value.from || value.to

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          hasRange
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
        }`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {activePreset ? activePreset.label : hasRange ? 'Custom range' : 'Date range'}
        {hasRange && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange({ from: '', to: '' })
            }}
            className="ml-1 hover:text-white"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 right-0 w-72 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-2">Quick select</p>
            <div className="space-y-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    onChange({ from: preset.from, to: preset.to })
                    if (preset.from === '' && preset.to === '') {
                      setIsOpen(false)
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activePreset?.label === preset.label
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <p className="text-sm font-medium text-zinc-300 mb-2">Custom range</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">From</label>
                <input
                  type="date"
                  value={value.from}
                  onChange={(e) => onChange({ ...value, from: e.target.value })}
                  className="input input-sm w-full"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">To</label>
                <input
                  type="date"
                  value={value.to}
                  onChange={(e) => onChange({ ...value, to: e.target.value })}
                  className="input input-sm w-full"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}