'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Filter, ChevronRight, GitGraph } from 'lucide-react'
import {
  tagKeys, tagsApi,
  schemaKeys, schemaApi,
  searchApi,
} from '@/lib/queries'
import type { SearchResult } from '@/lib/api'
import { STRUCTURAL_TAGS } from '@/lib/constants'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonNoteCard } from '@/components/ui/Skeleton'
import { SearchAutocomplete } from '@/components/SearchAutocomplete'
import { DateRangePicker } from '@/components/DateRangePicker'
import { NoteResult } from '@/components/NoteResult'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TOOLTIP_STYLE, CARTESIAN_GRID, X_AXIS_DARK, Y_AXIS_DARK } from '@/lib/chart-styles'

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
  const [searched, setSearched] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [filters, setFilters] = useState<SearchFilters>({
    source: '',
    folder: '',
    tags: [],
    dateFrom: '',
    dateTo: '',
  })

  // Static data (tags, sources, autocomplete titles)
  const { data: tagsData } = useQuery({ queryKey: tagKeys.all, queryFn: tagsApi.all });
  const allTags = tagsData?.tags ?? [];

  const { data: schemaData } = useQuery({ queryKey: schemaKeys.all, queryFn: schemaApi.get });
  const allSources = schemaData?.sources ?? [];

  const { data: rawTitleResults = [] } = useQuery({
    queryKey: ['autocomplete', 'titles'],
    queryFn: () => searchApi.all({ query: '', n: 500 }),
    staleTime: Infinity,
  });
  const noteTitles = rawTitleResults
    .filter((r) => r.type === 'note')
    .map((r) => ({
      id: r.id,
      title: r.title,
      note_id: r.note_id || r.metadata?.note_id,
    }));

  // Build api filters for the mutation
  const apiFilters: Record<string, string> = {}
  if (filters.source) apiFilters.source = filters.source
  if (filters.folder) apiFilters.folder = filters.folder
  if (filters.tags.length) apiFilters.tags = filters.tags.join(',')
  if (filters.dateFrom) apiFilters.date_gte = filters.dateFrom
  if (filters.dateTo) apiFilters.date_lte = filters.dateTo

  const canSearch = query.trim() || filters.tags.length || filters.source || filters.folder;

  const searchMutation = useMutation({
    mutationFn: async () => {
      const data = await searchApi.all({
        query: query || '*',
        filters: Object.keys(apiFilters).length ? apiFilters : undefined,
        n: 50,
        includeCalendar: true,
      });
      return data;
    },
  });

  const results = searchMutation.data ?? [];
  const loading = searchMutation.isPending;

  const doSearch = () => {
    if (!canSearch) return;
    setSearched(true);
    searchMutation.mutate();
  };

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

  const resultStats = useMemo(() => ({
    notes: results.filter(r => r.type === 'note').length,
    calendar: results.filter(r => r.type === 'calendar').length,
    sources: [...new Set(results.map(r => r.metadata?.source).filter(Boolean))],
  }), [results])

  const topResultTags = useMemo(() => {
    const tagCounts: Record<string, number> = {}
    for (const r of results) {
      for (const tag of (r.metadata?.tags || [])) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }
    return (Object.entries(tagCounts) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }))
  }, [results])

  // Get popular tags for suggestions
  const popularTags = allTags.slice(0, 15)

  return (
    <div className="space-y-6">
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
                <Filter className="w-4 h-4 mr-2" />
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
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                            filters.source === source
                              ? 'bg-blue-500/12 text-blue-400 border-blue-500/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
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
          {searchMutation.isError && (
            <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              Search failed: {searchMutation.error?.message || 'Unknown error'}
            </div>
          )}
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
                      <CartesianGrid {...CARTESIAN_GRID} horizontal={false} />
                      <XAxis type="number" {...X_AXIS_DARK} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={100}
                        {...Y_AXIS_DARK}
                        tick={{ ...Y_AXIS_DARK.tick, fontSize: 10 }}
                      />
                      <Tooltip {...TOOLTIP_STYLE} />
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
          <div className="flex items-center justify-between mb-2">
            <SectionHeader title={`Results (${results.length})`} />
            <Link
              href={`/search-graph?q=${encodeURIComponent(query)}`}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <GitGraph className="w-3.5 h-3.5" />
              View as Graph
            </Link>
          </div>
          <div className="space-y-3">
            {results.map((result) => {
              const isCalendar = result.type === 'calendar'
              const noteHref = `/notes/${result.note_id || result.metadata?.note_id || result.id}`
              const calDate = result.metadata?.date
              const cardContent = (
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <NoteResult
                        title={result.metadata?.title || result.title}
                        source={result.metadata?.source}
                        folder={result.metadata?.folder}
                        created={result.metadata?.created}
                        date={result.metadata?.date}
                        tags={result.metadata?.tags || []}
                        type={isCalendar ? 'calendar' : 'note'}
                        snippet={result.snippet}
                        score={result.score}
                        showScore={true}
                        highlightQuery={query}
                      />
                    </div>
                    <div className="text-zinc-600 group-hover:text-blue-400 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              )

              if (isCalendar) {
                return (
                  <Card
                    key={result.id}
                    hover
                    className="cursor-pointer group"
                    onClick={() => {
                      if (calDate) router.push(`/calendar/${calDate}`)
                      else router.push('/calendar')
                    }}
                  >
                    {cardContent}
                  </Card>
                )
              }

              return (
                <Link key={result.id} href={noteHref} className="block group">
                  <Card hover className="cursor-pointer">
                    {cardContent}
                  </Card>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {/* Loading State */}
      {searched && loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonNoteCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {searched && !loading && results.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <EmptyState
              title="No results found"
              subtitle="Try adjusting your search query or filters"
              action={activeFiltersCount > 0 ? { label: 'Clear Filters', onClick: clearFilters } : undefined}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
