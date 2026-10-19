'use client'

import { PlaceDto } from '@iplan/contracts'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, TrainFront } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useId, useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/field'
import { apiFetch } from '@/lib/api-client'
import { type Station, filterStations, stationLabel } from '@/lib/stations'

/**
 * Start or end station. For a city rail line the list shows that line's
 * stations in running order (from OpenStreetMap) and narrows as you type; for
 * other trains it searches stations near the city. Typing your own is fine.
 */
export function StationField({
  name,
  label,
  line,
  defaultValue,
  near,
}: {
  name: 'from' | 'to'
  label: string
  /** The chosen rail line id, if any (its stations are suggested). */
  line: string
  defaultValue?: string | undefined
  near?: { lat: number; lng: number } | undefined
}) {
  const t = useTranslations('lines')
  const locale = useLocale()
  const id = useId()
  const [value, setValue] = useState(defaultValue ?? '')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // Focus shows the whole line; typing narrows it.
  const [typed, setTyped] = useState(false)
  const [lineStations, setLineStations] = useState<Station[] | null>(null)
  useEffect(() => {
    let live = true
    // The station table is ~80 KB, so it loads only when a station box is shown.
    void import('@/lib/stations.json').then((m) => {
      if (live) setLineStations((m.default as Record<string, Station[]>)[line] ?? null)
    })
    return () => {
      live = false
    }
  }, [line])
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [value])

  const params = new URLSearchParams({ q: query, kind: 'station' })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lng', String(near.lng))
  }
  const { data } = useQuery({
    queryKey: ['places', params.toString()],
    queryFn: () => apiFetch(`/api/places?${params.toString()}`, { schema: z.array(PlaceDto) }),
    enabled: !lineStations && open && query.length >= 2,
    staleTime: 5 * 60_000,
  })
  const thai = locale === 'th'
  const options: { label: string; hint?: string | undefined }[] = lineStations
    ? filterStations(lineStations, typed ? value : '').map((s) => stationLabel(s, thai))
    : // The same station often comes back once per line or exit; show each name once.
      [...new Set((data ?? []).map((p) => p.name.slice(0, 80)))].map((n) => ({ label: n }))
  const show = open && options.length > 0 && !(options.length === 1 && options[0]?.label === value)

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <TrainFront
          aria-hidden
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          name={name}
          className="pr-9 pl-9"
          value={value}
          maxLength={80}
          autoComplete="off"
          role="combobox"
          aria-expanded={show}
          aria-controls={`${id}-list`}
          placeholder={lineStations ? t('stationPick') : t('stationPlaceholder')}
          onFocus={() => {
            setOpen(true)
            setTyped(false)
          }}
          // A tap on an already focused box opens the list again.
          onClick={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setValue(e.target.value)
            setTyped(true)
            setOpen(true)
          }}
        />
        {lineStations && (
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        )}
      </div>
      {show && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="max-h-72 divide-y overflow-y-auto overscroll-contain rounded-2xl border bg-card"
        >
          {options.map((o, i) => (
            <li key={`${i}:${o.label}`} role="option" aria-selected={o.label === value}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm active:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setValue(o.label)
                  setOpen(false)
                }}
              >
                <TrainFront aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-faint">{o.hint}</span>}
              </button>
            </li>
          ))}
          <li role="presentation" className="px-3 py-1.5 text-[11px] text-faint">
            © OpenStreetMap
          </li>
        </ul>
      )}
    </div>
  )
}
