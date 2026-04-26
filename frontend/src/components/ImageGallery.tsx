'use client'

import { useState, useEffect, useCallback } from 'react'
import { Images, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageGalleryProps {
  images: { src: string; alt?: string }[]
  getImageUrl: (src: string) => string
  externalOpen?: boolean
  externalIndex?: number
  onOpenChange?: (isOpen: boolean) => void
  onIndexChange?: (index: number) => void
}

export function ImageGallery({
  images,
  getImageUrl,
  externalOpen,
  externalIndex,
  onOpenChange,
  onIndexChange
}: ImageGalleryProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [internalIndex, setInternalIndex] = useState(0)

  // Use external state if provided, otherwise use internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalIsOpen
  const currentIndex = externalIndex !== undefined ? externalIndex : internalIndex

  const open = useCallback((index: number) => {
    if (externalIndex === undefined) {
      setInternalIndex(index)
    } else if (onIndexChange) {
      onIndexChange(index)
    }
    if (externalOpen === undefined) {
      setInternalIsOpen(true)
    } else if (onOpenChange) {
      onOpenChange(true)
    }
  }, [externalOpen, externalIndex, onOpenChange, onIndexChange])

  const close = useCallback(() => {
    if (externalOpen === undefined) {
      setInternalIsOpen(false)
    } else if (onOpenChange) {
      onOpenChange(false)
    }
  }, [externalOpen, onOpenChange])

  const goNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % images.length
    if (externalIndex === undefined) {
      setInternalIndex(nextIndex)
    } else if (onIndexChange) {
      onIndexChange(nextIndex)
    }
  }, [currentIndex, images.length, externalIndex, onIndexChange])

  const goPrev = useCallback(() => {
    const prevIndex = (currentIndex - 1 + images.length) % images.length
    if (externalIndex === undefined) {
      setInternalIndex(prevIndex)
    } else if (onIndexChange) {
      onIndexChange(prevIndex)
    }
  }, [currentIndex, images.length, externalIndex, onIndexChange])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          close()
          break
        case 'ArrowRight':
          goNext()
          break
        case 'ArrowLeft':
          goPrev()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, close, goNext, goPrev])

  if (images.length === 0) return null

  const current = images[currentIndex]

  return (
    <>
      {images.length > 1 && (
        <button
          onClick={() => open(0)}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          <Images className="w-4 h-4" strokeWidth={2} />
          View all {images.length} images
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={close}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getImageUrl(current.src)}
              alt={current.alt || `Image ${currentIndex + 1}`}
              loading="eager"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />

            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="text-sm text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded">
                {currentIndex + 1} / {images.length}
              </span>
              <button
                onClick={close}
                className="p-2 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goPrev() }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" strokeWidth={2} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goNext() }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-6 h-6" strokeWidth={2} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
