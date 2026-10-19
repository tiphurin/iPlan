'use client'

import {
  type CreateTripInput,
  type CreateTripItemInput,
  TripDetailDto,
  TripItemDto,
  type UpdateTripInput,
  type UpdateTripItemInput,
} from '@iplan/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiFetch } from './api-client'
import { toApiError } from './api-error'

export const tripKeys = {
  all: ['trips'] as const,
  trip: (id: string) => ['trips', id] as const,
  items: (id: string) => ['trips', id, 'items'] as const,
}

export function useTrip(tripId: string, initialData: TripDetailDto) {
  return useQuery({
    queryKey: tripKeys.trip(tripId),
    queryFn: ({ signal }) => apiFetch(`/api/trips/${tripId}`, { schema: TripDetailDto, signal }),
    initialData,
  })
}

export function useItems(tripId: string, initialData: TripItemDto[]) {
  return useQuery({
    queryKey: tripKeys.items(tripId),
    queryFn: ({ signal }) =>
      apiFetch(`/api/trips/${tripId}/items`, { schema: z.array(TripItemDto), signal }),
    initialData,
  })
}

export function useCreateTrip() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTripInput) =>
      apiFetch('/api/trips', { method: 'POST', body: input, schema: TripDetailDto }),
    onSuccess: () => client.invalidateQueries({ queryKey: tripKeys.all }),
  })
}

export function useUpdateTrip(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTripInput) =>
      apiFetch(`/api/trips/${tripId}`, { method: 'PATCH', body: input, schema: TripDetailDto }),
    onSuccess: (trip) => {
      client.setQueryData(tripKeys.trip(tripId), trip)
      return client.invalidateQueries({ queryKey: tripKeys.all })
    },
  })
}

export function useDeleteTrip(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch(`/api/trips/${tripId}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: tripKeys.all }),
  })
}

/** Uploads an already-resized cover photo (see prepareCover) and returns the updated trip. */
export async function uploadTripCover(tripId: string, photo: Blob): Promise<TripDetailDto> {
  const form = new FormData()
  form.set('file', photo, photo.type === 'image/webp' ? 'cover.webp' : 'cover.jpg')
  const response = await fetch(`/api/trips/${tripId}/cover`, {
    method: 'PUT',
    body: form,
    credentials: 'same-origin',
  })
  if (!response.ok) throw await toApiError(response)
  return TripDetailDto.parse(await response.json())
}

/** Removes the cover photo; the trip goes back to its colour. */
export function removeTripCover(tripId: string): Promise<TripDetailDto> {
  return apiFetch(`/api/trips/${tripId}/cover`, { method: 'DELETE', schema: TripDetailDto })
}

/** Item mutations; every success refreshes the trip's item list. */
export function useItemMutations(tripId: string) {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: tripKeys.items(tripId) })
  const replace = (item: TripItemDto) =>
    client.setQueryData<TripItemDto[]>(tripKeys.items(tripId), (items) =>
      items?.map((existing) => (existing.id === item.id ? item : existing)),
    )

  return {
    create: useMutation({
      mutationFn: (input: CreateTripItemInput) =>
        apiFetch(`/api/trips/${tripId}/items`, {
          method: 'POST',
          body: input,
          schema: TripItemDto,
        }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: UpdateTripItemInput & { id: string }) =>
        apiFetch(`/api/items/${id}`, { method: 'PATCH', body: input, schema: TripItemDto }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiFetch(`/api/items/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
    duplicate: useMutation({
      mutationFn: (id: string) =>
        apiFetch(`/api/items/${id}/duplicate`, { method: 'POST', schema: TripItemDto }),
      onSuccess: refresh,
    }),
    checkIn: useMutation({
      mutationFn: ({ id, at, skipped }: { id: string; at: Date; skipped?: boolean }) =>
        apiFetch(`/api/items/${id}/check-in`, {
          method: 'POST',
          body: { at: at.toISOString(), ...(skipped && { skipped: true }) },
          schema: TripItemDto,
        }),
      onSuccess: replace,
    }),
    undoCheckIn: useMutation({
      mutationFn: (id: string) =>
        apiFetch(`/api/items/${id}/check-in`, { method: 'DELETE', schema: TripItemDto }),
      onSuccess: replace,
    }),
  }
}
