'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { search } from '@/lib/api'
import type { SearchResult } from '@/lib/api'

const PAGE_SIZE = 50

function asArray(val: unknown): string[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) return val.split(',').map((s: string) => s.trim()).filter(Boolean)
  return []
}

export default function BrowsePage() {
  const router = useRouter()
  const [allResults, setAllResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('')
  const [folderFilter, setFolderFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    search('').then((res) => {
      setAllResults(res.results.filter((r) => r.type === 'note'))
      setLoading(false)
    })
  }, [])

  const filtered = allResults.filter((r) => {
    const meta = r.metadata || {}
    if (sourceFilter && meta.source !== sourceFilter) return false
    if (folderFilter && meta.folder !== folderFilter) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const start = (currentPage - 1) * PAGE_SIZE
  const pageResults = filtered.slice(start, start + PAGE_SIZE)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo(0, 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Browse Notes</h1>

        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1) }}
            className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-700"
          >
            <option value="">All Sources</option>
            <option value="Apple Notes">Apple Notes</option>
            <option value="Evernote">Evernote</option>
          </select>

          <input
            type="text"
            value={folderFilter}
            onChange={(e) => { setFolderFilter(e.target.value); setCurrentPage(1) }}
            placeholder="Filter by folder"
            className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-48"
          />

          <span className="ml-auto text-zinc-400 self-center">
            {filtered.length} notes
          </span>
        </div>

        <div className="grid gap-3">
          {pageResults.map((result) => {
            const meta = result.metadata || {}
            const tags = asArray(meta.tags)
            return (
              <button
                key={result.id}
                onClick={() => router.push(`/notes/${result.id}`)}
                className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-zinc-100">{meta.title || 'Untitled'}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                      <span className="px-2 py-0.5 bg-zinc-800 rounded">{meta.folder || 'Unknown'}</span>
                      <span>{meta.created || ''}</span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                      {result.snippet?.substring(0, 100) || ''}
                    </p>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tags.slice(0, 5).map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                        {tags.length > 5 && (
                          <span className="text-zinc-500 text-xs">+{tags.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded hover:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-zinc-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded hover:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}