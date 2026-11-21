import type { PlaceDto } from '@iplan/contracts'

/** Photon: free OpenStreetMap search with autocomplete, no key, no account. */
const PHOTON = 'https://photon.komoot.io/api/'
const CACHE_LIMIT = 300
const MAX_RESULTS = 6

/**
 * Photon answers in each place's local language unless told otherwise, so an
 * English query like "Myeongdong" came back as "명동". Typed in Latin letters
 * only → ask for English names; Hangul, Thai, kana or Han → local names.
 */
export function photonLang(query: string): 'en' | undefined {
  return /[A-Za-z]/.test(query) &&
    !/[\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(query)
    ? 'en'
    : undefined
}

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

  async search(
    query: string,
    near?: { lat: number; lng: number },
    kind?: 'station' | 'airport',
  ): Promise<PlaceDto[]> {
    // Ask for a few more than shown: identical duplicates are dropped below.
    const params = new URLSearchParams({ q: query, limit: '10' })
    const lang = photonLang(query)
    if (lang) params.set('lang', lang)
    if (near) {
      params.set('lat', String(near.lat))
      params.set('lon', String(near.lng))
    }
    // Subway and train stations are tagged railway=station, airports aeroway=aerodrome.
    if (kind === 'station') params.set('osm_tag', 'railway:station')
    if (kind === 'airport') {
      params.set('osm_tag', 'aeroway:aerodrome')
      // Airport names in English read the same for everyone ("Incheon International Airport").
      params.set('lang', 'en')
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
      const seen = new Set<string>()
      places = (body.features ?? [])
        .flatMap((f) => {
          const place = photonToPlace(f)
          const key = place && `${place.name}|${place.address}`
          if (!place || !key || seen.has(key)) return []
          seen.add(key)
          return [place]
        })
        .slice(0, MAX_RESULTS)
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
