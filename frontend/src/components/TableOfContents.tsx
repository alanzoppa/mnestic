'use client'

import { useState, useEffect, useRef, useMemo } from 'react'

interface Heading {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  content: string
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  const headings = useMemo(() => {
    const regex = /^(#{1,3})\s+(.+)$/gm
    const result: Heading[] = []
    let match
    while ((match = regex.exec(content)) !== null) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 50)
      result.push({ id, text, level })
    }
    return result
  }, [content])

  useEffect(() => {
    if (headings.length < 3) return

    const headingEls = headings.map(h => document.getElementById(h.id)).filter(Boolean) as HTMLElement[]

    if (headingEls.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px' }
    )

    headingEls.forEach(el => observerRef.current?.observe(el))

    return () => {
      observerRef.current?.disconnect()
    }
  }, [headings])

  if (headings.length < 3) return null

  const handleClick = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav className="space-y-1">
      <p className="text-sm font-medium text-zinc-400 mb-2">On this page</p>
      {headings.map((heading) => (
        <button
          key={heading.id}
          onClick={() => handleClick(heading.id)}
          className={`block w-full text-left text-sm py-1 transition-colors ${
            activeId === heading.id
              ? 'text-blue-400 font-medium'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
        >
          <span className="truncate">{heading.text}</span>
        </button>
      ))}
    </nav>
  )
}