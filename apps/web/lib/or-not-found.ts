import { notFound } from 'next/navigation'
import { ApiError } from './api-error'

/** Awaits an API read; a missing or malformed id becomes the 404 page. */
export async function orNotFound<T>(load: Promise<T>): Promise<T> {
  try {
    return await load
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) notFound()
    throw error
  }
}
