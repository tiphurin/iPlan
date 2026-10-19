import { describe, expect, it } from 'vitest'
import { PlacesService, photonToPlace } from './places.service'

const feature = {
  geometry: { coordinates: [126.977, 37.5796] as [number, number] },
  properties: {
    name: 'Gyeongbokgung',
    housenumber: '161',
    street: 'Sajik-ro',
    district: 'Jongno-gu',
    city: 'Seoul',
    country: 'South Korea',
  },
}

describe('places', () => {
  it('turns Photon results into name, address and coordinates', () => {
    expect(photonToPlace(feature)).toEqual({
      name: 'Gyeongbokgung',
      address: '161 Sajik-ro, Jongno-gu, Seoul, South Korea',
      lat: 37.5796,
      lng: 126.977,
    })
    expect(photonToPlace({ properties: { name: 'x' } })).toBeNull()
  })

  it('falls back past blank fields', () => {
    expect(
      photonToPlace({
        geometry: feature.geometry,
        properties: { name: '', street: '', district: '', locality: 'Jongno', city: 'Seoul' },
      }),
    ).toEqual({ name: 'Seoul', address: 'Jongno', lat: 37.5796, lng: 126.977 })
  })

  it('caches answers and stays quiet when the service fails', async () => {
    let calls = 0
    const ok = (async () => {
      calls += 1
      return new Response(JSON.stringify({ features: [feature] }))
    }) as unknown as typeof fetch
    const service = new PlacesService(ok)
    expect(await service.search('gyeong')).toHaveLength(1)
    await service.search('gyeong')
    expect(calls).toBe(1)
    const broken = new PlacesService((async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch)
    expect(await broken.search('gyeong')).toEqual([])
  })
})
