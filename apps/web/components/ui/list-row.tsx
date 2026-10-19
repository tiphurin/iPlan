import { ChevronRight } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** One tappable row inside a ListGroup: icon, title, optional meta and trailing value. */
export function ListRow({
  href,
  onClick,
  icon,
  title,
  meta,
  trailing,
  chevron = Boolean(href),
  className,
}: {
  href?: string
  onClick?: () => void
  icon?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  chevron?: boolean
  className?: string
}) {
  const body = (
    <>
      {icon && <span className="flex size-9 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-medium [overflow-wrap:anywhere]">{title}</span>
        {meta && <span className="block text-xs text-faint">{meta}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight aria-hidden className="size-5 shrink-0 text-faint" />}
    </>
  )
  const cls = cn(
    'flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2.5 text-left active:bg-muted',
    className,
  )
  return (
    <li>
      {href ? (
        <Link href={href as Route} className={cls}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}
