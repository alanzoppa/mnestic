'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getGraph, getTags, type GraphData, type GraphNode, type TagInfo } from '@/lib/api'

const FOLDER_COLORS: Record<string, string> = {
  '1:1 Notes': '#f97316',
  'Work': '#3b82f6',
  'Notes': '#a78bfa',
  'Personal': '#ec4899',
  'Interview Notes': '#10b981',
  'Evernote': '#6366f1',
  'ZEIG things': '#f59e0b',
}

function getNodeColor(node: GraphNode): string {
  return FOLDER_COLORS[node.folder] || '#6b7280'
}

export default function GraphPage() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const graphInstanceRef = useRef<any>(null)
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [libLoading, setLibLoading] = useState(true)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [selectedTag, setSelectedTag] = useState('')
  const [threshold, setThreshold] = useState(0.75)
  const [tags, setTags] = useState<TagInfo[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    getTags().then(res => setTags(res.tags.slice(0, 30))).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    getGraph(selectedTag || undefined, undefined, threshold)
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch((e: any) => {
        setError(e.message || 'Failed to load graph')
        setLoading(false)
      })
  }, [selectedTag, threshold])

  useEffect(() => {
    if (!data || !containerRef.current || data.nodes.length === 0) return

    const container = containerRef.current
    let cleanup = () => {}

    setLibLoading(true)

    import('force-graph')
      .then((mod: any) => {
        const ForceGraph = mod.default || mod
        const graph = ForceGraph()(container)
          .graphData({
            nodes: data.nodes.map(n => ({ ...n })),
            links: data.edges.map(e => ({ ...e }))
          })
          .nodeId('id')
          .nodeLabel((node: any) => node.title || node.id)
          .nodeColor((node: any) => getNodeColor(node))
          .nodeVal((node: any) => {
            const links = data.edges.filter(e => 
              e.source === node.id || e.target === node.id ||
              ((e.source as any)?.id === node.id || (e.target as any)?.id === node.id)
            )
            return Math.max(1, links.length * 0.5)
          })
          .linkColor(() => 'rgba(161, 161, 170, 0.15)')
          .linkWidth((link: any) => (link.weight || 0.5) * 2)
          .backgroundColor('transparent')
          .width(container.clientWidth)
          .height(container.clientHeight)
          .onNodeClick((node: any) => {
            if (node?.id) router.push(`/notes/${node.id}`)
          })
          .onNodeHover((node: any) => {
            if (node) {
              setHoverNode({ 
                id: node.id, 
                title: node.title, 
                folder: node.folder, 
                tags: node.tags || [], 
                source: node.source 
              })
              container.style.cursor = 'pointer'
            } else {
              setHoverNode(null)
              container.style.cursor = 'default'
            }
          })
          .cooldownTime(2000)

        const chargeForce = graph.d3Force('charge')
        if (chargeForce) chargeForce.strength(-50)

        graphInstanceRef.current = graph

        const handleResize = () => {
          graph.width(container.clientWidth).height(container.clientHeight)
        }
        window.addEventListener('resize', handleResize)

        cleanup = () => {
          window.removeEventListener('resize', handleResize)
          graph._destructor()
          graphInstanceRef.current = null
        }

        setLibLoading(false)
      })
      .catch((e: any) => {
        setError('Failed to load graph library: ' + (e.message || String(e)))
        setLibLoading(false)
      })

    return () => cleanup()
  }, [data])

  const showLoading = loading || libLoading

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Similarity Graph</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Tag:</span>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100"
          >
            <option value="">All tags</option>
            {tags.map(t => (
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
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-zinc-300 w-10">{threshold.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex-1 relative">
        {showLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-10">
            <div className="text-zinc-400">
              {loading ? 'Loading data...' : 'Initializing graph...'}
            </div>
          </div>
        )}

        {error && !showLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-400 text-center max-w-md">
              <p className="font-medium">Error</p>
              <p className="text-sm mt-1">{error}</p>
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

        <div 
          ref={containerRef} 
          className="w-full" 
          style={{ minHeight: 'calc(100vh - 140px)' }}
          data-testid="graph-container"
        />

        {hoverNode && (
          <div className="absolute bottom-4 left-4 bg-zinc-900 border border-zinc-700 rounded-lg p-3 max-w-xs z-20 shadow-lg">
            <div className="font-medium text-zinc-100 truncate">{hoverNode.title}</div>
            <div className="text-xs text-zinc-400 mt-1">{hoverNode.folder} · {hoverNode.source}</div>
            {hoverNode.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {hoverNode.tags.slice(0, 5).map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="absolute top-4 right-4 bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 z-20" data-testid="graph-legend">
          <div className="text-xs font-medium text-zinc-300 mb-2">Legend</div>
          {Object.entries(FOLDER_COLORS).map(([folder, color]) => (
            <div key={folder} className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {folder}
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