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

/** Coloured feature card with a big number, like the prototype's hero. */
export function Hero({
  tone = 'green',
  decor = true,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: HeroTone; decor?: boolean }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-hero p-[18px] text-white',
        HERO_TONES[tone],
        className,
      )}
      {...props}
    >
      {decor && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-9 -right-9 size-36 rounded-full border-[18px] border-white/18"
        />
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

export type HeroTone = 'green' | 'blue' | 'sky' | 'purple' | 'orange' | 'red' | 'ink'

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
