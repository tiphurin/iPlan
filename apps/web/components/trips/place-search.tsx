'use client'

import { PlaceDto } from '@iplan/contracts'
import { useQuery } from '@tanstack/react-query'
import { MapPin, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/field'
import { apiFetch } from '@/lib/api-client'

/**
 * Address box with suggestions as you type (free OpenStreetMap search), like the
 * location field in Apple Calendar. Choosing one fills the address and remembers
 * the coordinates for maps and calendar pins; typing freely still works.
 */
export function PlaceSearch({
  defaultAddress,
  defaultCoords,
  near,
  onPick,
}: {
  defaultAddress?: string | undefined
  defaultCoords?: { lat: number; lng: number } | undefined
  near?: { lat: number; lng: number } | undefined
  /** Called with the chosen place, e.g. to fill an empty title. */
  onPick?: (place: PlaceDto) => void
}) {
  const t = useTranslations('places')
  const [address, setAddress] = useState(defaultAddress ?? '')
  const [coords, setCoords] = useState(defaultCoords)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(address.trim()), 350)
    return () => window.clearTimeout(id)
  }, [address])
  const params = new URLSearchParams({ q: query })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lng', String(near.lng))
  }
  const { data, isFetching } = useQuery({
    queryKey: ['places', params.toString()],
    queryFn: () => apiFetch(`/api/places?${params.toString()}`, { schema: z.array(PlaceDto) }),
    enabled: open && query.length >= 2,
    staleTime: 5 * 60_000,
  })

  return (
    <div className="space-y-2">
      <input type="hidden" name="address" value={address} />
      <input type="hidden" name="lat" value={coords?.lat ?? ''} />
      <input type="hidden" name="lng" value={coords?.lng ?? ''} />
      <div className="relative">
        <MapPin
          aria-hidden
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="pr-10 pl-9"
          value={address}
          autoComplete="off"
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          maxLength={300}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setAddress(e.target.value)
            setCoords(undefined)
            setOpen(true)
          }}
        />
        {address && (
          <button
            type="button"
            aria-label={t('clear')}
            onClick={() => {
              setAddress('')
              setCoords(undefined)
            }}
            className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center text-muted-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
      {coords && <p className="px-1 text-xs text-success">{t('pinned')}</p>}
      {open && query.length >= 2 && (data?.length ?? 0) > 0 && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {data?.map((place) => (
            <li key={`${place.lat},${place.lng}`}>
              <button
                type="button"
                onClick={() => {
                  const full = place.address ? `${place.name}, ${place.address}` : place.name
                  setAddress(full)
                  setCoords({ lat: place.lat, lng: place.lng })
                  setOpen(false)
                  onPick?.(place)
                }}
                className="flex min-h-[52px] w-full items-start gap-3 px-3.5 py-2 text-left active:bg-muted"
              >
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-l3" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{place.name}</span>
                  <span className="block truncate text-xs text-faint">{place.address}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.length >= 2 && !isFetching && data?.length === 0 && (
        <p className="px-1 text-xs text-faint">{t('none')}</p>
      )}
      <p className="px-1 text-[11px] text-faint">{t('credit')}</p>
    </div>
  )
}
