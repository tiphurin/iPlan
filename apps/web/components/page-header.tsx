import type { ReactNode } from 'react'

/** Large iOS-style title under the status bar. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string | undefined
  action?: ReactNode
}) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
      <div className="min-w-0">
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        <h1 className="truncate text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  )
}
