'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Knows whether the previous entry in this tab's history is an iPlan screen, so
 * "back" can return to it (keeping its scroll) without ever leaving the app.
 *
 * Each history entry the app visits gets an id in `history.state`; we keep the
 * ids in order (in sessionStorage, so reloads keep them). Back/forward finds the
 * entry by id. Whenever we can't tell where we are, we start over, which only
 * makes "back" fall back to a normal link.
 */
interface Entry {
  id: string
  url: string
}
interface Trail {
  entries: Entry[]
  index: number
  /** `history.length` when we last looked; growth means a new entry was pushed. */
  length: number
}

const KEY = 'iplan.history'
const STATE_KEY = '__iplan'
let trail: Trail | null = null

const here = () => `${window.location.pathname}${window.location.search}`

function idOf(state: unknown): string | null {
  const id = (state as Record<string, unknown> | null)?.[STATE_KEY]
  return typeof id === 'string' ? id : null
}

/** Tags the current history entry (Next.js keeps its own keys; see its pushState patch). */
function stamp(id: string) {
  try {
    const state = (window.history.state as Record<string, unknown> | null) ?? {}
    window.history.replaceState({ ...state, [STATE_KEY]: id }, '')
  } catch {
    // Some browsers limit history updates; we just won't recognise this entry later.
  }
}

function save(next: Trail) {
  trail = next
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or blocked storage: the in-memory copy still works on this page.
  }
}

function load(): Trail | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Trail>) : null
    if (
      parsed &&
      Array.isArray(parsed.entries) &&
      parsed.entries.every((e) => typeof e?.id === 'string' && typeof e?.url === 'string') &&
      typeof parsed.index === 'number' &&
      typeof parsed.length === 'number'
    ) {
      return parsed as Trail
    }
  } catch {
    // Unreadable storage: start over.
  }
  return null
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** A trail that knows only the current entry (nothing to go back to). */
function fresh(): Trail {
  const id = newId()
  stamp(id)
  return { entries: [{ id, url: here() }], index: 0, length: window.history.length }
}

/** After a full page load (reload, or back from another site) find our entry again. */
function start(): Trail {
  const id = idOf(window.history.state)
  const stored = load()
  const index = id && stored ? stored.entries.findIndex((e) => e.id === id) : -1
  return stored && index >= 0 ? { ...stored, index, length: window.history.length } : fresh()
}

function onPopState(event: PopStateEvent) {
  const current = trail ?? start()
  const id = idOf(event.state)
  const index = id ? current.entries.findIndex((e) => e.id === id) : -1
  save(index >= 0 ? { ...current, index, length: window.history.length } : fresh())
}

/** An in-app navigation: a longer history means a push, otherwise it replaced this entry. */
function onNavigate() {
  if (!trail) return save(start())
  const id = idOf(window.history.state)
  if (id) {
    const index = trail.entries.findIndex((e) => e.id === id)
    // Already known (e.g. reached by back/forward).
    if (index >= 0) return save({ ...trail, index, length: window.history.length })
    return save(fresh())
  }
  const entry = { id: newId(), url: here() }
  stamp(entry.id)
  if (window.history.length > trail.length) {
    const entries = [...trail.entries.slice(0, trail.index + 1), entry]
    return save({ entries, index: entries.length - 1, length: window.history.length })
  }
  // Same length: a replace (or a push that cut off forward entries; counting it as a
  // replace only means one screen less to go back to).
  const entries = [...trail.entries.slice(0, trail.index), entry]
  save({ entries, index: entries.length - 1, length: window.history.length })
}

export function NavigationTracker() {
  const pathname = usePathname()
  useEffect(() => {
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    onNavigate()
  }, [pathname])
  return null
}

/** True when the previous entry in this tab's history is an iPlan screen. */
export function canGoBack(): boolean {
  if (typeof window === 'undefined' || !trail) return false
  const current = trail.entries[trail.index]
  if (!current) return false
  const id = idOf(window.history.state)
  if (!id && current.url === here() && window.history.length === trail.length) {
    // A refresh or same-page replace rewrote this entry's state: same entry, tag it again.
    stamp(current.id)
    return trail.index > 0
  }
  return id === current.id && trail.index > 0
}

export function goBack(
  router: { back: () => void; replace: (href: never) => void },
  fallback: string,
) {
  if (canGoBack()) router.back()
  else router.replace(fallback as never)
}
