'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { searchApi } from '@/lib/queries'
import type { SearchResult } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SkeletonNoteCard } from '@/components/ui/Skeleton'
import { ArrowLeft } from 'lucide-react'

export default function TagPage() {
  const params = useParams()
  const router = useRouter()
  const tag = typeof params.tag === 'string' ? params.tag : Array.isArray(params.tag) ? params.tag[0] ?? '' : ''
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', 'tag', tag],
    queryFn: () => searchApi.byTag(tag),
    enabled: !!tag,
  })

  if (isLoading) {
    return (
      <div className="max-w-7xl space-y-6">
        <SectionHeader title={`#${tag}`} description="Loading..." />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonNoteCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/tags')}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tags
      </Button>

      <SectionHeader title={`#${tag}`} description={`${results.length} notes`} />

      <div className="space-y-3">
        {results.map((result) => {
          const meta = result.metadata || {}
          return (
            <Card
              key={result.id}
              hover
              className="cursor-pointer"
              onClick={() => router.push(`/notes/${result.note_id || result.metadata?.note_id || result.id}`)}
            >
              <CardContent className="p-4">
                <h3 className="font-semibold text-zinc-100">{meta.title || 'Untitled'}</h3>
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{result.snippet}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="zinc" size="sm">{meta.folder || 'Unknown'}</Badge>
                  {meta.source && <Badge variant="zinc" size="sm">{meta.source}</Badge>}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}