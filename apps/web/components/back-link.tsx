'use client'

import { ChevronLeft } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { canGoBack } from '@/lib/history'
import { LanguageToggle } from './language-toggle'

/**
 * "‹ Back" on the left; the language switch on the right (phones; desktop has it
 * in the sidebar). With `history`, it returns to the previous screen when there is
 * one, so the list keeps its scroll position and nothing piles up in history.
 */
export function BackLink({
  href,
  label,
  history = false,
}: {
  href: Route
  label: string
  history?: boolean
}) {
  const router = useRouter()
  return (
    <div data-back-link className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <Link
        href={href}
        onClick={(event) => {
          if (history && canGoBack()) {
            event.preventDefault()
            router.back()
          }
        }}
        className="-ml-2 inline-flex min-h-11 min-w-0 items-center gap-0.5 px-2 text-[15px] font-medium text-primary"
      >
        <ChevronLeft aria-hidden className="size-5 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
      <LanguageToggle className="md:hidden" />
    </div>
  )
}
