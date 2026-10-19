import { cn } from '@/lib/cn'
import type { PersonBar } from '@/lib/expense-charts'

/**
 * What each person paid out of pocket vs their share of the spending, as two
 * thin horizontal bars per person on one scale. Text comes pre-formatted.
 */
export interface PersonBarsProps {
  people: (PersonBar & { paidText: string; shareText: string; netText: string })[]
  labels: { paid: string; share: string }
}

export function PersonBars({ people, labels }: PersonBarsProps) {
  const max = Math.max(1, ...people.flatMap((p) => [p.paid, p.share]))
  const pct = (v: number) => `${(v / max) * 100}%`
  return (
    <figure>
      <ul className="space-y-3">
        {people.map((p) => (
          <li key={p.id}>
            <div className="mb-1 flex items-baseline gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              <span
                className={cn(
                  'shrink-0 text-xs font-semibold tabular-nums',
                  p.net > 0 ? 'text-success' : p.net < 0 ? 'text-danger' : 'text-muted-foreground',
                )}
              >
                {p.netText}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
              <div className="h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: pct(p.paid) }} />
              </div>
              <span className="text-right">{p.paidText}</span>
              {/* The pool pays but never has a share of its own. */}
              {!p.isPool && (
                <>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/35"
                      style={{ width: pct(p.share) }}
                    />
                  </div>
                  <span className="text-right">{p.shareText}</span>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" />
          {labels.paid}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-foreground/35" />
          {labels.share}
        </span>
      </figcaption>
    </figure>
  )
}
