'use client'

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`animate-pulse bg-zinc-800 rounded ${className}`} style={style} />
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-5 space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <SkeletonText lines={2} />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-18 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonNoteCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card-hover p-5 space-y-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <span className="text-zinc-600">·</span>
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="h-6 w-4/5" />
      <Skeleton className="h-4 w-36" />
      <SkeletonText lines={2} />
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-18 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="stat-card p-5">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

const CHART_BAR_HEIGHTS = [65, 42, 78, 55, 90, 35, 72, 48, 85, 38, 60, 50]

export function SkeletonChart({ height = 250 }: { height?: number }) {
  return (
    <div className="card p-6">
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${CHART_BAR_HEIGHTS[i]}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function SkeletonNoteDetail() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-20" />
      <div className="note-layout">
        <div className="note-main space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
          <div className="card p-6">
            <SkeletonText lines={12} />
          </div>
        </div>
        <div className="note-sidebar space-y-6">
          <div className="card p-4 space-y-3">
            <Skeleton className="h-5 w-28" />
            <SkeletonText lines={4} />
          </div>
          <div className="card p-4 space-y-3">
            <Skeleton className="h-5 w-28" />
            <SkeletonText lines={3} />
          </div>
        </div>
      </div>
    </div>
  )
}