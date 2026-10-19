import type { ReactNode } from 'react'

/** Large title under the status bar, in the display font. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 flex items-end justify-between gap-3 bg-background px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="min-w-0">
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        <h1 className="truncate text-[28px] leading-tight font-bold">{title}</h1>
      </div>
      {action}
    </header>
  )
}
