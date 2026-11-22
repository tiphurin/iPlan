import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { StorageProvider } from '../infra/storage'
import { serveStoredFile } from './serve-file'

function storageWith(files: Record<string, Uint8Array>, signed = true): StorageProvider {
  return {
    put: async () => undefined,
    get: async (key) => (files[key] ? new Uint8Array(files[key]) : null),
    delete: async () => undefined,
    ...(signed && { signedUrl: async (key: string) => `https://bucket.example/${key}?sig=1` }),
  } as StorageProvider
}

const app = (storage: StorageProvider, file: Parameters<typeof serveStoredFile>[2]) =>
  new Hono().get('/f', (c) => serveStoredFile(c, storage, file))

describe('serveStoredFile', () => {
  it('sends images itself with a long private cache, even when signed links exist', async () => {
    const res = await app(storageWith({ 'a.webp': new Uint8Array([1, 2, 3]) }), {
      key: 'a.webp',
      contentType: 'image/webp',
    }).request('/f')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('redirects PDFs and files too big for a function response', async () => {
    const pdf = await app(storageWith({}), {
      key: 'a.pdf',
      contentType: 'application/pdf',
    }).request('/f')
    expect(pdf.status).toBe(302)
    expect(pdf.headers.get('location')).toBe('https://bucket.example/a.pdf?sig=1')
    const big = await app(storageWith({ 'b.jpg': new Uint8Array(4 * 1024 * 1024 + 1) }), {
      key: 'b.jpg',
      contentType: 'image/jpeg',
    }).request('/f')
    expect(big.status).toBe(302)
  })

  it('uses the fallback when the asked file is missing, else 404', async () => {
    const storage = storageWith({ 'full.webp': new Uint8Array([9]) })
    const res = await app(storage, {
      key: 'full.sm.webp',
      contentType: 'image/webp',
      fallbackKey: 'full.webp',
    }).request('/f')
    expect(res.status).toBe(200)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([9]))
    const none = await app(storage, { key: 'x.webp', contentType: 'image/webp' }).request('/f')
    expect(none.status).toBe(404)
  })

  it('without signed links (local disk) still serves PDFs directly', async () => {
    const res = await app(storageWith({ 'a.pdf': new Uint8Array([37]) }, false), {
      key: 'a.pdf',
      contentType: 'application/pdf',
    }).request('/f')
    expect(res.status).toBe(200)
  })
})
