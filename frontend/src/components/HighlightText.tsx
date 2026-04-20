'use client'

interface HighlightTextProps {
  text: string
  query: string
  className?: string
}

export function HighlightText({ text, query, className = '' }: HighlightTextProps) {
  if (!query.trim()) return <span className={className}>{text}</span>

  const lower = query.toLowerCase()
  const lowerText = text.toLowerCase()
  const index = lowerText.indexOf(lower)

  if (index === -1) return <span className={className}>{text}</span>

  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)

  return (
    <span className={className}>
      {before}
      <mark className="bg-yellow-500/20 text-yellow-300 rounded px-0.5">{match}</mark>
      <HighlightText text={after} query={query} />
    </span>
  )
}