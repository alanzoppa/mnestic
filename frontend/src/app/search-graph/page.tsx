'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import * as THREE from 'three'
import { Search, ArrowLeft } from 'lucide-react'
import { type GraphNode } from '@/lib/api'
import type { ForceGraphNode } from '@/components/ForceGraph3DView'
import ForceGraph3DView, { makeNodeMaterial } from '@/components/ForceGraph3DView'
import DetailPane from '@/components/DetailPane'
import { searchGraphKeys, searchGraphApi } from '@/lib/queries'
import Link from 'next/link'

const GRADIENT_STOPS = ['#2563eb', '#06b6d4', '#10b981', '#eab308', '#ef4444']

function lerpColor(a: string, b: string, t: number): string {
  const parse = (s: string) => ({
    r: parseInt(s.slice(1, 3), 16),
    g: parseInt(s.slice(3, 5), 16),
    b: parseInt(s.slice(5, 7), 16),
  })
  const ca = parse(a)
  const cb = parse(b)
  const cr = Math.round(ca.r + (cb.r - ca.r) * t)
  const cg = Math.round(ca.g + (cb.g - ca.g) * t)
  const cbv = Math.round(ca.b + (cb.b - ca.b) * t)
  return `#${cr.toString(16).padStart(2, '0')}${cg.toString(16).padStart(2, '0')}${cbv.toString(16).padStart(2, '0')}`
}

function scoreToHex(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio))
  const idx = Math.min(Math.floor(t * (GRADIENT_STOPS.length - 1)), GRADIENT_STOPS.length - 2)
  const localT = (t * (GRADIENT_STOPS.length - 1)) - idx
  return lerpColor(GRADIENT_STOPS[idx]!, GRADIENT_STOPS[idx + 1]!, localT)
}

function SearchGraphContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [viewingNode, setViewingNode] = useState<GraphNode | null>(null)
  const [inputValue, setInputValue] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [threshold, setThreshold] = useState(0.55)

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery)
      setInputValue(initialQuery)
    }
  }, [initialQuery])

  const { data, isLoading, error } = useQuery({
    queryKey: searchGraphKeys.all(query, threshold, 50),
    queryFn: () => searchGraphApi.get(query, threshold, 50),
    enabled: !!query,
  })

  const graphData = useMemo(() => {
    if (!data) return null
    return { nodes: data.nodes, links: data.edges.map(e => ({ ...e })) }
  }, [data])

  const { minScore, maxScore } = useMemo(() => {
    if (!data?.nodes.length) return { minScore: 0, maxScore: 0 }
    const scores = data.nodes.map(n => n.search_score || 0)
    return { minScore: Math.min(...scores), maxScore: Math.max(...scores) }
  }, [data])

  const nodeColorMap = useMemo(() => {
    if (!data?.nodes || maxScore === minScore) return {} as Record<string, string>
    const range = maxScore - minScore
    const map: Record<string, string> = {}
    data.nodes.forEach(n => {
      map[n.id] = scoreToHex(((n.search_score || 0) - minScore) / range)
    })
    return map
  }, [data, minScore, maxScore])

  const createNodeObject = useCallback((node: ForceGraphNode): THREE.Object3D => {
    const color = nodeColorMap[node.id] || '#6b7280'
    const geometry = new THREE.SphereGeometry(4.2, 24, 24)
    const material = makeNodeMaterial(color)
    return new THREE.Mesh(geometry, material)
  }, [nodeColorMap])

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    if (!node) return
    setViewingNode(node)
  }, [])

  const handleSearch = () => {
    const q = inputValue.trim()
    setViewingNode(null)
    if (q) {
      setQuery(q)
      router.replace(`/search-graph?q=${encodeURIComponent(q)}`)
    } else {
      setQuery('')
    }
  }

  const headerSlot = (
    <div className="p-4 border-b border-zinc-800 flex items-center gap-4 flex-wrap">
      <Link href="/search" className="text-zinc-500 hover:text-zinc-300 transition-colors">
        <ArrowLeft size={20} />
      </Link>
      <h1 className="text-2xl font-bold">Search Graph</h1>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
          placeholder="Search query..."
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-64"
          data-search-input=""
        />
        <button
          onClick={handleSearch}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white transition-colors flex items-center gap-1"
        >
          <Search size={14} />
          Search
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="similarity-range" className="text-sm text-zinc-400">Similarity:</label>
        <input
          id="similarity-range"
          type="range"
          min="0.3"
          max="0.8"
          step="0.05"
          value={threshold}
          onChange={(e) => { setThreshold(parseFloat(e.target.value)); setViewingNode(null) }}
          className="w-24"
        />
        <span className="text-sm text-zinc-300 w-10">{threshold.toFixed(2)}</span>
      </div>
    </div>
  )

  const detailPaneSlot = <DetailPane node={viewingNode} nodeColorMap={nodeColorMap} />

  const legendSlot = (
    <div className="absolute top-4 right-4 bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 z-20" data-testid="graph-legend">
      <div className="text-xs font-medium text-zinc-300 mb-2">Relevance</div>
      <div className="w-32 h-3 rounded-sm" style={{
        background: `linear-gradient(to right, ${GRADIENT_STOPS.join(', ')})`
      }} />
      <div className="flex justify-between mt-1 text-xs text-zinc-500">
        <span>Low</span>
        <span>High</span>
      </div>
      {data && (
        <div className="mt-2 pt-2 border-t border-zinc-700 text-xs text-zinc-500" data-testid="graph-stats">
          {data.nodes.length} nodes · {data.edges.length} edges
        </div>
      )}
    </div>
  )

  const placeholderSlot = !initialQuery && !query ? (
    <div className="text-zinc-500 text-center">
      <Search size={40} className="mx-auto mb-3 opacity-30" />
      <p className="text-lg">Enter a search query to visualize results</p>
      <p className="text-sm mt-1">Semantically related notes will connect as a force graph</p>
    </div>
  ) : null

  return (
    <ForceGraph3DView
      graphData={graphData}
      isLoading={isLoading}
      error={error}
      headerSlot={(!initialQuery && !query) ? headerSlot : headerSlot}
      detailPaneSlot={detailPaneSlot}
      legendSlot={(!initialQuery && !query) ? null : legendSlot}
      placeholderSlot={placeholderSlot}
      nodeObjectFn={createNodeObject}
      nodeLabelFn={(node) => {
        const pct = node.search_score !== undefined ? `${(node.search_score * 100).toFixed(0)}%` : ''
        return pct ? `${node.title} (${pct})` : node.title
      }}
      onNodeClick={handleNodeClick}
      selectedNodeId={viewingNode?.id ?? null}
      dataTestId="graph-container"
    />
  )
}

export default function SearchGraphPage() {
  return (
    <Suspense>
      <SearchGraphContent />
    </Suspense>
  )
}
