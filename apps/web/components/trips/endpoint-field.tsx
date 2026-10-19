'use client'

import { PlaceDto } from '@iplan/contracts'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, MapPin, Plane, TrainFront } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useEffect, useId, useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/field'
import { apiFetch } from '@/lib/api-client'
import { airportLabel, findAirports } from '@/lib/airports'
import { COUNTRY_FLAG, type Country, type EndpointKind } from '@/lib/lines'
import { type Station, cityStations, filterStations, stationLabel } from '@/lib/stations'

const ICONS = {
  line: TrainFront,
  city: TrainFront,
  station: TrainFront,
  airport: Plane,
  place: MapPin,
}

/**
 * Start or end of a ride. A rail line lists its stations in running order; city
 * rail without a line lists every station of the city with its lines; trains
 * search railway stations, flights search airports, everything else searches
 * places. The list opens on tap and narrows as you type; any text is allowed.
 */
export function EndpointField({
  name,
  label,
  placeholder,
  kind,
  line,
  lines,
  country,
  defaultValue,
  near,
  onPickLines,
}: {
  name: 'from' | 'to'
  label: string
  placeholder: string
  kind: EndpointKind
  /** The chosen rail line (kind "line"). */
  line: string
  /** The city's lines and badges (kind "city"). */
  lines: readonly { line: string; badge: string }[]
  /** The trip country, to list its airports first (kind "airport"). */
  country: Country
  defaultValue?: string | undefined
  near?: { lat: number; lng: number } | undefined
  /** Called with the rail lines of a picked station (kind "city"), to select them. */
  onPickLines?: (lineIds: string[]) => void
}) {
  const locale = useLocale()
  const id = useId()
  const Icon = ICONS[kind]
  const [value, setValue] = useState(defaultValue ?? '')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // Tapping shows the whole list; typing narrows it.
  const [typed, setTyped] = useState(false)
  const [table, setTable] = useState<Record<string, Station[]> | null>(null)
  const local = kind === 'line' || kind === 'city'
  useEffect(() => {
    if (!local) return
    let live = true
    // The station table is ~80 KB, so it loads only when a rail box is shown.
    void import('@/lib/stations.json').then((m) => {
      if (live) setTable(m.default as Record<string, Station[]>)
    })
    return () => {
      live = false
    }
  }, [local])
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [value])

  const thai = locale === 'th'
  const found: (Station & { lines?: string[]; lineIds?: string[] })[] | null = !table
    ? null
    : kind === 'line'
      ? (table[line] ?? null)
      : kind === 'city'
        ? cityStations(table, lines)
        : null
  // No station table for this line or city (e.g. "Other" country): fall back to search.
  const list = found && found.length > 0 ? found : null
  const search = !local || (table !== null && list === null)
  const params = new URLSearchParams({ q: query })
  if (kind === 'station' || kind === 'line' || kind === 'city') params.set('kind', 'station')
  if (kind === 'airport') params.set('kind', 'airport')
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lng', String(near.lng))
  }
  const { data } = useQuery({
    queryKey: ['places', params.toString()],
    queryFn: () => apiFetch(`/api/places?${params.toString()}`, { schema: z.array(PlaceDto) }),
    enabled: search && open && query.length >= 2,
    staleTime: 5 * 60_000,
  })
  const remote = [...new Set((data ?? []).map((p) => p.name.slice(0, 80)))]
  const airports =
    kind === 'airport'
      ? findAirports(typed ? value : '', country).map((a) => ({
          label: airportLabel(a, thai),
          hint: COUNTRY_FLAG[a.country],
        }))
      : []
  const options: { label: string; hint?: string | undefined; lineIds?: string[] }[] = list
    ? filterStations(list, typed ? value : '').map((s) => {
        const named = stationLabel(s, thai)
        const lineHint = s.lines?.join(' · ')
        return { label: named.label, hint: lineHint ?? named.hint, lineIds: s.lineIds }
      })
    : // Main airports first (by code or name), then search results; each name once.
      [
        ...airports,
        ...remote.filter((n) => !airports.some((a) => a.label === n)).map((n) => ({ label: n })),
      ]
  // Typing a station's full name picks it just like tapping it (its lines get ticked).
  const exactLines = list?.find((s) =>
    [stationLabel(s, thai).label, s.en, s.local].includes(value),
  )?.lineIds
  useEffect(() => {
    if (typed && exactLines) onPickLines?.(exactLines)
  }, [typed, exactLines, onPickLines])
  const show = open && options.length > 0 && !(options.length === 1 && options[0]?.label === value)

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon
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
          noLeadingSpace
          role="combobox"
          aria-expanded={show}
          aria-controls={`${id}-list`}
          placeholder={placeholder}
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
        {(list || kind === 'airport') && (
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
                  if (o.lineIds) onPickLines?.(o.lineIds)
                }}
              >
                <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
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
