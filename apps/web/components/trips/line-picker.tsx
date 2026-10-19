'use client'

import { Check, Pencil } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { Field, Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import {
  type Country,
  type LinePreset,
  RAIL_GROUPS,
  countryOfLine,
  countryOfZone,
  findPreset,
  hasStations,
  isRailLine,
  modesFor,
  stationArea,
} from '@/lib/lines'
import { CountryChips } from './country-chips'
import { StationField } from './station-field'

const METRO = { line: 'METRO', color: '#1f2a37' }

/** Quick colours for a custom line; the last swatch opens the full colour picker. */
const SWATCHES = [
  '#d6453d',
  '#ef7c1c',
  '#e0a100',
  '#00a84d',
  '#0e7490',
  '#0090d2',
  '#0052a4',
  '#6366f1',
  '#996cac',
  '#e5007e',
  '#4a5563',
]

/**
 * How you travel, step by step: the country (suggested from the item's time
 * zone), then the way of getting around; city rail opens that country's lines,
 * and rail rides get a start and end station. Tapping a chosen chip
 * again clears it. "Custom" still lets you type any line name and colour.
 */
export function LinePicker({
  line,
  color,
  from,
  to,
  timeZone,
}: {
  line?: string | undefined
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
  const [custom, setCustom] = useState(Boolean(line) && !findPreset(line, color))
  // The city-rail chip stays on while one of its lines is chosen.
  const metroOn = !custom && (value.line === METRO.line || isRailLine(value.line))
  const on = (p: LinePreset) =>
    !custom && (p.line === METRO.line ? metroOn : value.line === p.line && value.color === p.color)
  const toggle = (p: LinePreset) => {
    setCustom(false)
    if (!on(p)) setValue({ line: p.line, color: p.color })
    // Tapping a chosen line goes back to plain city rail; tapping a chosen mode clears it.
    else if (isRailLine(p.line)) setValue(METRO)
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

  return (
    <div className="space-y-4">
      <input type="hidden" name="line" value={value.line} />
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
              setValue(isRailLine(value.line) ? METRO : (v) => ({ ...v, line: '' }))
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
      {!custom && hasStations(value.line) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Another line or mode starts the stations over; saved ones belong to the saved line. */}
          <StationField
            key={`from-${value.line}`}
            name="from"
            label={t('from')}
            line={value.line}
            defaultValue={value.line === line ? from : undefined}
            near={area}
          />
          <StationField
            key={`to-${value.line}`}
            name="to"
            label={t('to')}
            line={value.line}
            defaultValue={value.line === line ? to : undefined}
            near={area}
          />
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
            <div role="radiogroup" aria-label={t('color')} className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={value.color.toLowerCase() === c}
                  aria-label={c}
                  onClick={() => setValue((v) => ({ ...v, color: c }))}
                  className="flex size-11 items-center justify-center rounded-full"
                >
                  <span
                    className={cn(
                      'flex size-8 items-center justify-center rounded-full text-white',
                      value.color.toLowerCase() === c &&
                        'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {value.color.toLowerCase() === c && <Check aria-hidden className="size-4" />}
                  </span>
                </button>
              ))}
              <label
                className="relative flex size-11 cursor-pointer items-center justify-center rounded-full"
                title={t('moreColors')}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-8 rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]',
                    !SWATCHES.includes(value.color.toLowerCase()) &&
                      'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                  )}
                />
                <input
                  type="color"
                  aria-label={t('moreColors')}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  value={value.color}
                  onChange={(e) => setValue((v) => ({ ...v, color: e.target.value }))}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
