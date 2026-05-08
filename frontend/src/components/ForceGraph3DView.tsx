'use client'

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import * as THREE from 'three'
import type { GraphNode, GraphEdge } from '@/lib/api'

export type ForceGraphNode = GraphNode & { x?: number; y?: number; z?: number }

export function makeNodeMaterial(color: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.5,
    roughness: 0.15,
    metalness: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  })
}

const ForceGraph3D: any = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-zinc-500 animate-pulse">Loading 3D graph engine...</div>
    </div>
  ),
})

interface FgRef {
  scene: () => THREE.Scene | null
  cameraPosition: (pos: { x: number; y: number; z: number }, lookAt: { x: number; y: number; z: number }, ms: number) => void
}

interface ForceGraph3DViewProps {
  graphData: { nodes: GraphNode[]; links: GraphEdge[] } | null
  isLoading: boolean
  error: Error | null
  headerSlot?: ReactNode
  detailPaneSlot?: ReactNode
  legendSlot?: ReactNode
  placeholderSlot?: ReactNode
  nodeObjectFn?: (node: ForceGraphNode) => THREE.Object3D
  nodeLabelFn?: (node: ForceGraphNode) => string
  onNodeClick?: (node: ForceGraphNode) => void
  selectedNodeId?: string | null
  dataTestId?: string
}

export default function ForceGraph3DView({
  graphData,
  isLoading,
  error,
  headerSlot,
  detailPaneSlot,
  legendSlot,
  placeholderSlot,
  nodeObjectFn,
  nodeLabelFn,
  onNodeClick,
  selectedNodeId,
  dataTestId,
}: ForceGraph3DViewProps) {
  const fgRef = useRef<FgRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [sceneReady, setSceneReady] = useState(false)
  const selectedNodeIdRef = useRef(selectedNodeId)
  selectedNodeIdRef.current = selectedNodeId

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect()
      setDimensions({ width, height })
    }

    updateSize()

    const resizeObserver = new ResizeObserver(() => updateSize())
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!fgRef.current || sceneReady) return
    const scene = fgRef.current.scene()
    if (!scene) return

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    const pointLight1 = new THREE.PointLight(0xffffff, 1.5, 300)
    pointLight1.position.set(50, 50, 50)
    scene.add(pointLight1)

    const pointLight2 = new THREE.PointLight(0xffffff, 1.0, 300)
    pointLight2.position.set(-50, -50, -50)
    scene.add(pointLight2)

    setSceneReady(true)
  }, [sceneReady])

  const nodePositionUpdate = useCallback((obj: THREE.Object3D, _coords: { x: number; y: number; z: number }, node: ForceGraphNode) => {
    const mesh = obj as THREE.Mesh
    const material = mesh.material as THREE.MeshPhysicalMaterial
    if (!material) return

    const sid = selectedNodeIdRef.current
    const isSelected = sid === node.id
    const hasSelection = !!sid

    const targetEmissiveIntensity = hasSelection
      ? (isSelected ? 0.8 : 0.08)
      : 0.5

    if (Math.abs(material.emissiveIntensity - targetEmissiveIntensity) > 0.01) {
      material.emissiveIntensity += (targetEmissiveIntensity - material.emissiveIntensity) * 0.1
    } else {
      material.emissiveIntensity = targetEmissiveIntensity
    }
  }, [])

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    onNodeClick?.(node)
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      const dist = 45
      fgRef.current.cameraPosition(
        { x: node.x + dist * 0.6, y: node.y + dist * 0.6, z: (node.z ?? 0) + dist },
        { x: node.x, y: node.y, z: node.z ?? 0 },
        2000,
      )
    }
  }, [onNodeClick])

  const showLoading = isLoading
  const hasData = graphData && graphData.nodes.length > 0
  const showPlaceholder = !showLoading && !error && !graphData
  const showEmpty = !showLoading && !error && graphData && graphData.nodes.length === 0

  return (
    <div className="h-[calc(100vh-48px)] bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {headerSlot}

      <div className="flex-1 relative overflow-hidden">
        {showLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 z-10">
            <div className="text-zinc-400">Loading data...</div>
          </div>
        )}

        {error && !showLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-400 text-center max-w-md">
              <p className="font-medium">Error</p>
              <p className="text-sm mt-1">{error.message}</p>
            </div>
          </div>
        )}

        {showEmpty && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-zinc-400 text-center">
              <p>No connections found.</p>
              <p className="text-sm mt-1">Try lowering the similarity threshold or adjusting filters.</p>
            </div>
          </div>
        )}

        {showPlaceholder && (
          <div className="absolute inset-0 flex items-center justify-center">
            {placeholderSlot}
          </div>
        )}

        <div ref={containerRef} data-testid={dataTestId || 'graph-container'} className="w-full h-full">
          <ForceGraph3D
            ref={fgRef}
            graphData={hasData ? graphData! : { nodes: [], links: [] }}
            nodeId="id"
            nodeLabel={nodeLabelFn}
            nodeThreeObject={nodeObjectFn}
            nodePositionUpdate={nodePositionUpdate}
            backgroundColor="#09090b"
            onNodeClick={handleNodeClick}
            enableNodeDrag={false}
            nodeResolution={12}
            showNavInfo={true}
            width={dimensions.width}
            height={dimensions.height}
          />
        </div>

        {detailPaneSlot}
        {legendSlot}
      </div>
    </div>
  )
}
