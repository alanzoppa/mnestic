'use client'

import { useState, useCallback } from 'react'
import { useDebounce, useDebouncedCallback } from 'use-debounce'

export { useDebounce, useDebouncedCallback }

export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue] = useDebounce(value, delay)
  return debouncedValue
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      } catch {}
      return valueToStore
    })
  }, [key])

  return [storedValue, setValue]
}
