'use client'

import { Star } from 'lucide-react'

interface FavoriteButtonProps {
  noteId: string
  isFavorite: boolean
  onToggle: (noteId: string) => void
  className?: string
}

export function FavoriteButton({ noteId, isFavorite, onToggle, className = '' }: FavoriteButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle(noteId)
      }}
      className={`transition-all duration-200 ${className}`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isFavorite ? (
        <Star className="w-5 h-5 text-yellow-400" fill="currentColor" strokeWidth={1.5} />
      ) : (
        <Star className="w-5 h-5 text-zinc-500 hover:text-yellow-400" strokeWidth={1.5} />
      )}
    </button>
  )
}
