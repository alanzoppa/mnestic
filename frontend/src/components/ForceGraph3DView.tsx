'use client'

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import * as THREE from 'three'

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false, loading: () => null })

interface ForceGraph3DViewProps {
  graphData: { nodes: any[]; links: any[] } | null
  isLoading: boolean
  error: Error | null
  headerSlot?: ReactNode
  detailPaneSlot?: ReactNode
  legendSlot?: ReactNode
  nodeObjectFn?: (node: any) => THREE.Object3D
  nodePositionUpdateFn?: (obj: THREE.Object3D, coords: { x: number; y: number; z: number }, node: any) => void
  nodeLabelFn?: (node: any) => string
  onNodeClick?: (node: any) => void
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

  const handleNodeClick = useCallback((node: any, event: any) => {
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      const dist = 45
      fgRef.current.cameraPosition(
        { x: node.x + dist * 0.6, y: node.y + dist * 0.6, z: node.z + dist },
        { x: node.x, y: node.y, z: node.z },
        800,
      )
    }
    onNodeClick?.(node)
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
              nodeLabel={nodeLabelFn || "title"}
              nodeThreeObject={nodeObjectFn}
              nodePositionUpdate={nodePositionUpdateFn}
              backgroundColor="#09090b"
              onNodeClick={handleNodeClick}
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
