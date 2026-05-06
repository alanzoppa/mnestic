'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Star } from 'lucide-react'

interface FavoriteButtonProps {
  noteId: string
  isFavorite: boolean
  onToggle: (noteId: string) => void
  className?: string
}

const PARTICLE_COUNT = 5

export function FavoriteButton({ noteId, isFavorite, onToggle, className = '' }: FavoriteButtonProps) {
  const prefersReducedMotion = useReducedMotion()
  const [bursting, setBursting] = useState(false)
  const burstTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (burstTimeout.current) clearTimeout(burstTimeout.current)
    }
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!bursting) {
        setBursting(true)
        if (burstTimeout.current) clearTimeout(burstTimeout.current)
        burstTimeout.current = setTimeout(() => setBursting(false), 400)
      }
      onToggle(noteId)
    },
    [bursting, noteId, onToggle]
  )

  const springConfig = { stiffness: 300, damping: 10 }

  return (
    <button
      onClick={handleClick}
      className={`relative transition-all duration-200 ${className}`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      {bursting && !prefersReducedMotion && (
        <span className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
            const angle = (i / PARTICLE_COUNT) * 360
            const delay = i * 0.02
            return (
              <span
                key={i}
                className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-yellow-400"
                style={{
                  animation: `particle-burst 0.4s ease-out ${delay}s forwards`,
                  ['--angle' as string]: `${angle}deg`,
                }}
              />
            )
          })}
        </span>
      )}

      <motion.span
        animate={prefersReducedMotion ? undefined : isFavorite ? 'filled' : 'empty'}
        variants={
          prefersReducedMotion
            ? undefined
            : {
                filled: { scale: [1, 1.3, 1], transition: { ...springConfig } },
                empty: { scale: 1, transition: { duration: 0.15 } },
              }
        }
        style={{ display: 'inline-flex' }}
      >
        {isFavorite ? (
          <Star className="w-5 h-5 text-yellow-400" fill="currentColor" strokeWidth={1.5} />
        ) : (
          <Star className="w-5 h-5 text-zinc-500 hover:text-yellow-400" strokeWidth={1.5} />
        )}
      </motion.span>

      <style>{`
        @keyframes particle-burst {
          0% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(16px) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </button>
  )
}
