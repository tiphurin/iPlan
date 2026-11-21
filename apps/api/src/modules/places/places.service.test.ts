import { describe, expect, it } from 'vitest'
import { PlacesService, photonLang, photonToPlace } from './places.service'

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

  it('asks only for railway stations when searching a start or end station', async () => {
    const urls: string[] = []
    const spy = (async (url: string) => {
      urls.push(url)
      return new Response(JSON.stringify({ features: [feature] }))
    }) as unknown as typeof fetch
    const service = new PlacesService(spy)
    await service.search('siam', { lat: 13.74, lng: 100.53 }, 'station')
    await service.search('siam')
    await service.search('incheon', undefined, 'airport')
    expect(urls[0]).toContain('osm_tag=railway%3Astation')
    expect(urls[0]).toContain('lat=13.74')
    expect(urls[1]).not.toContain('osm_tag')
    expect(urls[2]).toContain('osm_tag=aeroway%3Aaerodrome')
  })

  it('asks for English names when the query is typed in Latin letters', async () => {
    expect(photonLang('Myeongdong')).toBe('en')
    expect(photonLang('Olive Young 명동')).toBeUndefined()
    expect(photonLang('명동')).toBeUndefined()
    expect(photonLang('สยาม')).toBeUndefined()
    expect(photonLang('渋谷')).toBeUndefined()
    const urls: string[] = []
    const spy = (async (url: string) => {
      urls.push(url)
      return new Response(JSON.stringify({ features: [feature] }))
    }) as unknown as typeof fetch
    const service = new PlacesService(spy)
    await service.search('Hongdae', { lat: 37.5665, lng: 126.978 })
    await service.search('홍대')
    expect(urls[0]).toContain('lang=en')
    expect(urls[1]).not.toContain('lang=')
  })

  it('drops identical results and shows at most six', async () => {
    const other = (i: number) => ({
      geometry: feature.geometry,
      properties: { ...feature.properties, name: `Olive Young ${i}` },
    })
    const features = [feature, feature, feature, ...[1, 2, 3, 4, 5, 6].map(other)]
    const service = new PlacesService(
      (async () => new Response(JSON.stringify({ features }))) as unknown as typeof fetch,
    )
    const places = await service.search('olive young')
    expect(places).toHaveLength(6)
    expect(places.map((p) => p.name).slice(0, 2)).toEqual(['Gyeongbokgung', 'Olive Young 1'])
  })
})
