import { getApp } from '@iplan/api'
import { MeDto } from '@iplan/contracts'
import { headers } from 'next/headers'
import { cache } from 'react'
import type { z } from 'zod'
import { ApiError, toApiError } from './api-error'

/**
 * Server Components call the API in-process (no network hop) with the
 * browser's cookies, so the same authorization rules apply as for fetch().
 */
export async function serverApi<T extends z.ZodType>(
  path: `/api/${string}`,
  schema: T,
): Promise<z.infer<T>> {
  const incoming = await headers()
  const forwarded = new Headers()
  const cookie = incoming.get('cookie')
  if (cookie) forwarded.set('cookie', cookie)
  const response = await getApp().request(path, { headers: forwarded })
  if (!response.ok) throw await toApiError(response)
  return schema.parse(await response.json())
}

/** The signed-in user, or null. Cached per request. */
export const getMe = cache(async () => {
  try {
    return await serverApi('/api/me', MeDto)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
})

/** Time the request was rendered; seeds live clocks so server and client HTML match. */
export function requestTime(): number {
  return Date.now()
}
