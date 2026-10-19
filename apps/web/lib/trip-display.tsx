'use client'

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react'

/** Show times in the place's zone or at home; money in the local currency or the trip's. */
export interface TripDisplay {
  time: 'local' | 'home'
  money: 'local' | 'base'
}

const DEFAULT: TripDisplay = { time: 'local', money: 'local' }

// Remembered per trip on this device; falls back to memory when storage is blocked.
const memory = new Map<string, string>()
const listeners = new Set<() => void>()

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

function write(key: string, value: string) {
  memory.set(key, value)
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: memory still holds it until reload.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const Ctx = createContext<{
  display: TripDisplay
  setDisplay: (change: Partial<TripDisplay>) => void
}>({ display: DEFAULT, setDisplay: () => undefined })

export function TripDisplayProvider({ tripId, children }: { tripId: string; children: ReactNode }) {
  const key = `iplan.display.${tripId}`
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  )
  const display = useMemo<TripDisplay>(() => {
    if (!raw) return DEFAULT
    try {
      return { ...DEFAULT, ...(JSON.parse(raw) as Partial<TripDisplay>) }
    } catch {
      return DEFAULT
    }
  }, [raw])
  const setDisplay = useCallback(
    (change: Partial<TripDisplay>) => write(key, JSON.stringify({ ...display, ...change })),
    [key, display],
  )
  return <Ctx.Provider value={{ display, setDisplay }}>{children}</Ctx.Provider>
}

export function useTripDisplay() {
  return useContext(Ctx)
}
