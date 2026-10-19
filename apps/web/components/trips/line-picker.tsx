'use client'

import { Check } from 'lucide-react'
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
  modesFor,
} from '@/lib/lines'
import { CountryChips } from './country-chips'

/**
 * How you travel: pick the country (suggested from the item's time zone), then
 * tap one of its ways of getting around or rail lines, or open "Custom" to
 * type a line name and pick any colour.
 */
export function LinePicker({
  line,
  color,
  timeZone,
}: {
  line?: string | undefined
  color?: string | undefined
  timeZone: string
}) {
  const t = useTranslations('lines')
  const locale = useLocale()
  // A saved Grab ride or BTS line keeps its own country; otherwise follow the time zone.
  const [picked, setPicked] = useState<Country | undefined>(countryOfLine(line))
  const country = picked ?? countryOfZone(timeZone)
  const [value, setValue] = useState({ line: line ?? '', color: color ?? '#00a84d' })
  const [custom, setCustom] = useState(Boolean(line) && !findPreset(line, color))
  const pick = (p: LinePreset) => {
    setValue({ line: p.line, color: p.color })
    setCustom(false)
  }
  const on = (p: LinePreset) => !custom && value.line === p.line && value.color === p.color
  const chip = (p: LinePreset, body: React.ReactNode) => (
    <button
      key={`${p.line}-${p.color}`}
      type="button"
      aria-pressed={on(p)}
      onClick={() => pick(p)}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm',
        on(p) ? 'border-foreground bg-foreground text-background' : 'bg-card',
      )}
    >
      {body}
      {on(p) && <Check aria-hidden className="size-4" />}
    </button>
  )

  return (
    <div className="space-y-3">
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
            if (own && own !== c && !custom) setValue((v) => ({ ...v, line: '' }))
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
        </div>
      </div>
      {RAIL_GROUPS[country].map((group) => (
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
      <button
        type="button"
        aria-expanded={custom}
        onClick={() => setCustom((c) => !c)}
        className="min-h-11 text-sm font-semibold text-primary"
      >
        {custom ? t('hideCustom') : t('custom')}
      </button>
      {custom && (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label={t('name')}>
            <Input
              maxLength={20}
              value={value.line}
              onChange={(e) => setValue((v) => ({ ...v, line: e.target.value }))}
            />
          </Field>
          <Field label={t('color')}>
            <Input
              type="color"
              className="w-16 p-1"
              value={value.color}
              onChange={(e) => setValue((v) => ({ ...v, color: e.target.value }))}
            />
          </Field>
        </div>
      )}
    </div>
  )
}
