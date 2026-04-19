'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTags } from '@/lib/api'
import type { TagInfo, CoOccurrence } from '@/lib/api'

const STRUCTURAL_TAGS = ['1:1', 'evernote', 'zendesk', 'interview', 'work', 'personal', 'notes', 'zeig', 'handwritten', 'image-only']

export default function TagsPage() {
  const router = useRouter()
  const [tags, setTags] = useState<TagInfo[]>([])
  const [coOccurrence, setCoOccurrence] = useState<CoOccurrence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTags().then((res) => {
      setTags(res.tags)
      setCoOccurrence(res.co_occurrence || [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    )
  }

  const maxCount = Math.max(...tags.map((t) => t.count), 1)
  const minSize = 12
  const maxSize = 32

  const getFontSize = (count: number) => {
    const ratio = count / maxCount
    return minSize + (maxSize - minSize) * ratio
  }

  const getTagColor = (name: string) => {
    if (STRUCTURAL_TAGS.includes(name)) {
      return 'text-blue-400 hover:text-blue-300'
    }
    return 'text-green-400 hover:text-green-300'
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Tag Explorer</h1>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-medium mb-4 text-zinc-200">Tag Cloud</h2>
          <div className="flex flex-wrap gap-4 items-center justify-center">
            {tags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => router.push(`/tags/${tag.name}`)}
                className={`transition-colors ${getTagColor(tag.name)}`}
                style={{ fontSize: getFontSize(tag.count) }}
              >
                {tag.name}
                <span className="text-zinc-500 text-xs ml-1">({tag.count})</span>
              </button>
            ))}
          </div>
          <div className="flex gap-6 mt-4 justify-center text-xs">
            <span className="text-blue-400">■ Structural</span>
            <span className="text-green-400">■ Content</span>
          </div>
        </div>

        {coOccurrence.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4 text-zinc-200">Top Co-occurring Tags</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 text-left border-b border-zinc-800">
                  <th className="pb-2 font-medium">Tag 1</th>
                  <th className="pb-2 font-medium">Tag 2</th>
                  <th className="pb-2 font-medium text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {coOccurrence.slice(0, 20).map((pair, i) => (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="py-2 text-zinc-300">{pair.tag1}</td>
                    <td className="py-2 text-zinc-300">{pair.tag2}</td>
                    <td className="py-2 text-zinc-400 text-right">{pair.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}