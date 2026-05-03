import { ReactNode } from 'react'

interface GradientTextProps {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  className?: string
  from?: string
  via?: string
  to?: string
}

export function GradientText({
  children,
  as: Tag = 'span',
  className = '',
  from = 'from-white',
  via = 'via-zinc-200',
  to = 'to-zinc-400',
}: GradientTextProps) {
  return (
    <Tag
      className={`bg-gradient-to-r ${from} ${via} ${to} bg-clip-text text-transparent ${className}`}
    >
      {children}
    </Tag>
  )
}
