'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { search, getTags, getSchema } from '@/lib/api'
import type { SearchResult, TagInfo } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { DonutChart } from '@/components/charts/PieCharts'
import { SkeletonNoteCard } from '@/components/ui/Skeleton'
import { SearchAutocomplete } from '@/components/SearchAutocomplete'
import { HighlightText } from '@/components/HighlightText'
import { DateRangePicker } from '@/components/DateRangePicker'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const STRUCTURAL_TAGS = ['1:1', 'evernote', 'zendesk', 'interview', 'work', 'personal', 'notes', 'zeig', 'handwritten', 'image-only']

interface SearchFilters {
  source: string
  folder: string
  tags: string[]
  dateFrom: string
  dateTo: string
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [allTags, setAllTags] = useState<TagInfo[]>([])
  const [allSources, setAllSources] = useState<string[]>([])
  const [noteTitles, setNoteTitles] = useState<{ id: string; title: string; note_id?: string }[]>([])
  const [showFilters, setShowFilters] = useState(false)
  
  const [filters, setFilters] = useState<SearchFilters>({
    source: '',
    folder: '',
    tags: [],
    dateFrom: '',
    dateTo: '',
  })

  // Load tags and sources on mount
  useEffect(() => {
    getTags().then(res => setAllTags(res.tags)).catch(() => {})
    getSchema().then(s => setAllSources(s.sources || [])).catch(() => {})
  }, [])

  // Cache note titles for autocomplete
  useEffect(() => {
    let cancelled = false
    search('').then(res => {
      if (!cancelled) {
        setNoteTitles(res.results.map(r => ({
          id: r.id,
          title: r.title,
          note_id: r.note_id || r.metadata?.note_id,
        })))
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const doSearch = async () => {
    if (!query.trim() && !filters.tags.length && !filters.source && !filters.folder) return
    
    setLoading(true)
    setSearched(true)
    
    const apiFilters: Record<string, string> = {}
    if (filters.source) apiFilters.source = filters.source
    if (filters.folder) apiFilters.folder = filters.folder
    if (filters.tags.length) apiFilters.tags = filters.tags.join(',')
    if (filters.dateFrom) apiFilters.date_gte = filters.dateFrom
    if (filters.dateTo) apiFilters.date_lte = filters.dateTo

    try {
      const res = await search(query || '*', Object.keys(apiFilters).length ? apiFilters : undefined, 50, true)
      setResults(res.results)
    } catch {
      setResults([])
    }
    setLoading(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSearch()
  }

  const toggleTag = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }))
  }

  const clearFilters = () => {
    setFilters({
      source: '',
      folder: '',
      tags: [],
      dateFrom: '',
      dateTo: '',
    })
  }

  const activeFiltersCount = 
    (filters.source ? 1 : 0) +
    (filters.folder ? 1 : 0) +
    filters.tags.length +
    (filters.dateFrom || filters.dateTo ? 1 : 0)

  // Calculate result stats
  const resultStats = {
    notes: results.filter(r => r.type === 'note').length,
    calendar: results.filter(r => r.type === 'calendar').length,
    sources: [...new Set(results.map(r => r.metadata?.source).filter(Boolean))],
  }

  // Get top tags from results
  const resultTags = results
    .flatMap(r => r.metadata?.tags || [])
    .reduce((acc, tag) => {
      acc[tag as string] = (acc[tag as string] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  
  const topResultTags = (Object.entries(resultTags) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }))

  // Get popular tags for suggestions
  const popularTags = allTags.slice(0, 15)

  return (
    <div className="max-w-7xl space-y-6">
      <SectionHeader
        title="Search Notes"
        description={searched ? `Found ${results.length.toLocaleString()} results` : 'Find notes with semantic search'}
      />

      {/* Search Form */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <SearchAutocomplete
                  query={query}
                  onQueryChange={setQuery}
                  tags={allTags}
                  noteTitles={noteTitles}
                  onSubmit={doSearch}
                  placeholder="Enter your search query..."
                  className="h-12"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
              >
                Search
              </Button>
            </div>

            {/* Quick Filters Toggle */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="filter-toggle"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </Button>
              
              <DateRangePicker
                value={{ from: filters.dateFrom, to: filters.dateTo }}
                onChange={({ from, to }) => setFilters(prev => ({ ...prev, dateFrom: from, dateTo: to }))}
              />

              {!searched && popularTags.length > 0 && (
                <>
                  <span className="text-sm text-zinc-500" data-testid="popular-tags-label">Popular:</span>
                  <div className="flex gap-1 overflow-x-auto">
                    {popularTags.slice(0, 8).map(tag => (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => toggleTag(tag.name)}
                        className={`transition-all ${filters.tags.includes(tag.name) ? 'ring-2 ring-purple-500/50' : ''}`}
                      >
                        <Badge 
                          variant={filters.tags.includes(tag.name) ? 'purple' : 'zinc'}
                          size="sm"
                          className="whitespace-nowrap"
                        >
                          {tag.name}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="mt-6 pt-6 border-t border-zinc-800 space-y-6" data-testid="filter-panel">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Source */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Source</label>
                    <div className="flex flex-wrap gap-2">
                      {(['', ...allSources]).map((source) => (
                        <button
                          key={source || 'all'}
                          type="button"
                          onClick={() => setFilters(prev => ({ ...prev, source }))}
                          data-testid={`filter-source-${source || 'all'}`}
                          data-active={filters.source === source}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filters.source === source
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {source || 'All'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Folder */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Folder</label>
                    <Input
                      type="text"
                      value={filters.folder}
                      onChange={(e) => setFilters(prev => ({ ...prev, folder: e.target.value }))}
                      placeholder="Filter by folder..."
                    />
                  </div>
                </div>

                {/* Tag Filter */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.slice(0, 30).map((tag) => (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => toggleTag(tag.name)}
                        className={`transition-all ${filters.tags.includes(tag.name) ? 'ring-2 ring-purple-500/50' : ''}`}
                      >
                        <Badge
                          variant={filters.tags.includes(tag.name) 
                            ? 'purple' 
                            : STRUCTURAL_TAGS.includes(tag.name) ? 'blue' : 'green'
                          }
                        >
                          {tag.name}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                {activeFiltersCount > 0 && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Clear all filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Results Stats & Visualizations */}
      {searched && results.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Result Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Result Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-4 text-center">
                    <div className="text-3xl font-bold text-blue-400">{resultStats.notes}</div>
                    <div className="text-sm text-zinc-500 mt-1">Notes</div>
                  </div>
                  <div className="card p-4 text-center">
                    <div className="text-3xl font-bold text-purple-400">{resultStats.calendar}</div>
                    <div className="text-sm text-zinc-500 mt-1">Calendar Events</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Tags in Results */}
            <Card>
              <CardHeader>
                <CardTitle>Top Tags in Results</CardTitle>
              </CardHeader>
              <CardContent>
                {topResultTags.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topResultTags} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis type="number" stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100}
                        stroke="#52525b" 
                        tick={{ fill: '#a1a1aa', fontSize: 10 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '0.5rem',
                          color: '#fafafa',
                        }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#8b5cf6" 
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-zinc-500">
                    No tag data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results List */}
          <div className="space-y-3">
            {results.map((result) => (
              <Card 
                key={result.id}
                hover
                className="cursor-pointer group"
                onClick={() => {
                  if (result.type === 'calendar') {
                    const date = result.metadata?.date
                    if (date) {
                      router.push(`/calendar/${date}`)
                    } else {
                      router.push('/calendar')
                    }
                  } else {
                    router.push(`/notes/${result.note_id || result.metadata?.note_id || result.id}`)
                  }
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge 
                          variant={result.type === 'calendar' ? 'purple' : 'blue'}
                        >
                          {result.type}
                        </Badge>
                        <span className="text-xs text-zinc-500">Score: {result.score.toFixed(2)}</span>
                      </div>
                      
                      <h3 className="font-medium text-zinc-100 group-hover:text-blue-400 transition-colors">
                        <HighlightText text={result.title} query={query} />
                      </h3>
                      
                      <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
                        <HighlightText text={result.snippet} query={query} />
                      </p>
                      
                      {(result.metadata?.tags?.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {result.metadata.tags.slice(0, 5).map((tag: string) => (
                            <Badge 
                              key={tag} 
                              variant={STRUCTURAL_TAGS.includes(tag) ? 'blue' : 'green'}
                              size="sm"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-zinc-600 group-hover:text-blue-400 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {searched && results.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-xl font-medium text-zinc-300">No results found</p>
            <p className="text-sm text-zinc-500 mt-2">Try adjusting your search query or filters</p>
            {activeFiltersCount > 0 && (
              <Button variant="secondary" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
