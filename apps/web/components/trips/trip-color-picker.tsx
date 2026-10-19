'use client'

import { TRIP_COLORS } from '@iplan/contracts'
import { Check, ImagePlus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { cn } from '@/lib/cn'

const NAMES: Record<string, string> = {
  '#00a84d': 'green',
  '#0e7490': 'teal',
  '#0090d2': 'sky',
  '#0052a4': 'blue',
  '#6366f1': 'indigo',
  '#996cac': 'purple',
  '#d6453d': 'rose',
  '#475569': 'slate',
}

/**
 * Round cover-colour swatches with a small live preview of the trip card, plus an
 * optional cover photo (the colour stays underneath as the fallback).
 */
export function TripColorPicker({
  value,
  onChange,
  name,
  destination,
  photo = null,
  onPhoto,
  onRemovePhoto,
  photoBusy = false,
  photoError,
}: {
  value: string
  onChange: (color: string) => void
  name: string
  destination: string
  /** Preview URL of the cover photo (uploaded or just picked); null shows the colour. */
  photo?: string | null
  onPhoto?: (file: File) => void
  onRemovePhoto?: () => void
  photoBusy?: boolean
  photoError?: string | null | undefined
}) {
  const t = useTranslations('trips')
  const input = useRef<HTMLInputElement>(null)
  return (
    <div>
      <p className="mb-1.5 text-sm text-muted-foreground">{t('coverColor')}</p>
      <div
        aria-hidden
        className="relative mb-2 flex h-[76px] flex-col justify-end overflow-hidden rounded-2xl px-4 py-3 text-white transition-colors"
        style={{ backgroundColor: value }}
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview or API-served cover */}
            <img src={photo} alt="" className="absolute inset-0 size-full object-cover" />
            <span className="absolute inset-0 bg-linear-to-t from-black/65 via-black/20 to-transparent" />
          </>
        ) : (
          <span className="absolute -top-6 -right-4 size-[84px] rounded-full border-[12px] border-white/20" />
        )}
        <span className="relative truncate font-display text-lg leading-tight font-bold [text-shadow:0_1px_6px_rgba(0,0,0,.25)]">
          {name.trim() || t('coverPreview')}
        </span>
        {destination.trim() && (
          <span className="relative truncate text-xs opacity-95">{destination}</span>
        )}
      </div>
      <div role="radiogroup" aria-label={t('coverColor')} className="flex flex-wrap">
        {TRIP_COLORS.map((c) => {
          const on = value.toLowerCase() === c
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={t(`colors.${NAMES[c] ?? 'custom'}`)}
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
        {/* Any other colour: the system colour picker behind a rainbow swatch. */}
        <label
          className="relative flex size-11 cursor-pointer items-center justify-center rounded-full"
          title={t('colors.custom')}
        >
          <span
            aria-hidden
            className={cn(
              'size-8 rounded-full bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]',
              !(TRIP_COLORS as readonly string[]).includes(value.toLowerCase()) &&
                value.startsWith('#') &&
                'ring-2 ring-foreground ring-offset-2 ring-offset-background',
            )}
          />
          <input
            type="color"
            aria-label={t('colors.custom')}
            className="absolute inset-0 cursor-pointer opacity-0"
            value={value.startsWith('#') ? value : '#00a84d'}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </div>
      {onPhoto && (
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={photoBusy}
            onClick={() => input.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium active:bg-muted disabled:opacity-60"
          >
            <ImagePlus aria-hidden className="size-4" />
            {photo ? t('coverPhotoChange') : t('coverPhoto')}
          </button>
          {photo && onRemovePhoto && (
            <button
              type="button"
              disabled={photoBusy}
              onClick={onRemovePhoto}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-danger active:bg-muted disabled:opacity-60"
            >
              <Trash2 aria-hidden className="size-4" />
              {t('coverPhotoRemove')}
            </button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) onPhoto(file)
            }}
          />
        </div>
      )}
      {photoError && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {photoError}
        </p>
      )}
    </div>
  )
}
