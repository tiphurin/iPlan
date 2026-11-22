import type { Context } from 'hono'
import type { StorageProvider } from '../infra/storage'

/** Vercel functions answer with at most 4.5 MB; bigger files go straight to storage. */
const MAX_INLINE_BYTES = 4 * 1024 * 1024

/** Every stored file's URL changes when the file does (new id or ?v=), so it never goes stale. */
const CACHE = 'private, max-age=31536000, immutable'

/**
 * Sends a stored file after the caller checked permissions. Images come
 * through the API with a long private cache, so a phone downloads each photo
 * once instead of on every visit (a signed storage link changes every time and
 * can't be cached). PDFs and very large files redirect to a short-lived link.
 * `fallbackKey` is tried when `key` is missing (e.g. a small cover not made yet).
 */
export async function serveStoredFile(
  c: Context,
  storage: StorageProvider,
  file: { key: string; contentType: string; fallbackKey?: string | undefined },
): Promise<Response> {
  const redirect = async (key: string) =>
    storage.signedUrl ? c.redirect(await storage.signedUrl(key, 300), 302) : null
  if (file.contentType === 'application/pdf') {
    const r = await redirect(file.key)
    if (r) return r
  }
  let key = file.key
  let bytes = await storage.get(key)
  if (!bytes && file.fallbackKey) {
    key = file.fallbackKey
    bytes = await storage.get(key)
  }
  if (!bytes) return c.json({ error: { code: 'NOT_FOUND', message: 'File missing' } }, 404)
  if (bytes.byteLength > MAX_INLINE_BYTES) {
    const r = await redirect(key)
    if (r) return r
  }
  return c.body(bytes, 200, {
    'content-type': file.contentType,
    'cache-control': CACHE,
    'x-content-type-options': 'nosniff',
  })
}
