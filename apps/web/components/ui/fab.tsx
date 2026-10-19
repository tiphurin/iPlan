import { Plus } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'

/** Floating "+ add" pill above the tab bar (phones) or bottom-right (desktop). */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as Route}
      className="fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 inline-flex min-h-[52px] items-center gap-1.5 rounded-full bg-[#00a84d] px-5 text-base font-semibold text-white shadow-[0_6px_18px_rgba(0,168,77,.35)] active:scale-[0.98] md:right-8 md:bottom-8"
    >
      <Plus aria-hidden className="size-5" strokeWidth={2.6} />
      {label}
    </Link>
  )
}
