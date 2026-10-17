import type { z } from 'zod'
import { ApiError, toApiError } from './api-error'

interface ApiOptions<T extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  schema?: T
  signal?: AbortSignal
}

/** Browser → /api (same origin, session cookie included). Validates responses with Zod. */
export async function apiFetch<T extends z.ZodType>(
  path: `/api/${string}`,
  { method = 'GET', body, schema, signal }: ApiOptions<T> = {},
): Promise<z.infer<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      ...(signal && { signal }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('NETWORK', 0, 'Network error')
  }
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as z.infer<T>
  const json: unknown = await response.json()
  return schema ? schema.parse(json) : (json as z.infer<T>)
}
