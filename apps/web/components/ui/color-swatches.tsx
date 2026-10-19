'use client'

import { Check, Wand2 } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Quick colours for plan lines and places; the rainbow swatch opens the full picker. */
export const LINE_SWATCHES = [
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
  '#64748b',
] as const

/**
 * Round colour swatches (44px targets) with a free colour picker at the end.
 * With `autoLabel`, a first "auto" swatch means "no colour of its own" (value "").
 */
export function ColorSwatches({
  value,
  onChange,
  label,
  autoLabel,
  autoColor,
  customLabel,
}: {
  value: string
  onChange: (color: string) => void
  label: string
  /** Offer "auto" (empty value), e.g. "follow the route". */
  autoLabel?: string
  /** What "auto" currently resolves to, shown inside its swatch. */
  autoColor?: string
  customLabel: string
}) {
  const current = value.toLowerCase()
  const custom = current !== '' && !(LINE_SWATCHES as readonly string[]).includes(current)
  const ring = 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap">
      {autoLabel && (
        <button
          type="button"
          role="radio"
          aria-checked={current === ''}
          aria-label={autoLabel}
          title={autoLabel}
          onClick={() => onChange('')}
          className="flex size-11 items-center justify-center rounded-full"
        >
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-full border-2 border-dashed text-white',
              current === '' && ring,
            )}
            style={{ backgroundColor: autoColor, borderColor: 'var(--border)' }}
          >
            <Wand2 aria-hidden className="size-4" />
          </span>
        </button>
      )}
      {LINE_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={current === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className="flex size-11 items-center justify-center rounded-full"
        >
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-full text-white',
              current === c && ring,
            )}
            style={{ backgroundColor: c }}
          >
            {current === c && <Check aria-hidden className="size-4" />}
          </span>
        </button>
      ))}
      <label
        className="relative flex size-11 cursor-pointer items-center justify-center rounded-full"
        title={customLabel}
      >
        <span
          aria-hidden
          className={cn(
            'size-8 rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]',
            custom && ring,
          )}
        />
        <input
          type="color"
          aria-label={customLabel}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={/^#[0-9a-f]{6}$/.test(current) ? current : '#00a84d'}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  )
}
