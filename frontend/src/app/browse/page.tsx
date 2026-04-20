'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { search, getSchema } from '@/lib/api'
import type { SearchResult } from '@/lib/api'
import { useDebouncedValue } from '@/lib/hooks'
import { useFavorites } from '@/lib/favorites'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Input'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SkeletonNoteCard } from '@/components/ui/Skeleton'
import { FavoriteButton } from '@/components/FavoriteButton'

const PAGE_SIZE = 50

const STRUCTURAL_TAGS = ['1:1', 'evernote', 'zendesk', 'interview', 'work', 'personal', 'notes', 'zeig', 'handwritten', 'image-only']

function asArray(val: unknown): string[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) return val.split(',').map((s: string) => s.trim()).filter(Boolean)
  return []
}

export default function BrowsePage() {
  const router = useRouter()
  const { isFav, toggle, favorites } = useFavorites()
  const [allResults, setAllResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [schema, setSchema] = useState<{ folders?: string[]; tags?: string[] } | null>(null)
  
  // Filters
  const [sourceFilter, setSourceFilter] = useState('')
  const [folderFilter, setFolderFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebouncedValue(searchQuery, 200)
  const [showFilters, setShowFilters] = useState(false)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      search(''),
      getSchema().catch(() => null)
    ]).then(([res, schemaData]) => {
      setAllResults(res.results.filter((r) => r.type === 'note'))
      setSchema(schemaData)
      setLoading(false)
    })
  }, [])

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
      const noteTags = asArray(meta.tags)
      noteTags.forEach((tag) => {
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
        const noteTags = asArray(meta.tags)
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const start = (currentPage - 1) * PAGE_SIZE
  const pageResults = filtered.slice(start, start + PAGE_SIZE)

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
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
            
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>
            
            <Button
              variant={showFavoritesOnly ? 'primary' : 'secondary'}
              onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentPage(1) }}
            >
              <svg className={`w-4 h-4 mr-2 ${showFavoritesOnly ? 'fill-yellow-400 text-yellow-400' : ''}`} viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
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
          const tags = asArray(meta.tags)
          const isHandwritten = tags.includes('handwritten')
          
          return (
            <Link 
              key={result.id}
              href={`/notes/${result.note_id || result.metadata?.note_id || result.id}`}
              className="block no-underline"
            >
              <Card hover>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="blue">{meta.source || 'Unknown'}</Badge>
                        <span className="text-zinc-600">·</span>
                        <Badge variant="zinc">{meta.folder || 'Unknown'}</Badge>
                        {isHandwritten && (
                          <>
                            <span className="text-zinc-600">·</span>
                            <Badge variant="amber">Handwritten</Badge>
                          </>
                        )}
                      </div>
                      
                      <h3 className="font-semibold text-zinc-100 text-lg group-hover:text-blue-400 transition-colors">
                        {meta.title || 'Untitled'}
                      </h3>
                      
                      <p className="text-sm text-zinc-500 mt-1">
                        {meta.created ? new Date(meta.created).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : ''}
                      </p>
                      
                      <p className="text-sm text-zinc-400 mt-3 line-clamp-2">
                        {result.snippet?.substring(0, 150) || ''}
                      </p>
                      
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-4">
                          {tags.filter((t: string) => !STRUCTURAL_TAGS.includes(t)).slice(0, 6).map((tag: string) => (
                            <Badge key={tag} variant="green" size="sm">{tag}</Badge>
                          ))}
                          {tags.filter((t: string) => !STRUCTURAL_TAGS.includes(t)).length > 6 && (
                            <span className="text-zinc-500 text-xs">+{tags.length - 6}</span>
                          )}
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
            <div className="text-zinc-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium">No notes found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
              {activeFiltersCount > 0 && (
                <Button variant="secondary" onClick={clearFilters} className="mt-4">
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
