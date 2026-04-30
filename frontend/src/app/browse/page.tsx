'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, Star, ChevronRight } from 'lucide-react'
import { schemaKeys, schemaApi, searchApi } from '@/lib/queries'
import type { SearchResult } from '@/lib/api'
import { useDebouncedValue } from '@/lib/hooks'
import { useFavorites } from '@/lib/favorites'
import { STRUCTURAL_TAGS } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Input'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SkeletonNoteCard } from '@/components/ui/Skeleton'
import { NoteResult } from '@/components/NoteResult'
import { EmptyState } from '@/components/ui/EmptyState'

const PAGE_SIZE = 50

export default function BrowsePage() {
  const router = useRouter()
  const { isFav, toggle, favorites } = useFavorites()

  // Filters
  const [sourceFilter, setSourceFilter] = useState('')
  const [folderFilter, setFolderFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebouncedValue(searchQuery, 200)
  const [showFilters, setShowFilters] = useState(false)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)

  // Queries
  const { data: allResults = [], isLoading: loading } = useQuery({
    queryKey: ['browse', 'all-notes'],
    queryFn: async () => {
      const res = await searchApi.all({ query: '', n: 500, daysBack: 30 });
      return res.filter((r: SearchResult) => r.type === 'note');
    },
    staleTime: Infinity,
  });

  const { data: schema = null } = useQuery({
    queryKey: schemaKeys.all,
    queryFn: schemaApi.get,
    staleTime: Infinity,
  });

  // Calculate facet counts
  const facets = useMemo(() => {
    const sources = new Map<string, number>()
    const folders = new Map<string, number>()
    const tags = new Map<string, number>()

    allResults.forEach((r) => {
      const meta = r.metadata || {}
      
      // Sources
      if (meta.source) {
        sources.set(meta.source, (sources.get(meta.source) || 0) + 1)
      }
      
      // Folders
      if (meta.folder) {
        folders.set(meta.folder, (folders.get(meta.folder) || 0) + 1)
      }
      
      // Tags
      const noteTags: string[] = Array.isArray(meta.tags) ? meta.tags : []
      noteTags.forEach((tag: string) => {
        tags.set(tag, (tags.get(tag) || 0) + 1)
      })
    })

    return {
      sources: Array.from(sources.entries()).sort((a, b) => b[1] - a[1]),
      folders: Array.from(folders.entries()).sort((a, b) => b[1] - a[1]),
      tags: Array.from(tags.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20),
    }
  }, [allResults])

  // Apply filters
  const filtered = useMemo(() => {
    return allResults.filter((r) => {
      const meta = r.metadata || {}
      const noteId = r.note_id || r.id
      
      // Source filter
      if (sourceFilter && meta.source !== sourceFilter) return false
      
      // Folder filter
      if (folderFilter && meta.folder !== folderFilter) return false
      
      // Tag filter
      if (tagFilter) {
        const noteTags = meta.tags || []
        if (!noteTags.includes(tagFilter)) return false
      }
      
      // Favorites filter
      if (showFavoritesOnly && !isFav(noteId)) return false
      
      // Search query (debounced)
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase()
        const titleMatch = (meta.title || '').toLowerCase().includes(query)
        const snippetMatch = (r.snippet || '').toLowerCase().includes(query)
        if (!titleMatch && !snippetMatch) return false
      }
      
      return true
    })
  }, [allResults, sourceFilter, folderFilter, tagFilter, debouncedSearch, showFavoritesOnly, isFav])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aDate = a.metadata?.created || ''
      const bDate = b.metadata?.created || ''
      return bDate.localeCompare(aDate)
    })
  }, [filtered])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const start = (currentPage - 1) * PAGE_SIZE
  const pageResults = sorted.slice(start, start + PAGE_SIZE)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo(0, 0)
  }

  const clearFilters = () => {
    setSourceFilter('')
    setFolderFilter('')
    setTagFilter('')
    setSearchQuery('')
    setCurrentPage(1)
  }

  const activeFiltersCount = [sourceFilter, folderFilter, tagFilter].filter(Boolean).length

  if (loading) {
    return (
      <div className="max-w-7xl space-y-6">
        <SectionHeader title="Browse Notes" description="Loading..." />
        <SkeletonNoteCard />
        <SkeletonNoteCard />
        <SkeletonNoteCard />
        <SkeletonNoteCard />
        <SkeletonNoteCard />
      </div>
    )
  }

  return (
    <div className="max-w-7xl space-y-6">
      <SectionHeader
        title="Browse Notes"
        description={`${filtered.length.toLocaleString()} of ${allResults.length.toLocaleString()} notes`}
      />

      {/* Search & Filter Controls */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[280px]">
              <Input
                placeholder="Search in notes..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                icon={
                  <Search className="w-5 h-5" />
                }
              />
            </div>
            
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>
            
            <Button
              variant={showFavoritesOnly ? 'primary' : 'secondary'}
              onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentPage(1) }}
            >
              <Star className={`w-4 h-4 mr-2 ${showFavoritesOnly ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              Favorites{showFavoritesOnly && ` (${favorites.length})`}
            </Button>
            
            {activeFiltersCount > 0 && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>

          {/* Facets Panel */}
          {showFilters && (
            <div className="pt-4 border-t border-zinc-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Source Facet */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Source</label>
                  <div className="space-y-1">
                    <button
                      onClick={() => { setSourceFilter(''); setCurrentPage(1) }}
                      className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                        !sourceFilter ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-zinc-800/50 text-zinc-400'
                      }`}
                    >
                      <span>All Sources</span>
                      <span className="text-xs text-zinc-500">{allResults.length}</span>
                    </button>
                    {facets.sources.map(([source, count]) => (
                      <button
                        key={source}
                        onClick={() => { setSourceFilter(source); setCurrentPage(1) }}
                        className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                          sourceFilter === source ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-zinc-800/50 text-zinc-400'
                        }`}
                      >
                        <span>{source}</span>
                        <span className="text-xs text-zinc-500">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Folder Facet */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Folder</label>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { setFolderFilter(''); setCurrentPage(1) }}
                      className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                        !folderFilter ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-zinc-800/50 text-zinc-400'
                      }`}
                    >
                      <span>All Folders</span>
                    </button>
                    {facets.folders.map(([folder, count]) => (
                      <button
                        key={folder}
                        onClick={() => { setFolderFilter(folder); setCurrentPage(1) }}
                        className={`w-full flex justify-between items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                          folderFilter === folder ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-zinc-800/50 text-zinc-400'
                        }`}
                      >
                        <span className="truncate">{folder}</span>
                        <span className="text-xs text-zinc-500 ml-2">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags Facet */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Popular Tags</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setTagFilter(''); setCurrentPage(1) }}
                      className={`transition-all ${!tagFilter ? 'ring-2 ring-purple-500/50' : ''}`}
                    >
                      <Badge variant="zinc">All</Badge>
                    </button>
                    {facets.tags.map(([tag, count]) => (
                      <button
                        key={tag}
                        onClick={() => { setTagFilter(tag); setCurrentPage(1) }}
                        className={`transition-all ${tagFilter === tag ? 'ring-2 ring-purple-500/50' : ''}`}
                      >
                        <Badge 
                          variant={STRUCTURAL_TAGS.includes(tag) ? 'blue' : 'green'}
                          className="cursor-pointer"
                        >
                          {tag}
                          <span className="ml-1.5 opacity-60">({count})</span>
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {sourceFilter && (
            <Badge variant="blue" className="flex items-center gap-1">
              Source: {sourceFilter}
              <button 
                onClick={() => setSourceFilter('')}
                className="ml-1 hover:text-white"
              ></button>
            </Badge>
          )}
          {folderFilter && (
            <Badge variant="green" className="flex items-center gap-1">
              Folder: {folderFilter}
            </Badge>
          )}
          {tagFilter && (
            <Badge variant="purple" className="flex items-center gap-1">
              Tag: {tagFilter}
            </Badge>
          )}
        </div>
      )}

      {/* Results Grid */}
      <div className="grid gap-4">
        {pageResults.map((result) => {
          const meta = result.metadata || {}
          const noteId = result.note_id || meta?.note_id || result.id

          return (
            <Link key={result.id} href={`/notes/${noteId}`} className="block no-underline group">
              <Card hover>
                <CardContent className="p-5">
                  <NoteResult
                    title={meta.title || 'Untitled'}
                    source={meta.source}
                    folder={meta.folder}
                    created={meta.created}
                    tags={meta.tags || []}
                    snippet={result.snippet}
                  />
                  <div className="flex justify-end mt-2">
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                  if (page > totalPages) return null
                  return (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>
              
              <Button
                variant="secondary"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
            <p className="text-center text-sm text-zinc-500 mt-3">
              Showing {start + 1}-{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} notes
            </p>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <EmptyState
              title="No notes found"
              subtitle="Try adjusting your filters"
              action={activeFiltersCount > 0 ? { label: 'Clear Filters', onClick: clearFilters } : undefined}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
