'use client'

function lerpColor(a: number[], b: number[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const r = Math.round(a[0] + (b[0] - a[0]) * clamped)
  const g = Math.round(a[1] + (b[1] - a[1]) * clamped)
  const bl = Math.round(a[2] + (b[2] - a[2]) * clamped)
  return `rgb(${r},${g},${bl})`
}

function embeddingColor(v: number): string {
  if (v < -1) v = -1
  if (v > 1) v = 1
  const neg = [180, 50, 60] // reddish
  const zero = [60, 60, 65] // neutral gray
  const pos = [50, 140, 210] // blueish
  if (v < 0) return lerpColor(neg, zero, v + 1)
  return lerpColor(zero, pos, v)
}

function diffColor(v: number): string {
  if (v < -1) v = -1
  if (v > 1) v = 1
  const neg = [200, 60, 55] // red
  const zero = [60, 60, 65] // neutral gray
  const pos = [60, 160, 80] // green
  if (v < 0) return lerpColor(neg, zero, v + 1)
  return lerpColor(zero, pos, v)
}

const GRID_SIZE = 16

interface Props {
  embedding: number[]
  compareEmbedding?: number[]
  size?: number
  label?: string
}

export function EmbeddingHeatmap({ embedding, compareEmbedding, size = 160, label }: Props) {
  const isDiff = compareEmbedding !== undefined && compareEmbedding.length === embedding.length
  const cellSize = size / GRID_SIZE
  const values = isDiff
    ? embedding.map((v, i) => v - compareEmbedding[i])
    : embedding

  return (
    <div className="space-y-1">
      {label && <div className="text-xs text-zinc-500">{label}</div>}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
          gap: 1,
          width: size + GRID_SIZE - 1,
          height: size + GRID_SIZE - 1,
        }}
      >
        {values.map((v, i) => {
          const color = isDiff ? diffColor(v) : embeddingColor(v)
          return (
            <div
              key={i}
              title={`dim ${i}: ${v.toFixed(4)}`}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
