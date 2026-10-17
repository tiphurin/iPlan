import { ChevronLeft } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'

export function BackLink({ href, label }: { href: Route; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-11 items-center gap-0.5 px-2 text-[15px] font-medium text-primary"
    >
      <ChevronLeft aria-hidden className="size-5" />
      {label}
    </Link>
  )
}
