'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as THREE from 'three'
import { format, parseISO, isValid } from 'date-fns'
import { type GraphNode } from '@/lib/api'
import { tagKeys, graphKeys, graphApi } from '@/lib/queries'
import { TagAutocomplete } from '@/components/TagAutocomplete'
import ForceGraph3DView from '@/components/ForceGraph3DView'
import Link from 'next/link'

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

function getNodeColor(node: GraphNode, tagColors: Record<string, string>): string {
  const primaryTag = node.tags?.[0]
  return primaryTag ? tagColors[primaryTag] || '#6b7280' : '#6b7280'
}

function createNodeObject(node: GraphNode, tagColors: Record<string, string>): THREE.Object3D {
  const color = getNodeColor(node, tagColors)
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
}

export default function GraphPage() {
  const selectedNodeIdRef = useRef<string | null>(null)
  const [viewingNode, setViewingNode] = useState<GraphNode | null>(null)
  const [selectedTag, setSelectedTag] = useState('')
  const [threshold, setThreshold] = useState(0.75)

  const { data: tagsData } = useQuery({
    queryKey: tagKeys.list,
    queryFn: graphApi.tags,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: graphKeys.all(selectedTag || undefined, threshold),
    queryFn: () => graphApi.get(selectedTag || undefined, threshold),
  })

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
    if (!node) return
    selectedNodeIdRef.current = node.id
    setViewingNode(node as GraphNode)
  }, [])

  useEffect(() => {
    if (!viewingNode) {
      selectedNodeIdRef.current = null
    }
  }, [viewingNode])

  const nodePositionUpdate = useCallback((obj: THREE.Object3D, _coords: { x: number; y: number; z: number }, node: any) => {
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
    const targetEmissive = isSelected ? new THREE.Color(getNodeColor(node as GraphNode, tagColors)) : new THREE.Color(0x000000)

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
  }, [tagColors])

  const headerSlot = (
    <div className="p-4 border-b border-zinc-800 flex items-center gap-4 flex-wrap">
      <h1 className="text-2xl font-bold">Similarity Graph</h1>
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-400">Tag:</span>
        <TagAutocomplete
          tags={tagsData || []}
          selectedTag={selectedTag}
          onTagSelect={(tag) => { setSelectedTag(tag); setViewingNode(null) }}
          data-testid="tag-autocomplete"
        />
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
              const d = parseISO(viewingNode.created);
              return isValid(d) ? format(d, 'MMM d, yyyy') : viewingNode.created;
            })()}</div>
          )}
          <div className="text-xs text-zinc-400">{viewingNode.folder} · {viewingNode.source}</div>
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
  )

  return (
    <ForceGraph3DView
      graphData={graphData}
      isLoading={isLoading}
      error={error as Error | null}
      headerSlot={headerSlot}
      detailPaneSlot={detailPaneSlot}
      legendSlot={legendSlot}
      nodeObjectFn={(node: any) => createNodeObject(node as GraphNode, tagColors)}
      nodePositionUpdateFn={nodePositionUpdate}
      onNodeClick={handleNodeClick}
    />
  )
}
