import type { Route } from 'next'
import Link from 'next/link'
import { cn } from '@/lib/cn'

/** "Mine | Everyone" switch for admins on list pages. */
export function ScopeTabs({
  base,
  scope,
  labels,
}: {
  base: string
  scope: 'mine' | 'all'
  labels: { mine: string; all: string }
}) {
  return (
    <nav className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 md:max-w-sm">
      {(['mine', 'all'] as const).map((s) => (
        <Link
          key={s}
          href={(s === 'mine' ? base : `${base}?scope=all`) as Route}
          aria-current={scope === s ? 'page' : undefined}
          className={cn(
            'flex min-h-10 items-center justify-center rounded-full text-sm font-semibold',
            scope === s ? 'bg-foreground text-background' : 'text-muted-foreground',
          )}
        >
          {labels[s]}
        </Link>
      ))}
    </nav>
  )
}
