'use client'

import { useLocalStorage } from '@/lib/hooks'

const STORAGE_KEY = 'notes-browser-favorites'

function getFavoritesSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

function saveFavorites(favs: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]))
  } catch {}
}

export function getFavorites(): string[] {
  return [...getFavoritesSet()]
}

export function isFavorite(noteId: string): boolean {
  return getFavoritesSet().has(noteId)
}

export function toggleFavorite(noteId: string): boolean {
  const favs = getFavoritesSet()
  if (favs.has(noteId)) {
    favs.delete(noteId)
  } else {
    favs.add(noteId)
  }
  saveFavorites(favs)
  return favs.has(noteId)
}

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>(STORAGE_KEY, [])

  const isFav = (noteId: string) => favorites.includes(noteId)

  const toggle = (noteId: string) => {
    setFavorites(prev => {
      if (prev.includes(noteId)) {
        return prev.filter(id => id !== noteId)
      }
      return [...prev, noteId]
    })
  }

  return { favorites, isFav, toggle }
}