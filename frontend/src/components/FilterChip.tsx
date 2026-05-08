'use client'

import { Crosshair } from 'lucide-react'

interface FilterChipProps {
  label: string
  isExcluded: boolean
  onToggle: () => void
  onKeepOnly: () => void
  baseClass?: string
  excludedClass?: string
  style?: React.CSSProperties
  icon?: React.ReactNode
  testId: string
  keepTestId: string
}

export default function FilterChip({
  label,
  isExcluded,
  onToggle,
  onKeepOnly,
  baseClass,
  excludedClass,
  style,
  icon,
  testId,
  keepTestId,
}: FilterChipProps) {
  const activeClass = baseClass ?? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  const inactiveClass = excludedClass ?? 'bg-zinc-800/50 text-zinc-600 border-zinc-700/50 line-through'

  return (
    <button
      onClick={onToggle}
      className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors inline-flex items-center gap-1 group ${
        isExcluded ? inactiveClass : activeClass
      }`}
      style={style}
      data-testid={testId}
      data-active={!isExcluded}
    >
      {icon}
      {label}
      <span
        aria-label={`Keep only ${label}`}
        data-testid={keepTestId}
        className="ml-1 text-current opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer inline-flex items-center"
        onClick={e => { e.stopPropagation(); onKeepOnly() }}
      >
        <Crosshair size={10} />
      </span>
    </button>
  )
}
