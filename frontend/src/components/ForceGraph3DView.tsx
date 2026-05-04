'use client'

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import * as THREE from 'three'
import type { GraphNode, GraphEdge } from '@/lib/api'

export type ForceGraphNode = GraphNode & { x?: number; y?: number; z?: number }

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-zinc-500 animate-pulse">Loading 3D graph engine...</div>
    </div>
  ),
})

interface ForceGraph3DRef {
  scene: () => THREE.Scene | null;
  cameraPosition: (camera: { x: number; y: number; z: number }, lookAt: { x: number; y: number; z: number }, duration: number) => void;
}

interface ForceGraph3DViewProps {
  graphData: { nodes: GraphNode[]; links: GraphEdge[] } | null
  isLoading: boolean
  error: Error | null
  headerSlot?: ReactNode
  detailPaneSlot?: ReactNode
  legendSlot?: ReactNode
  nodeObjectFn?: (node: ForceGraphNode) => THREE.Object3D
  nodePositionUpdateFn?: (obj: THREE.Object3D, coords: { x: number; y: number; z: number }, node: ForceGraphNode) => void
  nodeLabelFn?: (node: ForceGraphNode) => string
  onNodeClick?: (node: ForceGraphNode) => void
  dataTestId?: string
}

export default function ForceGraph3DView({
  graphData,
  isLoading,
  error,
  headerSlot,
  detailPaneSlot,
  legendSlot,
  nodeObjectFn,
  nodePositionUpdateFn,
  nodeLabelFn,
  onNodeClick,
  dataTestId,
}: ForceGraph3DViewProps) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [sceneReady, setSceneReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
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
      window.addEventListener('resize', updateSize)
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect()
      else window.removeEventListener('resize', updateSize)
    }
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
  }, [graphData, sceneReady])

  const showLoading = isLoading
  const hasData = graphData && graphData.nodes.length > 0
  const showEmpty = !showLoading && !error && graphData && graphData.nodes.length === 0

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    // set highlight state before starting camera animation to avoid stale
    // animation-completion callbacks reverting to the previously-selected node
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

        <div ref={containerRef} data-testid={dataTestId || 'graph-container'} className="w-full h-full">
          {hasData && (
            <ForceGraph3D
              ref={fgRef}
              graphData={graphData!}
              nodeId="id"
              nodeLabel={nodeLabelFn as ((node: object) => string) | undefined}
              nodeThreeObject={nodeObjectFn as ((node: object) => THREE.Object3D) | undefined}
              nodePositionUpdate={nodePositionUpdateFn as any}
              backgroundColor="#09090b"
              onNodeClick={handleNodeClick as any}
              enableNodeDrag={false}
              nodeResolution={12}
              showNavInfo={true}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
        </div>

        {detailPaneSlot}
        {legendSlot}
      </div>
    </div>
  )
}
