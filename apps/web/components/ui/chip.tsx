'use client'

import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Toggle pill; pressed chips turn ink-coloured like the prototype. */
export function Chip({
  pressed,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm',
        pressed
          ? 'border-foreground bg-foreground text-background'
          : 'bg-background text-foreground',
        className,
      )}
      {...props}
    />
  )
}

/** Segmented control (single choice). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-muted p-1', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-10 rounded-full px-3 text-sm font-semibold transition-colors',
            value === option.value ? 'bg-foreground text-background' : 'text-muted-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
