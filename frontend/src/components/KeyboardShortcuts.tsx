'use client'

import { useEffect, useCallback } from 'react'

interface KeyboardShortcutsProps {
  onSearchFocus?: () => void
  onEscape?: () => void
}

export function KeyboardShortcuts({ onSearchFocus, onEscape }: KeyboardShortcutsProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey

    if (isMod && e.key === 'k') {
      e.preventDefault()
      onSearchFocus?.()

      const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]')
      if (searchInput) {
        searchInput.focus()
        return
      }

      const heroSearch = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')
      if (heroSearch) {
        heroSearch.focus()
      }
    }

    if (e.key === 'Escape') {
      const activeEl = document.activeElement as HTMLElement
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        activeEl.blur()
      }
      onEscape?.()

      const openDropdown = document.querySelector('[data-autocomplete-open="true"]')
      if (openDropdown) {
        return
      }
    }
  }, [onSearchFocus, onEscape])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return null
}