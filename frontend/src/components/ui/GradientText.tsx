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
}: GradientTextProps) {
  return (
    <Tag className={`text-zinc-100 ${className}`}>
      {children}
    </Tag>
  )
}
