'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import * as THREE from 'three'
import { format, parseISO, isValid } from 'date-fns'
import { Search, ArrowLeft } from 'lucide-react'
import { type GraphNode } from '@/lib/api'
import type { ForceGraphNode } from '@/components/ForceGraph3DView'
import { searchGraphKeys, searchGraphApi } from '@/lib/queries'
import ForceGraph3DView from '@/components/ForceGraph3DView'
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

export default function SearchGraphPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const selectedNodeIdRef = useRef<string | null>(null)
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
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(0x000000),
      roughness: 0.4,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    })
    return new THREE.Mesh(geometry, material)
  }, [nodeColorMap])

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    if (!node) return
    selectedNodeIdRef.current = node.id
    setViewingNode(node)
  }, [])

  useEffect(() => {
    if (!viewingNode) {
      selectedNodeIdRef.current = null
    }
  }, [viewingNode])

  const nodePositionUpdate = useCallback((obj: THREE.Object3D, _coords: { x: number; y: number; z: number }, node: ForceGraphNode) => {
    const mesh = obj as THREE.Mesh
    const material = mesh.material as THREE.MeshStandardMaterial
    if (!material) return

    const NORMAL_OPACITY = 0.85
    const DIMMED_OPACITY = 0.5
    const SELECTED_INTENSITY = 0.8

    const isSelected = selectedNodeIdRef.current === node.id
    const hasSelection = !!selectedNodeIdRef.current

    const targetIntensity = isSelected ? SELECTED_INTENSITY : 0
    const targetOpacity = isSelected || !hasSelection ? NORMAL_OPACITY : DIMMED_OPACITY
    const nodeColor = nodeColorMap[node.id] || '#6b7280'
    const targetEmissive = isSelected ? new THREE.Color(nodeColor) : new THREE.Color(0x000000)

    if (Math.abs(material.emissiveIntensity - targetIntensity) > 0.01) {
      material.emissiveIntensity += (targetIntensity - material.emissiveIntensity) * 0.1
    } else {
      material.emissiveIntensity = targetIntensity
    }

    if (Math.abs(material.opacity - targetOpacity) > 0.01) {
      material.opacity += (targetOpacity - material.opacity) * 0.1
    } else {
      material.opacity = targetOpacity
    }

    material.emissive.lerp(targetEmissive, 0.1)
  }, [nodeColorMap])

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
        <span className="text-sm text-zinc-400">Similarity:</span>
        <input
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

  const detailPaneSlot = (
    <div
      className={`absolute bottom-4 right-4 bg-zinc-900 border border-zinc-700 rounded-lg p-3 max-w-xs z-20 shadow-lg transition-opacity duration-300 ${
        viewingNode ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      data-testid="graph-details-pane"
    >
      {viewingNode && (
        <>
          <Link
            href={`/notes/${viewingNode.id}`}
            className="font-medium text-zinc-100 truncate hover:text-blue-400 transition-colors block mb-0.5"
          >
            {viewingNode.title}
          </Link>
          {viewingNode.created && (
            <div className="text-xs text-zinc-500 mb-1">{(() => {
              const d = parseISO(viewingNode.created)
              return isValid(d) ? format(d, 'MMM d, yyyy') : viewingNode.created
            })()}</div>
          )}
          <div className="text-xs text-zinc-400">{viewingNode.folder} · {viewingNode.source}</div>
          {viewingNode.search_score !== undefined && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: nodeColorMap[viewingNode.id] || '#6b7280' }}
              />
              <span className="text-xs text-zinc-300">
                Relevance: {(viewingNode.search_score * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {viewingNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {viewingNode.tags.slice(0, 5).map(t => (
                <span key={t} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">{t}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )

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

  if (!initialQuery && !query) {
    return (
      <div className="h-[calc(100vh-48px)] bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
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
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 text-center">
            <Search size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg">Enter a search query to visualize results</p>
            <p className="text-sm mt-1">Semantically related notes will connect as a force graph</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ForceGraph3DView
      graphData={graphData}
      isLoading={isLoading}
      error={error}
      headerSlot={headerSlot}
      detailPaneSlot={detailPaneSlot}
      legendSlot={legendSlot}
      nodeObjectFn={createNodeObject}
      nodePositionUpdateFn={nodePositionUpdate}
      nodeLabelFn={(node) => {
        const pct = node.search_score !== undefined ? `${(node.search_score * 100).toFixed(0)}%` : ''
        return pct ? `${node.title} (${pct})` : node.title
      }}
      onNodeClick={handleNodeClick}
      dataTestId="graph-container"
    />
  )
}
