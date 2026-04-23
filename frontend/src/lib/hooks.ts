'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)

  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay)
    },
    [delay]
  ) as T
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): AsyncState<T> & { refetch: () => void; setData: (data: T) => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const cancelledRef = useRef(false);

  const execute = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    cancelledRef.current = false;
    try {
      const result = await fetcher();
      if (!cancelledRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setState({ data: null, loading: false, error: err instanceof Error ? err : new Error(String(err)) });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, ...deps]);

  useEffect(() => {
    execute();
    return () => { cancelledRef.current = true; };
  }, [execute]);

  const setData = useCallback((data: T) => {
    setState({ data, loading: false, error: null });
  }, []);

  return { ...state, refetch: execute, setData };
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
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