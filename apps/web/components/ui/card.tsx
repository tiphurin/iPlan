import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border bg-card px-4 py-3.5', className)} {...props} />
}

export function SectionTitle({
  className,
  action,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { action?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 pb-1">
      <h2 className={cn('text-lg font-semibold', className)} {...props}>
        {children}
      </h2>
      {action}
    </div>
  )
}

/**
 * Feature card with a big number. "soft" (default) is a plain surface with a thin
 * tone-coloured accent; "solid" fills it with the tone, for live status like Today.
 */
export function Hero({
  tone = 'green',
  variant = 'soft',
  decor = true,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: HeroTone
  variant?: 'soft' | 'solid'
  decor?: boolean
}) {
  const solid = variant === 'solid'
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-hero p-[18px]',
        solid ? ['text-white', HERO_TONES[tone]] : 'border bg-card text-foreground',
        className,
      )}
      style={solid ? undefined : { borderColor: 'var(--card-edge)' }}
      {...props}
    >
      {decor &&
        (solid ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-9 -right-9 size-36 rounded-full border-[18px] border-white/18"
          />
        ) : (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full opacity-[0.07]"
            style={{ backgroundColor: HERO_ACCENT[tone] }}
          />
        ))}
      <div className="relative">{children}</div>
    </div>
  )
}

export type HeroTone = 'green' | 'blue' | 'sky' | 'purple' | 'orange' | 'red' | 'ink'

const HERO_ACCENT: Record<HeroTone, string> = {
  green: '#00a84d',
  blue: '#0052a4',
  sky: '#0090d2',
  purple: '#996cac',
  orange: '#ef7c1c',
  red: '#d6453d',
  ink: 'var(--foreground)',
}

const HERO_TONES: Record<HeroTone, string> = {
  green: 'bg-[#00a84d]',
  blue: 'bg-[#0052a4]',
  sky: 'bg-[#0090d2]',
  purple: 'bg-[#996cac]',
  orange: 'bg-[#ef7c1c]',
  red: 'bg-[#d6453d]',
  ink: 'bg-hero-ink',
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border bg-card px-3.5 py-3', className)}>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="num text-xl leading-tight font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
    </div>
  )
}

/** Grouped list in one rounded box, rows separated by hairlines. */
export function ListGroup({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn('divide-y overflow-hidden rounded-2xl border bg-card', className)}
      {...props}
    />
  )
}
