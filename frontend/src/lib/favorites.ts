'use client'
import { useLocalStorage } from '@/lib/hooks'

const STORAGE_KEY = 'notes-browser-favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>(STORAGE_KEY, [])
  const isFav = (noteId: string) => favorites.includes(noteId)
  const toggle = (noteId: string) => {
    setFavorites(prev => {
      if (prev.includes(noteId)) return prev.filter(id => id !== noteId)
      return [...prev, noteId]
    })
  }
  return { favorites, isFav, toggle }
}
