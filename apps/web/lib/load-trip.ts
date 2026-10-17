import { TripDetailDto, TripItemDto } from '@iplan/contracts'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ApiError } from './api-error'
import { serverApi } from './server-api'

/** Trip + items for a page; 404 page for missing trips or non-members. */
export async function loadTrip(tripId: string) {
  try {
    const [trip, items] = await Promise.all([
      serverApi(`/api/trips/${tripId}`, TripDetailDto),
      serverApi(`/api/trips/${tripId}/items`, z.array(TripItemDto)),
    ])
    return { trip, items }
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) notFound()
    throw error
  }
}
