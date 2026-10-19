import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { BalanceRow } from '@/lib/expense-charts'

/**
 * Who gets money back and who owes, as diverging bars around a zero line:
 * right (success) = gets back, left (danger) = owes. Text comes pre-formatted.
 */
export interface BalanceBarsProps {
  rows: (BalanceRow & { icon: ReactNode; netText: string; detail: string })[]
  labels: { owes: string; getsBack: string }
}

export function BalanceBars({ rows, labels }: BalanceBarsProps) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)))
  return (
    <figure>
      <div className="mb-2 flex justify-between text-[11px] text-muted-foreground">
        <span>← {labels.owes}</span>
        <span>{labels.getsBack} →</span>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const width = `${(Math.abs(r.net) / max) * 100}%`
          return (
            <li key={r.id} className="flex items-center gap-3">
              <span className="shrink-0">{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                  <span
                    className={cn(
                      'shrink-0 font-semibold tabular-nums',
                      r.net > 0
                        ? 'text-success'
                        : r.net < 0
                          ? 'text-danger'
                          : 'text-muted-foreground',
                    )}
                  >
                    {r.netText}
                  </span>
                </span>
                <span className="relative mt-1 grid h-2.5 grid-cols-2" aria-hidden>
                  <span className="flex justify-end rounded-l-full bg-muted">
                    {r.net < 0 && (
                      <span className="h-full rounded-l-full bg-danger" style={{ width }} />
                    )}
                  </span>
                  <span className="flex rounded-r-full bg-muted">
                    {r.net > 0 && (
                      <span className="h-full rounded-r-full bg-success" style={{ width }} />
                    )}
                  </span>
                  <span className="absolute inset-y-[-3px] left-1/2 w-px -translate-x-1/2 bg-foreground/50" />
                </span>
                <span className="mt-1 block truncate text-[11px] text-muted-foreground tabular-nums">
                  {r.detail}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
