'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { search } from '@/lib/api'
import type { SearchResult } from '@/lib/api'

export default function TagPage() {
  const params = useParams()
  const router = useRouter()
  const tag = params.tag as string
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tag) return
    setLoading(true)
    search('', { tags: tag }).then((res) => {
      setResults(res.results.filter((r) => r.type === 'note'))
      setLoading(false)
    })
  }, [tag])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/tags')}
          className="mb-6 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back to Tags
        </button>

        <h1 className="text-3xl font-bold mb-2">
          <span className="text-zinc-300">#</span>{tag}
        </h1>
        <p className="text-zinc-400 mb-8">{results.length} notes</p>

        <div className="space-y-3">
          {results.map((result) => {
            const meta = result.metadata || {}
            return (
              <button
                key={result.id}
                onClick={() => router.push(`/notes/${result.note_id || result.metadata?.note_id || result.id}`)}
                className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
              >
                <h3 className="font-medium text-zinc-100">{meta.title || 'Untitled'}</h3>
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{result.snippet}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                  <span className="px-2 py-0.5 bg-zinc-800 rounded">{meta.folder || 'Unknown'}</span>
                  <span>{meta.source || ''}</span>
                </div>
              </button>
            )
          })}
        </div>

        {results.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            No notes with this tag
          </div>
        )}
      </div>
    </div>
  )
}