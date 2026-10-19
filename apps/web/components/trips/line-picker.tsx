'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Field, Input } from '@/components/ui/field'
import { cn } from '@/lib/cn'
import { type LinePreset, MODE_PRESETS, SEOUL_LINES, findPreset } from '@/lib/lines'

/**
 * How you travel: tap a suggestion (walk, taxi, bus, Seoul line 1–9, AREX…) or
 * open "Custom" to type a line name and pick any colour, as before.
 */
export function LinePicker({
  line,
  color,
}: {
  line?: string | undefined
  color?: string | undefined
}) {
  const t = useTranslations('lines')
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
        <p className="mb-1.5 text-sm text-muted-foreground">{t('how')}</p>
        <div className="flex flex-wrap gap-2">
          {MODE_PRESETS.map((p) =>
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
      <div>
        <p className="mb-1.5 text-sm text-muted-foreground">{t('seoul')}</p>
        <div className="flex flex-wrap gap-2">
          {SEOUL_LINES.map((p) =>
            chip(
              p,
              <>
                <span
                  aria-hidden
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-display text-xs font-bold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.line.length <= 2 ? p.line : p.line.slice(0, 1)}
                </span>
                {p.line.length > 2 || p.label.length > 2 ? p.label : t('line', { n: p.label })}
              </>,
            ),
          )}
        </div>
      </div>
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
