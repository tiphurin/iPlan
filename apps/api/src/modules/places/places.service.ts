import type { PlaceDto } from '@iplan/contracts'

/** Photon: free OpenStreetMap search with autocomplete, no key, no account. */
const PHOTON = 'https://photon.komoot.io/api/'
const CACHE_LIMIT = 300

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: Record<string, string | undefined>
}

/** "Gyeongbokgung, 161 Sajik-ro, Jongno-gu, Seoul, South Korea" without repeats. */
export function photonToPlace(feature: PhotonFeature): PlaceDto | null {
  const [lng, lat] = feature.geometry?.coordinates ?? []
  const p = feature.properties ?? {}
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  // Photon sometimes sends empty strings, so fall back on any blank value, not just missing ones.
  const parts = [street, p.district || p.locality, p.city || p.county, p.state, p.country]
  const name = p.name || street || p.city
  if (!name) return null
  const address = [...new Set(parts.filter((x): x is string => Boolean(x) && x !== name))].join(
    ', ',
  )
  return { name, address, lat, lng }
}

/**
 * Place suggestions for the plan form. Requests go through our API (so the
 * browser never talks to third parties directly) and are cached briefly to be
 * polite to the free service.
 */
export class PlacesService {
  private cache = new Map<string, PlaceDto[]>()

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async search(query: string, near?: { lat: number; lng: number }): Promise<PlaceDto[]> {
    const params = new URLSearchParams({ q: query, limit: '6' })
    if (near) {
      params.set('lat', String(near.lat))
      params.set('lon', String(near.lng))
    }
    const key = params.toString()
    const cached = this.cache.get(key)
    if (cached) return cached
    let places: PlaceDto[]
    try {
      const response = await this.fetcher(`${PHOTON}?${key}`, {
        headers: { 'user-agent': 'iPlan (personal trip planner)' },
        signal: AbortSignal.timeout(4000),
      })
      if (!response.ok) return []
      const body = (await response.json()) as { features?: PhotonFeature[] }
      places = (body.features ?? []).flatMap((f) => {
        const place = photonToPlace(f)
        return place ? [place] : []
      })
    } catch {
      // Search is a convenience; typing the address by hand still works.
      return []
    }
    if (this.cache.size >= CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    this.cache.set(key, places)
    return places
  }
}
