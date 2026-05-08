'use client'

import { format, parseISO, isValid } from 'date-fns'
import { type GraphNode } from '@/lib/api'
import Link from 'next/link'

interface DetailPaneProps {
  node: GraphNode | null
  nodeColorMap?: Record<string, string>
  testId?: string
}

export default function DetailPane({ node, nodeColorMap, testId }: DetailPaneProps) {
  return (
    <div
      className={`absolute bottom-4 right-4 bg-zinc-900 border border-zinc-700 rounded-lg p-3 max-w-xs z-20 shadow-lg transition-opacity duration-300 ${
        node ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      data-testid={testId || 'graph-details-pane'}
    >
      {node && (
        <>
          <Link
            href={`/notes/${node.id}`}
            className="font-medium text-zinc-100 truncate hover:text-blue-400 transition-colors block mb-0.5"
          >
            {node.title}
          </Link>
          {node.created && (
            <div className="text-xs text-zinc-500 mb-1">{(() => {
              const d = parseISO(node.created)
              return isValid(d) ? format(d, 'MMM d, yyyy') : node.created
            })()}</div>
          )}
          <div className="text-xs text-zinc-400">{node.folder} · {node.source}</div>
          {node.search_score !== undefined && nodeColorMap && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: nodeColorMap[node.id] || '#6b7280' }}
              />
              <span className="text-xs text-zinc-300">
                Relevance: {(node.search_score * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {node.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {node.tags.slice(0, 5).map(t => (
                <span key={t} className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">{t}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
