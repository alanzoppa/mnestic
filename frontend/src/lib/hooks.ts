'use client'

import { useState, useCallback, useEffect } from 'react'
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

export function useCountUp(target: number, duration: number = 800): number {
  const [value, setValue] = useState(target)

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return target
  }

  useEffect(() => {
    let startTime: number | null = null
    let rafId: number | null = null

    const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutExpo(progress)
      setValue(Math.floor(eased * target))

      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [target, duration])

  return value
}
