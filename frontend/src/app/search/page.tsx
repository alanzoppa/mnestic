'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { search } from '@/lib/api'
import type { SearchResult } from '@/lib/api'

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [source, setSource] = useState('')
  const [folder, setFolder] = useState('')
  const [tags, setTags] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const doSearch = async (q: string) => {
    setLoading(true)
    setSearched(true)
    const filters: Record<string, string> = {}
    if (source) filters.source = source
    if (folder) filters.folder = folder
    if (tags) filters.tags = tags
    if (dateFrom) filters.date_gte = dateFrom
    if (dateTo) filters.date_lte = dateTo

    const res = await search(q, Object.keys(filters).length ? filters : undefined, undefined, true)
    setResults(res.results)
    setLoading(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSearch(query)
  }

  useEffect(() => {
    doSearch('')
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Search Notes</h1>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your notes..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
            <button
              type="submit"
              className="bg-zinc-800 hover:bg-zinc-700 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-700"
            >
              <option value="">All Sources</option>
              <option value="Apple Notes">Apple Notes</option>
              <option value="Evernote">Evernote</option>
            </select>

            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="Folder"
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-40"
            />

            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma sep)"
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 w-40"
            />

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-700"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-700"
            />
          </div>
        </form>

        {loading && (
          <div className="text-center py-12 text-zinc-400">Searching...</div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            No results found
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => {
                  if (result.type === 'calendar') {
                    const date = result.metadata?.date
                    if (date) {
                      router.push(`/calendar/${date}`)
                    } else {
                      router.push('/calendar')
                    }
                  } else {
                    router.push(`/notes/${result.id}`)
                  }
                }}
                className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-zinc-100 truncate">{result.title}</h3>
                    <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{result.snippet}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                      <span className={`px-2 py-0.5 rounded ${
                        result.type === 'calendar' ? 'bg-purple-900 text-purple-200' : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {result.type}
                      </span>
                      <span>Score: {result.score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}