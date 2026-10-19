import { cn } from '@/lib/cn'

export function Progress({
  value,
  className,
  color,
}: {
  value: number
  className?: string
  /** CSS colour for the filled part, e.g. "var(--l2)". */
  color?: string
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-[9px] overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700"
        style={{ width: `${pct}%`, ...(color && { backgroundColor: color }) }}
      />
    </div>
  )
}
