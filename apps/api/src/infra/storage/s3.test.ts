import { afterEach, describe, expect, it, vi } from 'vitest'
import { S3Storage } from './s3'

const storage = new S3Storage({
  endpoint: 'https://s3.us-west-004.backblazeb2.com',
  region: 'us-west-004',
  bucket: 'bucket',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  forcePathStyle: false,
})

afterEach(() => vi.unstubAllGlobals())

describe('S3Storage', () => {
  it('uploads the bytes themselves, so fetch can send a Content-Length', async () => {
    // B2 rejects streamed bodies without a length (411 MissingContentLength), which is
    // what a Request-wrapped body became in the production build.
    const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    await storage.put('trips/t1/cover.webp', new Uint8Array([1, 2, 3]), 'image/webp')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://bucket.s3.us-west-004.backblazeb2.com/trips/t1/cover.webp')
    expect(init.method).toBe('PUT')
    expect(init.body).toBeInstanceOf(Uint8Array)
    expect((init.body as Uint8Array).byteLength).toBe(3)
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /)
    expect(headers.get('content-type')).toBe('image/webp')
  })

  it('reports what the bucket said when an upload is refused', async () => {
    vi.stubGlobal('fetch', async () => new Response('MissingContentLength', { status: 411 }))
    await expect(storage.put('a.webp', new Uint8Array([1]), 'image/webp')).rejects.toThrow(
      'S3 put failed: 411 MissingContentLength',
    )
  })
})
