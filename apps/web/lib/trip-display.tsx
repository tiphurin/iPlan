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

/**
 * The zone every time is shown in: the switch reads "KR | TH", so KR shows the
 * whole plan in the destination's time (even items still at home) and TH all in
 * home time. Trips without an away zone keep each item's own zone.
 */
export function shownZone(
  mode: TripDisplay['time'],
  itemZone: string,
  zones: { home: string; away: string | null },
): string {
  return mode === 'home' ? zones.home : (zones.away ?? itemZone)
}

/** The other clock shown small next to it (home when showing local, and back). */
export function otherZone(
  mode: TripDisplay['time'],
  itemZone: string,
  zones: { home: string; away: string | null },
): string {
  return mode === 'home' ? (zones.away ?? itemZone) : zones.home
}

const Ctx = createContext<{
  display: TripDisplay
  setDisplay: (change: Partial<TripDisplay>) => void
  /** Zone to show a time in, given the item's own zone. */
  zoneFor: (itemZone: string) => string
  /** The second, smaller clock. */
  otherZoneFor: (itemZone: string) => string
}>({
  display: DEFAULT,
  setDisplay: () => undefined,
  zoneFor: (z) => z,
  otherZoneFor: (z) => z,
})

export function TripDisplayProvider({
  tripId,
  home,
  away,
  children,
}: {
  tripId: string
  home: string
  /** The trip's destination zone (most used non-home item zone), if any. */
  away: string | null
  children: ReactNode
}) {
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
  const value = useMemo(
    () => ({
      display,
      setDisplay,
      zoneFor: (z: string) => shownZone(display.time, z, { home, away }),
      otherZoneFor: (z: string) => otherZone(display.time, z, { home, away }),
    }),
    [display, setDisplay, home, away],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTripDisplay() {
  return useContext(Ctx)
}
