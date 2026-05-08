'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as THREE from 'three'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { type GraphNode } from '@/lib/api'
import type { ForceGraphNode } from '@/components/ForceGraph3DView'
import ForceGraph3DView, { makeNodeMaterial } from '@/components/ForceGraph3DView'
import DetailPane from '@/components/DetailPane'
import FilterChip from '@/components/FilterChip'
import { tagKeys, graphKeys, graphApi } from '@/lib/queries'
import { STRUCTURAL_TAGS } from '@/lib/constants'
import { TagAutocomplete } from '@/components/TagAutocomplete'

const GOLDEN_ANGLE = 137.508

const SHAPES = ['sphere', 'box', 'octahedron', 'dodecahedron', 'icosahedron', 'torus', 'cone', 'tetrahedron'] as const

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

function FilterSection({
  title,
  count,
  collapsed,
  onToggleCollapse,
  children,
  hasExclusions,
  onReset,
  dataTestId,
}: {
  title: string
  count: number
  collapsed: boolean
  onToggleCollapse: () => void
  children: React.ReactNode
  hasExclusions: boolean
  onReset: () => void
  dataTestId: string
}) {
  return (
    <div data-testid={dataTestId}>
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-300 hover:text-zinc-100 transition-colors"
          data-testid={`${dataTestId}-heading`}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          {title}
          <span className="text-zinc-600 font-normal normal-case tracking-normal">({count})</span>
        </button>
        {hasExclusions && (
          <button
            onClick={onReset}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Unselect all
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="flex flex-wrap gap-1.5">
          {children}
        </div>
      )}
    </div>
  )
}

function createGlowSprite(color: string): THREE.Sprite {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
  // Very tight, subtle glow core
  gradient.addColorStop(0, color + '40')
  gradient.addColorStop(0.4, color + '10')
  gradient.addColorStop(1, 'transparent')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    opacity: 0.4,
  })
  const sprite = new THREE.Sprite(spriteMaterial)
  sprite.scale.set(10, 10, 1)
  return sprite
}

function ageColor(t: number): THREE.Color {
  // Aggressive non-linear mapping to spread the clustered data
  // 75% of notes are below t=0.4; this stretches them across the full spectrum
  const adjustedT = Math.pow(Math.max(0, Math.min(1, t)), 0.25)
  const oldColor = new THREE.Color('#ff1a1a')  // pure saturated red
  const newColor = new THREE.Color('#1a66ff')  // saturated blue
  return oldColor.clone().lerp(newColor, adjustedT)
}

function createNodeObject(node: GraphNode, tagStyles: Record<string, TagStyle>, minTs: number, maxTs: number): THREE.Object3D {
  const primaryTag = getPrimaryTag(node.tags ?? [])
  const style = primaryTag && tagStyles[primaryTag]
    ? tagStyles[primaryTag]
    : { color: '#6b7280', shape: 'sphere' as const }

  const radius = 8
  const geometry = makeGeometry(style.shape, radius)

  let displayColor = new THREE.Color(style.color)
  if (node.created && minTs < maxTs) {
    const ts = new Date(node.created).getTime()
    if (!Number.isNaN(ts)) {
      const t = Math.max(0, Math.min(1, (ts - minTs) / (maxTs - minTs)))
      displayColor = ageColor(t)
    }
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: displayColor,
    emissive: displayColor,
    emissiveIntensity: 0.3,
    roughness: 0.5,
    metalness: 0.05,
    clearcoat: 0.1,
    clearcoatRoughness: 0.3,
  })

  const mesh = new THREE.Mesh(geometry, material)
  const group = new THREE.Group()
  group.add(mesh)
  const glow = createGlowSprite('#' + displayColor.getHexString().padStart(6, '0'))
  group.add(glow)
  return group
}

export default function GraphPage() {
  const [viewingNode, setViewingNode] = useState<GraphNode | null>(null)
  const [selectedTag, setSelectedTag] = useState('')
  const [threshold, setThreshold] = useState(0.75)
  const [excludedSources, setExcludedSources] = useState<Set<string>>(new Set())
  const [excludedStructTags, setExcludedStructTags] = useState<Set<string>>(new Set())
  const [excludedContentTags, setExcludedContentTags] = useState<Set<string>>(new Set())
  const [sourcesCollapsed, setSourcesCollapsed] = useState(true)
  const [structTagsCollapsed, setStructTagsCollapsed] = useState(true)
  const [contentTagsCollapsed, setContentTagsCollapsed] = useState(true)
  const hasLoaded = useRef(false)

  const { data: tagsData } = useQuery({
    queryKey: tagKeys.list,
    queryFn: graphApi.tags,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: graphKeys.all(selectedTag || undefined, threshold),
    queryFn: () => graphApi.get(selectedTag || undefined, threshold),
  })

  const sourcesInData = useMemo(() => {
    if (!data) return [] as string[]
    const sourceSet = new Set<string>()
    for (const node of data.nodes) {
      if (node.source) sourceSet.add(node.source)
    }
    return Array.from(sourceSet).sort()
  }, [data])

  const structuralTagsInData = useMemo(() => {
    if (!data) return [] as string[]
    const tagSet = new Set<string>()
    for (const node of data.nodes) {
      for (const tag of node.tags ?? []) {
        if (STRUCTURAL_TAGS.includes(tag)) tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  }, [data])

  const contentTagsInData = useMemo(() => {
    if (!data) return [] as string[]
    const tagSet = new Set<string>()
    for (const node of data.nodes) {
      for (const tag of node.tags ?? []) {
        if (!STRUCTURAL_TAGS.includes(tag)) tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  }, [data])

  const graphData = useMemo(() => {
    if (!data) return null
    if (excludedSources.size === 0 && excludedStructTags.size === 0 && excludedContentTags.size === 0) {
      return { nodes: data.nodes, links: data.edges.map(e => ({ ...e })) }
    }
    const excludedIds = new Set<string>()
    for (const node of data.nodes) {
      if (node.source && excludedSources.has(node.source)) {
        excludedIds.add(node.id)
        continue
      }
      for (const tag of node.tags ?? []) {
        if (excludedStructTags.has(tag) || excludedContentTags.has(tag)) {
          excludedIds.add(node.id)
          break
        }
      }
    }
    const filteredNodes = data.nodes.filter(n => !excludedIds.has(n.id))
    const filteredEdges = data.edges.filter(e => !excludedIds.has(e.source) && !excludedIds.has(e.target))
    return { nodes: filteredNodes, links: filteredEdges.map(e => ({ ...e })) }
  }, [data, excludedSources, excludedStructTags, excludedContentTags])

  const tagStyles = useMemo(() => {
    if (!graphData) return {}
    const primaryTags = graphData.nodes.map(n => getPrimaryTag(n.tags ?? [])).filter((t): t is string => Boolean(t))
    return assignTagStyles(primaryTags)
  }, [graphData])

  const { minCreated, maxCreated } = useMemo(() => {
    if (!graphData) return { minCreated: 0, maxCreated: 0 }
    let min = Infinity
    let max = -Infinity
    for (const node of graphData.nodes) {
      if (!node.created) continue
      const ts = new Date(node.created).getTime()
      if (Number.isNaN(ts)) continue
      if (ts < min) min = ts
      if (ts > max) max = ts
    }
    return { minCreated: min === Infinity ? 0 : min, maxCreated: max === -Infinity ? 0 : max }
  }, [graphData])

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    if (!node) return
    setViewingNode(node)
  }, [])

  useEffect(() => {
    if (graphData && graphData.nodes.length > 0 && !hasLoaded.current) {
      hasLoaded.current = true
    }
  }, [graphData])

  const headerSlot = (
    <div className="bg-zinc-950 border-b border-zinc-800">
      <div className="px-4 pt-3 pb-2 flex items-center gap-4 flex-wrap">
        <h1 className="text-lg font-semibold text-zinc-100">Similarity Graph</h1>
        <span className="text-xs text-zinc-500 w-36 shrink-0 inline-block tabular-nums" data-testid="graph-stats">
          {graphData ? `${graphData.nodes.length} nodes · ${graphData.links.length} edges` : '\u00A0'}
        </span>
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
      <div className="px-4 pb-3 space-y-2.5" data-testid="filter-panel">
        {sourcesInData.length > 0 && (
          <FilterSection
            title="Sources"
            count={sourcesInData.length}
            collapsed={sourcesCollapsed}
            onToggleCollapse={() => setSourcesCollapsed(c => !c)}
            hasExclusions={excludedSources.size > 0}
            onReset={() => { setExcludedSources(new Set()); setViewingNode(null) }}
            dataTestId="filter-sources"
          >
            {sourcesInData.map(source => (
              <FilterChip
                key={source}
                label={source}
                isExcluded={excludedSources.has(source)}
                onToggle={() => {
                  setExcludedSources(prev => {
                    const next = new Set(prev)
                    if (next.has(source)) next.delete(source)
                    else next.add(source)
                    return next
                  })
                  setViewingNode(null)
                }}
                onKeepOnly={() => { setExcludedSources(new Set(sourcesInData.filter(s => s !== source))); setViewingNode(null) }}
                testId={`source-filter-${source}`}
                keepTestId={`source-filter-keep-${source}`}
              />
            ))}
          </FilterSection>
        )}
        {structuralTagsInData.length > 0 && (
          <FilterSection
            title="Structural Tags"
            count={structuralTagsInData.length}
            collapsed={structTagsCollapsed}
            onToggleCollapse={() => setStructTagsCollapsed(c => !c)}
            hasExclusions={excludedStructTags.size > 0}
            onReset={() => { setExcludedStructTags(new Set()); setViewingNode(null) }}
            dataTestId="filter-structural-tags"
          >
            {structuralTagsInData.map(tag => (
              <FilterChip
                key={tag}
                label={tag}
                isExcluded={excludedStructTags.has(tag)}
                onToggle={() => {
                  setExcludedStructTags(prev => {
                    const next = new Set(prev)
                    if (next.has(tag)) next.delete(tag)
                    else next.add(tag)
                    return next
                  })
                  setViewingNode(null)
                }}
                onKeepOnly={() => { setExcludedStructTags(new Set(structuralTagsInData.filter(t => t !== tag))); setViewingNode(null) }}
                baseClass="bg-purple-500/10 text-purple-400 border-purple-500/20"
                testId={`structural-tag-filter-${tag}`}
                keepTestId={`structural-tag-filter-keep-${tag}`}
              />
            ))}
          </FilterSection>
        )}
        {contentTagsInData.length > 0 && (
          <FilterSection
            title="Tags"
            count={contentTagsInData.length}
            collapsed={contentTagsCollapsed}
            onToggleCollapse={() => setContentTagsCollapsed(c => !c)}
            hasExclusions={excludedContentTags.size > 0}
            onReset={() => { setExcludedContentTags(new Set()); setViewingNode(null) }}
            dataTestId="filter-tags"
          >
            {contentTagsInData.map(tag => {
              const style = tagStyles[tag] ?? { color: '#6b7280', shape: 'sphere' as const }
              const isExcluded = excludedContentTags.has(tag)
              return (
                <FilterChip
                  key={tag}
                  label={tag}
                  isExcluded={isExcluded}
                  onToggle={() => {
                    setExcludedContentTags(prev => {
                      const next = new Set(prev)
                      if (next.has(tag)) next.delete(tag)
                      else next.add(tag)
                      return next
                    })
                    setViewingNode(null)
                  }}
                  onKeepOnly={() => { setExcludedContentTags(new Set(contentTagsInData.filter(t => t !== tag))); setViewingNode(null) }}
                  icon={<ShapeIndicator shape={style.shape} color={isExcluded ? '#52525b' : style.color} />}
                  style={!isExcluded ? { color: style.color, backgroundColor: `${style.color}15`, borderColor: `${style.color}30` } : undefined}
                  testId={`content-tag-filter-${tag}`}
                  keepTestId={`content-tag-filter-keep-${tag}`}
                />
              )
            })}
            <button className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-default">
              <ShapeIndicator shape="sphere" color="#6b7280" />
              Other
            </button>
          </FilterSection>
        )}
      </div>
    </div>
  )

  return (
    <div className={hasLoaded.current ? 'animate-scale-in' : ''}>
      <ForceGraph3DView
        graphData={graphData}
        isLoading={isLoading}
        error={error}
        headerSlot={headerSlot}
        detailPaneSlot={<DetailPane node={viewingNode} />}
        nodeObjectFn={(node) => createNodeObject(node, tagStyles, minCreated, maxCreated)}
        nodeLabelFn={(node) => node.title}
        onNodeClick={handleNodeClick}
        selectedNodeId={viewingNode?.id ?? null}
      />
    </div>
  )
}
