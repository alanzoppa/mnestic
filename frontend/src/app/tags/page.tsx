'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, AlertTriangle } from 'lucide-react'
import { type TagInfo, type CoOccurrence } from '@/lib/api'
import { STRUCTURAL_TAGS } from '@/lib/constants'
import { tagKeys, tagsApi } from '@/lib/queries'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { DonutChart, PieChartComponent } from '@/components/charts/PieCharts'
import { SkeletonStatCards, SkeletonChart } from '@/components/ui/Skeleton'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TOOLTIP_STYLE, CARTESIAN_GRID, X_AXIS_DARK, Y_AXIS_DARK } from '@/lib/chart-styles'
import { EmptyState } from '@/components/ui/EmptyState'

const TAG_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'structural', label: 'Structural' },
  { value: 'content', label: 'Content' },
  { value: 'management', label: 'Management' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'personal', label: 'Personal' },
]

const SORT_OPTIONS = [
  { value: 'count', label: 'By Count' },
  { value: 'name', label: 'By Name' },
]

export default function TagsPage() {
  const router = useRouter()
  const { data, isLoading: loading, error } = useQuery({
    queryKey: tagKeys.all,
    queryFn: tagsApi.all,
  })
  const tags = data?.tags || []
  const coOccurrence = data?.co_occurrence || []
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('count')

  // Filter and sort tags
  const filteredTags = tags.filter(tag => {
    // Search filter
    if (searchQuery && !tag.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    
    // Category filter
    if (categoryFilter === 'structural') {
      return STRUCTURAL_TAGS.includes(tag.name)
    } else if (categoryFilter === 'content') {
      return !STRUCTURAL_TAGS.includes(tag.name)
    } else if (categoryFilter === 'management') {
      return ['1-on-1', 'team-lead', 'promotion', 'feedback', 'hiring', 'interviewing'].some(t => 
        tag.name.includes(t) || ['1:1', 'handwritten'].includes(tag.name)
      )
    } else if (categoryFilter === 'engineering') {
      return ['react', 'redux', 'ember', 'frontend', 'backend', 'api', 'system-design', 'architecture', 'testing'].some(t => 
        tag.name.includes(t)
      )
    } else if (categoryFilter === 'personal') {
      return ['mental-health', 'family', 'childhood', 'self-reflection', 'therapy', 'personal'].some(t => 
        tag.name.includes(t)
      )
    }
    
    return true
  }).sort((a, b) => {
    if (sortBy === 'count') {
      return b.count - a.count
    }
    return a.name.localeCompare(b.name)
  })

  // Prepare chart data
  const topTagsData = filteredTags.slice(0, 10).map((tag, i) => ({
    name: tag.name,
    value: tag.count,
  }))

  const barChartData = filteredTags.slice(0, 15).map(tag => ({
    name: tag.name.length > 15 ? tag.name.slice(0, 15) + '...' : tag.name,
    fullName: tag.name,
    count: tag.count,
  })).reverse()

  // Precompute max tag count for cloud sizing
  const maxTagCount = tags.length > 0 ? Math.max(...tags.map(t => t.count)) : 0

  // Calculate category stats
  const structuralCount = tags.filter(t => STRUCTURAL_TAGS.includes(t.name)).length
  const contentCount = tags.filter(t => !STRUCTURAL_TAGS.includes(t.name)).length
  const categoryData = [
    { name: 'Structural', value: structuralCount, color: '#3b82f6' },
    { name: 'Content', value: contentCount, color: '#10b981' },
  ]

  if (error) {
    return (
      <div className="max-w-7xl space-y-6">
        <SectionHeader title="Tags" description="Error loading tags" />
        <Card>
          <CardContent className="p-12 text-center">
            <EmptyState
              icon={<AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />}
              title="Failed to load tags"
              subtitle={(error as Error)?.message || 'An unexpected error occurred'}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl space-y-6">
        <SectionHeader title="Tag Explorer" description="Loading..." />
        <SkeletonStatCards count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl space-y-6">
      <SectionHeader
        title="Tag Explorer"
        description={`Browse and filter through ${tags.length.toLocaleString()} unique tags`}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-zinc-500">Total Tags</p>
            <p className="text-3xl font-bold mt-1 text-zinc-100">
              {tags.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-zinc-500">Structural Tags</p>
            <p className="text-3xl font-bold mt-1 text-blue-400">{structuralCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-zinc-500">Content Tags</p>
            <p className="text-3xl font-bold mt-1 text-emerald-400">{contentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-zinc-500">Tag Pairs</p>
            <p className="text-3xl font-bold mt-1 text-purple-400">{coOccurrence.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={
                  <Search className="w-5 h-5" />
                }
              />
            </div>
            <div className="w-48">
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={TAG_CATEGORIES}
              />
            </div>
            <div className="w-40">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={SORT_OPTIONS}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tag Distribution Bar Chart */}
        <Card hover>
          <CardHeader>
            <CardTitle>Top 15 Tags by Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData} layout="vertical">
                  <CartesianGrid {...CARTESIAN_GRID} horizontal={false} />
                  <XAxis type="number" {...X_AXIS_DARK} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100}
                    {...Y_AXIS_DARK}
                  />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar 
                    dataKey="count" 
                    fill="#3b82f6" 
                    radius={[0, 4, 4, 0]}
                    onClick={(data) => {
                      const name = (data.payload as Record<string, unknown> | undefined)?.fullName as string | undefined;
                      if (name) router.push(`/tags/${name}`)
                    }}
                    className="cursor-pointer hover:fill-blue-400"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-zinc-500">
                No tags match your filters
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card hover>
          <CardHeader>
            <CardTitle>Tag Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={categoryData}
              height={250}
              showLegend={true}
            />
          </CardContent>
        </Card>
      </div>

      {/* Tag Cloud */}
      <Card data-testid="tag-cloud-card">
        <CardHeader>
          <CardTitle data-testid="tag-cloud-title">Tag Cloud</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center justify-center py-6" data-testid="tag-cloud">
            {filteredTags.slice(0, 60).map((tag) => (
              <button
                key={tag.name}
                data-testid={`tag-${tag.name}`}
                onClick={() => router.push(`/tags/${tag.name}`)}
                className="transition-all duration-200 hover:scale-110 group"
                style={{
                  fontSize: `${Math.max(12, Math.min(32, 12 + (tag.count / maxTagCount) * 20))}px`
                }}
              >
                <Badge
                  variant={STRUCTURAL_TAGS.includes(tag.name) ? 'blue' : 'green'}
                  className="cursor-pointer group-hover:shadow-lg group-hover:shadow-blue-500/20"
                >
                  {tag.name}
                  <span className="ml-1.5 opacity-60">({tag.count})</span>
                </Badge>
              </button>
            ))}
          </div>

          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-zinc-800" data-testid="tag-legend">
            <div className="flex items-center gap-2" data-testid="structural-indicator">
              <Badge variant="blue">Structural</Badge>
              <span className="text-xs text-zinc-500">Folder/source tags</span>
            </div>
            <div className="flex items-center gap-2" data-testid="content-indicator">
              <Badge variant="green">Content</Badge>
              <span className="text-xs text-zinc-500">Topic-based tags</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Co-occurrence Table */}
      {coOccurrence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Co-occurring Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Tag 1</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Tag 2</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">Co-occurrences</th>
                  </tr>
                </thead>
                <tbody>
                  {coOccurrence.slice(0, 15).map((pair, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="py-3 px-4">
                        <Badge variant={STRUCTURAL_TAGS.includes(pair.tag1) ? 'blue' : 'green'}>
                          {pair.tag1}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={STRUCTURAL_TAGS.includes(pair.tag2) ? 'blue' : 'green'}>
                          {pair.tag2}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-400">{pair.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
