'use client'

import { useState, useRef, useEffect } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { getDatePresets } from '@/lib/dates'

interface DateRange {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const presets = getDatePresets()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activePreset = presets.find(p => p.from === value.from && p.to === value.to)
  const hasRange = value.from || value.to

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen) } }}
        data-testid="date-range-picker"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
          hasRange
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
        }`}
      >
        <CalendarDays className="w-4 h-4" strokeWidth={2} />
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
            <X className="w-3 h-3" strokeWidth={2} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 right-0 w-72 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-2">Quick select</p>
            <div className="space-y-1">
              {presets.map((preset) => (
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
