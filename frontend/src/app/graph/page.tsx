'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { type GraphNode } from '@/lib/api'
import { tagKeys, graphKeys, graphApi } from '@/lib/queries'
import Link from 'next/link'

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false, loading: () => null })

const COLOR_PALETTE = [
  '#3b82f6', '#f97316', '#10b981', '#ec4899',
  '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444',
  '#84cc16', '#d946ef', '#14b8a6', '#f43f5e',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function assignTagColors(tags: string[]): Record<string, string> {
  const sorted = [...new Set(tags)].sort()
  const colors: Record<string, string> = {}
  sorted.forEach((tag, index) => {
    const paletteIndex = (index + hashString(tag)) % COLOR_PALETTE.length
    colors[tag] = COLOR_PALETTE[paletteIndex]
  })
  return colors
}

function createGlowTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  gradient.addColorStop(0.08, 'rgba(255, 255, 255, 0.85)')
  gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.4)')
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.1)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

function getNodeColor(node: GraphNode, tagColors: Record<string, string>): string {
  const primaryTag = node.tags?.[0]
  return primaryTag ? tagColors[primaryTag] || '#6b7280' : '#6b7280'
}

export default function GraphPage() {
  const fgRef = useRef<any>(null)
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const highlightSpriteRef = useRef<THREE.Sprite | null>(null)
  const glowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [viewingNode, setViewingNode] = useState<GraphNode | null>(null)
  const [selectedTag, setSelectedTag] = useState('')
  const [threshold, setThreshold] = useState(0.75)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // ResizeObserver to get actual pixel dimensions for the Three.js canvas
  useEffect(() => {
    const container = graphContainerRef.current
    if (!container) return

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect()
      setDimensions({ width, height })
    }

    updateSize()

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateSize())
      resizeObserver.observe(container)
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', updateSize)
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect()
      else window.removeEventListener('resize', updateSize)
    }
  }, [])

  const { data: tagsData } = useQuery({
    queryKey: tagKeys.list,
    queryFn: graphApi.tags,
  });

  const { data, isLoading: loading, error } = useQuery({
    queryKey: graphKeys.all(selectedTag || undefined, threshold),
    queryFn: () => graphApi.get(selectedTag || undefined, threshold),
  });

  const graphData = useMemo(() => {
    if (!data) return null
    return { nodes: data.nodes, links: data.edges.map(e => ({ ...e })) }
  }, [data])

  const tagColors = useMemo(() => {
    if (!data) return {}
    const primaryTags = data.nodes.map(n => n.tags?.[0]).filter(Boolean) as string[]
    return assignTagColors(primaryTags)
  }, [data])

  const handleNodeClick = useCallback((node: any) => {
    if (!fgRef.current || !node) return

    const distance = 40
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)

    const newPos = node.x || node.y || node.z
      ? { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }
      : { x: 0, y: 0, z: distance }

    fgRef.current.cameraPosition(newPos, node, 3000)

    const scene = fgRef.current.scene()
    if (scene) {
      if (highlightSpriteRef.current) {
        scene.remove(highlightSpriteRef.current)
        highlightSpriteRef.current = null
      }
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current)
        glowTimeoutRef.current = null
      }
      glowTimeoutRef.current = setTimeout(() => {
        if (!fgRef.current) return
        const s = fgRef.current.scene()
        if (!s) return
        if (highlightSpriteRef.current) {
          s.remove(highlightSpriteRef.current)
          highlightSpriteRef.current = null
        }
        const material = new THREE.SpriteMaterial({
          map: createGlowTexture(),
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
        const sprite = new THREE.Sprite(material)
        sprite.scale.set(22, 22, 1)
        sprite.position.set(node.x, node.y, node.z)
        s.add(sprite)
        highlightSpriteRef.current = sprite
        const fadeDuration = 800
        const start = Date.now()
        const fade = () => {
          if (!highlightSpriteRef.current) return
          const elapsed = Date.now() - start
          const t = Math.min(elapsed / fadeDuration, 1)
          highlightSpriteRef.current.position.set(node.x, node.y, node.z)
          highlightSpriteRef.current.material.opacity = t
          if (t < 1) requestAnimationFrame(fade)
        }
        requestAnimationFrame(fade)
      }, 3000)
    }

    setViewingNode(node as GraphNode)
  }, [])

  useEffect(() => {
    if (!viewingNode) {
      if (glowTimeoutRef.current) {
        clearTimeout(glowTimeoutRef.current)
        glowTimeoutRef.current = null
      }
      if (highlightSpriteRef.current) {
        const fg = fgRef.current
        if (fg) {
          const scene = fg.scene()
          if (scene) scene.remove(highlightSpriteRef.current)
        }
        highlightSpriteRef.current = null
      }
    }
  }, [viewingNode])

  const showLoading = loading

  return (
    <div className="h-[calc(100vh-48px)] bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Similarity Graph</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Tag:</span>
          <select
            value={selectedTag}
            onChange={(e) => { setSelectedTag(e.target.value); setViewingNode(null) }}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100"
          >
            <option value="">All tags</option>
            {(tagsData || []).map(t => (
              <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Similarity:</span>
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(e) => { setThreshold(parseFloat(e.target.value)); setViewingNode(null) }}
            className="w-24"
          />
          <span className="text-sm text-zinc-300 w-10">{threshold.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {showLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-10">
            <div className="text-zinc-400">Loading data...</div>
          </div>
        )}

        {(error) && !showLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-400 text-center max-w-md">
              <p className="font-medium">Error</p>
              <p className="text-sm mt-1">{error?.message}</p>
            </div>
          </div>
        )}

        {data && data.nodes.length === 0 && !showLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-zinc-400 text-center">
              <p>No connections found.</p>
              <p className="text-sm mt-1">Try lowering the similarity threshold or removing the tag filter.</p>
            </div>
          </div>
        )}

        <div ref={graphContainerRef} data-testid="graph-container" className="w-full h-full">
          {data && data.nodes.length > 0 && (
             <ForceGraph3D
              ref={fgRef}
              graphData={graphData!}
              nodeId="id"
              nodeLabel="title"
              nodeColor={(node: any) => getNodeColor(node as GraphNode, tagColors)}
              backgroundColor="#09090b"
              onNodeClick={handleNodeClick}
              enableNodeDrag={false}
              nodeResolution={32}
              showNavInfo={true}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
        </div>

        {/* Details Pane */}
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
                className="font-medium text-zinc-100 truncate hover:text-blue-400 transition-colors block"
              >
                {viewingNode.title}
              </Link>
              <div className="text-xs text-zinc-400 mt-1">{viewingNode.folder} · {viewingNode.source}</div>
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

        {/* Legend */}
        <div className="absolute top-4 right-4 bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 z-20 max-h-56 overflow-y-auto" data-testid="graph-legend">
          <div className="text-xs font-medium text-zinc-300 mb-2">Legend</div>
          {Object.entries(tagColors).map(([tag, color]) => (
            <div key={tag} className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {tag}
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
            <div className="w-3 h-3 rounded-full bg-zinc-500 shrink-0" />
            Other
          </div>
          {data && (
            <div className="mt-2 pt-2 border-t border-zinc-700 text-xs text-zinc-500" data-testid="graph-stats">
              {data.nodes.length} nodes · {data.edges.length} edges
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
