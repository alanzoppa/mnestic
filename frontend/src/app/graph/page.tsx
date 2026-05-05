'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as THREE from 'three'
import { format, parseISO, isValid } from 'date-fns'
import { type GraphNode } from '@/lib/api'
import type { ForceGraphNode } from '@/components/ForceGraph3DView'
import { tagKeys, graphKeys, graphApi } from '@/lib/queries'
import { STRUCTURAL_TAGS } from '@/lib/constants'
import { TagAutocomplete } from '@/components/TagAutocomplete'
import ForceGraph3DView from '@/components/ForceGraph3DView'
import Link from 'next/link'

const GOLDEN_ANGLE = 137.508

function getPrimaryTag(tags: string[]): string | undefined {
  return tags.find(t => !STRUCTURAL_TAGS.includes(t))
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

type TagStyle = { color: string; shape: string }

const SHAPES = ['sphere', 'box', 'octahedron', 'dodecahedron', 'icosahedron', 'torus', 'cone', 'tetrahedron'] as const

function assignTagStyles(tags: string[]): Record<string, TagStyle> {
  const sorted = [...new Set(tags)].sort()
  const styles: Record<string, TagStyle> = {}
  sorted.forEach((tag, index) => {
    const hue = (index * GOLDEN_ANGLE) % 360
    styles[tag] = {
      color: hslToHex(hue, 0.72, 0.58),
      shape: SHAPES[index % SHAPES.length]!,
    }
  })
  return styles
}

function makeGeometry(shape: string, radius: number): THREE.BufferGeometry {
  switch (shape) {
    case 'box': return new THREE.BoxGeometry(radius * 1.6, radius * 1.6, radius * 1.6)
    case 'octahedron': return new THREE.OctahedronGeometry(radius)
    case 'dodecahedron': return new THREE.DodecahedronGeometry(radius)
    case 'icosahedron': return new THREE.IcosahedronGeometry(radius)
    case 'torus': return new THREE.TorusGeometry(radius * 0.7, radius * 0.3, 16, 32)
    case 'cone': return new THREE.ConeGeometry(radius * 0.8, radius * 1.8, 16)
    case 'tetrahedron': return new THREE.TetrahedronGeometry(radius)
    default: return new THREE.SphereGeometry(radius, 24, 24)
  }
}

function ShapeIndicator({ shape, color }: { shape: string; color: string }) {
  const size = 14
  const half = size / 2
  const svgProps = { width: size, height: size, viewBox: `${-half} ${-half} ${size} ${size}` }
  const fill = color

  switch (shape) {
    case 'box':
      return <svg {...svgProps}><rect x={-4} y={-4} width={8} height={8} fill={fill} /></svg>
    case 'octahedron':
      return <svg {...svgProps}><polygon points="0,-6 5,0 0,6 -5,0" fill={fill} /></svg>
    case 'dodecahedron':
      return <svg {...svgProps}><polygon points="0,-6 5.7,-1.85 3.53,4.85 -3.53,4.85 -5.7,-1.85" fill={fill} /></svg>
    case 'icosahedron':
      return <svg {...svgProps}><polygon points="0,-6 5.71,-1.85 3.53,4.85 -3.53,4.85 -5.71,-1.85" fill={fill} stroke={fill} strokeWidth={1.5} /><line x1={0} y1={-6} x2={3.53} y2={4.85} stroke="rgba(0,0,0,0.25)" strokeWidth={0.75} /><line x1={-5.71} y1={-1.85} x2={5.71} y2={-1.85} stroke="rgba(0,0,0,0.25)" strokeWidth={0.75} /></svg>
    case 'torus':
      return <svg {...svgProps}><ellipse cx={0} cy={0} rx={5} ry={3} fill="none" stroke={fill} strokeWidth={2.5} /></svg>
    case 'cone':
      return <svg {...svgProps}><polygon points="0,-6 5,5 -5,5" fill={fill} /></svg>
    case 'tetrahedron':
      return <svg {...svgProps}><polygon points="0,-6 5.5,4 -5.5,4" fill={fill} /></svg>
    default:
      return <svg {...svgProps}><circle cx={0} cy={0} r={5} fill={fill} /></svg>
  }
}

function getNodeStyle(node: GraphNode, tagStyles: Record<string, TagStyle>): TagStyle {
  const primaryTag = getPrimaryTag(node.tags ?? [])
  return primaryTag && tagStyles[primaryTag]
    ? tagStyles[primaryTag]
    : { color: '#6b7280', shape: 'sphere' }
}

function createNodeObject(node: GraphNode, tagStyles: Record<string, TagStyle>): THREE.Object3D {
  const { color, shape } = getNodeStyle(node, tagStyles)
  const radius = 8
  const geometry = makeGeometry(shape, radius)
  const material = new THREE.MeshPhysicalMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.5,
    roughness: 0.15,
    metalness: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: false,
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

  const tagStyles = useMemo(() => {
    if (!data) return {}
    const primaryTags = data.nodes.map(n => getPrimaryTag(n.tags ?? [])).filter((t): t is string => Boolean(t))
    return assignTagStyles(primaryTags)
  }, [data])

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
    const material = mesh.material as THREE.MeshPhysicalMaterial
    if (!material) return

    const isSelected = selectedNodeIdRef.current === node.id
    const hasSelection = selectedNodeIdRef.current !== null

    const targetEmissiveIntensity = hasSelection
      ? (isSelected ? 0.8 : 0.08)
      : 0.5

    if (Math.abs(material.emissiveIntensity - targetEmissiveIntensity) > 0.01) {
      material.emissiveIntensity += (targetEmissiveIntensity - material.emissiveIntensity) * 0.1
    } else {
      material.emissiveIntensity = targetEmissiveIntensity
    }
  }, [tagStyles])

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
        <label htmlFor="similarity-range" className="text-sm text-zinc-400">Similarity:</label>
        <input
          id="similarity-range"
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
      {Object.entries(tagStyles).map(([tag, style]) => (
        <div key={tag} className="flex items-center gap-2 text-xs text-zinc-400 mb-1 cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => { setSelectedTag(tag); setViewingNode(null) }}>
          <ShapeIndicator shape={style.shape} color={style.color} />
          {tag}
        </div>
      ))}
      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
        <ShapeIndicator shape="sphere" color="#6b7280" />
        Other
      </div>
      {data && (
        <>
          <div className="mt-2 pt-2 border-t border-zinc-700 text-xs text-zinc-500" data-testid="graph-stats">
            {data.nodes.length} nodes · {data.edges.length} edges
          </div>
        </>
      )}
    </div>
  )

  return (
    <ForceGraph3DView
      graphData={graphData}
      isLoading={isLoading}
      error={error}
      headerSlot={headerSlot}
      detailPaneSlot={detailPaneSlot}
      legendSlot={legendSlot}
      nodeObjectFn={(node) => createNodeObject(node, tagStyles)}
      nodePositionUpdateFn={nodePositionUpdate}
      nodeLabelFn={(node) => node.title}
      onNodeClick={handleNodeClick}
    />
  )
}
