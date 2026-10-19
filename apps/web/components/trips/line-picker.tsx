'use client'

import { Check, Pencil } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { ColorSwatches } from '@/components/ui/color-swatches'
import { Field, Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import {
  type Country,
  type LinePreset,
  RAIL_GROUPS,
  countryOfLine,
  countryOfZone,
  countryLines,
  endpointKind,
  isRailLine,
  modesFor,
  presetOf,
  stationArea,
} from '@/lib/lines'
import { CountryChips } from './country-chips'
import { EndpointField } from './endpoint-field'

const METRO = { line: 'METRO', color: '#64748b' }

/** Message key suffix per kind of start/end: "fromStation", "placeholderAirport", … */
const ENDPOINT_TEXT = {
  line: 'Station',
  city: 'Station',
  station: 'Station',
  airport: 'Airport',
  place: 'Place',
} as const

/**
 * How you travel, step by step: the country (suggested from the item's time
 * zone), then the way of getting around; city rail opens that country's lines.
 * A ride can use several lines (Purple then Blue): tap each, or just pick the
 * start and end stations and their lines are ticked for you. Every mode gets a
 * start and end. Tapping a chosen chip again clears it. "Custom" still lets you
 * type any line name and colour.
 */
export function LinePicker({
  line,
  via,
  color,
  from,
  to,
  timeZone,
}: {
  line?: string | undefined
  /** More rail lines on the same ride (transfers), after `line`. */
  via?: readonly string[] | undefined
  color?: string | undefined
  from?: string | undefined
  to?: string | undefined
  timeZone: string
}) {
  const t = useTranslations('lines')
  const locale = useLocale()
  // A saved Grab ride or BTS line keeps its own country; otherwise follow the time zone.
  const [picked, setPicked] = useState<Country | undefined>(countryOfLine(line))
  const country = picked ?? countryOfZone(timeZone)
  const [value, setValue] = useState({ line: line ?? '', color: color ?? '#00a84d' })
  // Presets keep their own name even with another colour; anything else is a custom line.
  const [custom, setCustom] = useState(Boolean(line) && !presetOf(line))
  // The rail lines of this ride, in order; the first one gives the badge and colour.
  const [rail, setRailState] = useState<string[]>(
    isRailLine(line) && line ? [line, ...(via ?? []).filter(isRailLine)] : [],
  )
  const setRail = (next: string[]) => {
    setRailState(next)
    const first = next[0]
    setValue(first ? { line: first, color: presetOf(first)?.color ?? METRO.color } : METRO)
  }
  // The city-rail chip stays on while any of its lines is chosen.
  const metroOn = !custom && (value.line === METRO.line || isRailLine(value.line))
  const on = (p: LinePreset) =>
    !custom &&
    (p.line === METRO.line
      ? metroOn
      : isRailLine(p.line)
        ? rail.includes(p.line)
        : value.line === p.line)
  const toggle = (p: LinePreset) => {
    setCustom(false)
    // Lines add up (a transfer); tapping a chosen line removes just that one.
    if (isRailLine(p.line)) {
      setRail(rail.includes(p.line) ? rail.filter((l) => l !== p.line) : [...rail, p.line])
      return
    }
    setRailState([])
    if (!on(p)) setValue({ line: p.line, color: p.color })
    else setValue((v) => ({ ...v, line: '' }))
  }
  const chip = (p: LinePreset, body: React.ReactNode) => (
    <button
      key={`${p.line}-${p.color}`}
      type="button"
      aria-pressed={on(p)}
      onClick={() => toggle(p)}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm',
        on(p) ? 'chip-on' : 'bg-card',
      )}
    >
      {body}
      {on(p) && <Check aria-hidden className="size-4" />}
    </button>
  )
  const groups = metroOn ? RAIL_GROUPS[country] : []
  const area = stationArea(value.line, country)
  // City rail lists every station of the city (a ride can change lines), chosen lines first.
  const endpoint = metroOn ? 'city' : endpointKind(value.line)
  const savedEndpoint = isRailLine(line) || line === METRO.line ? 'city' : endpointKind(line)
  const allLines = countryLines(country)
  const cityLines = [
    ...rail.flatMap((id) => allLines.filter((l) => l.line === id)),
    ...allLines.filter((l) => !rail.includes(l.line)),
  ]

  return (
    <div className="space-y-4">
      <input type="hidden" name="line" value={value.line} />
      {metroOn && rail.slice(1).map((l) => <input key={l} type="hidden" name="via" value={l} />)}
      {/* A colour only means something with a line; without one, nothing is saved. */}
      {value.line.trim() && <input type="hidden" name="lineColor" value={value.color} />}
      <div>
        <p className="mb-1.5 text-sm text-muted-foreground">{t('country')}</p>
        <CountryChips
          value={country}
          onChange={(c) => {
            setPicked(c)
            // A Grab ride or BTS line makes no sense in another country: drop it.
            const own = countryOfLine(value.line)
            if (own && own !== c && !custom) {
              if (isRailLine(value.line)) setRail([])
              else setValue((v) => ({ ...v, line: '' }))
            }
          }}
        />
      </div>
      <div>
        <p className="mb-1.5 text-sm text-muted-foreground">{t('how')}</p>
        <div className="flex flex-wrap gap-2">
          {modesFor(country).map((p) =>
            chip(
              p,
              <>
                <span aria-hidden>{p.emoji}</span>
                {t(p.label)}
              </>,
            ),
          )}
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => {
              // Custom starts empty; leaving it clears the custom name.
              setCustom(!custom)
              setValue((v) => ({ ...v, line: '' }))
            }}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm',
              custom ? 'chip-on border-solid' : 'bg-card',
            )}
          >
            <Pencil aria-hidden className="size-4" />
            {t('customShort')}
            {custom && <Check aria-hidden className="size-4" />}
          </button>
        </div>
      </div>
      {groups.map((group) => (
        <div key={group.key}>
          <p className="mb-1.5 text-sm text-muted-foreground">{t(`groups.${group.key}`)}</p>
          <div className="flex flex-wrap gap-2">
            {group.lines.map((p) =>
              chip(
                p,
                <>
                  <span
                    aria-hidden
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-display text-xs font-bold text-white [text-shadow:0_0_2px_rgb(0_0_0/0.35)]"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.badge ?? p.line}
                  </span>
                  {locale === 'th' && p.labelTh ? p.labelTh : p.label}
                </>,
              ),
            )}
          </div>
        </div>
      ))}
      {/* Any way of getting around but a rail line (which keeps its official colour) can be recoloured. */}
      {!custom && value.line && !isRailLine(value.line) && (
        <div>
          <p className="mb-1.5 text-sm text-muted-foreground">{t('lineColor')}</p>
          <ColorSwatches
            value={value.color}
            onChange={(c) => setValue((v) => ({ ...v, color: c }))}
            label={t('lineColor')}
            customLabel={t('moreColors')}
          />
        </div>
      )}
      {endpoint && (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Another line or mode starts the ends over; saved ones belong to the saved line. */}
          {(['from', 'to'] as const).map((end) => (
            <EndpointField
              key={`${end}-${endpoint}`}
              name={end}
              label={t(`${end}${ENDPOINT_TEXT[endpoint]}`)}
              placeholder={t(`placeholder${ENDPOINT_TEXT[endpoint]}`)}
              kind={endpoint}
              line={value.line}
              lines={cityLines}
              country={country}
              defaultValue={endpoint === savedEndpoint ? (end === 'from' ? from : to) : undefined}
              near={area}
              onPickLines={(ids) => {
                // A station on a line not chosen yet: tick its line (start's first, end's after).
                if (ids.some((id) => rail.includes(id)) || !ids[0]) return
                setRail(end === 'from' ? [ids[0], ...rail] : [...rail, ids[0]])
              }}
            />
          ))}
        </div>
      )}
      {custom && (
        <div className="space-y-3 rounded-2xl border p-3">
          <Field label={t('name')}>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 font-display text-xs font-bold text-white [text-shadow:0_0_2px_rgb(0_0_0/0.35)]"
                style={{ backgroundColor: value.color }}
              >
                {value.line.trim().slice(0, 4) || '·'}
              </span>
              <Input
                maxLength={20}
                value={value.line}
                placeholder={t('namePlaceholder')}
                onChange={(e) => setValue((v) => ({ ...v, line: e.target.value }))}
              />
            </div>
          </Field>
          <div>
            <p className="mb-1.5 text-sm text-muted-foreground">{t('color')}</p>
            <ColorSwatches
              value={value.color}
              onChange={(c) => setValue((v) => ({ ...v, color: c }))}
              label={t('color')}
              customLabel={t('moreColors')}
            />
          </div>
        </div>
      )}
    </div>
  )
}
