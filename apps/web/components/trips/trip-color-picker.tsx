'use client'

import { TRIP_COLORS, type TripColor } from '@iplan/contracts'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'

const NAMES: Record<TripColor, string> = {
  '#00a84d': 'green',
  '#0e7490': 'teal',
  '#0090d2': 'sky',
  '#0052a4': 'blue',
  '#6366f1': 'indigo',
  '#996cac': 'purple',
  '#d6453d': 'rose',
  '#475569': 'slate',
}

/** Round cover-colour swatches with a small live preview of the trip card. */
export function TripColorPicker({
  value,
  onChange,
  name,
  destination,
}: {
  value: string
  onChange: (color: TripColor) => void
  name: string
  destination: string
}) {
  const t = useTranslations('trips')
  return (
    <div>
      <p className="mb-1.5 text-sm text-muted-foreground">{t('coverColor')}</p>
      <div
        aria-hidden
        className="relative mb-2 flex h-[76px] flex-col justify-end overflow-hidden rounded-2xl px-4 py-3 text-white transition-colors"
        style={{ backgroundColor: value }}
      >
        <span className="absolute -top-6 -right-4 size-[84px] rounded-full border-[12px] border-white/20" />
        <span className="relative truncate font-display text-lg leading-tight font-bold [text-shadow:0_1px_6px_rgba(0,0,0,.25)]">
          {name.trim() || t('coverPreview')}
        </span>
        {destination.trim() && (
          <span className="relative truncate text-xs opacity-95">{destination}</span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label={t('coverColor')}
        className="grid max-w-sm grid-cols-8 justify-items-center"
      >
        {TRIP_COLORS.map((c) => {
          const on = value.toLowerCase() === c
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={t(`colors.${NAMES[c]}`)}
              onClick={() => onChange(c)}
              className="flex size-11 items-center justify-center rounded-full"
            >
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full text-white',
                  on && 'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                )}
                style={{ backgroundColor: c }}
              >
                {on && <Check aria-hidden className="size-4" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
