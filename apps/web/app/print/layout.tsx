import type { ReactNode } from 'react'
import { NavigationTracker } from '@/lib/history'

/** Print pages track history too, so their back button returns to the screen that opened them. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NavigationTracker />
      {children}
      {/* Room so the end of the page isn't hidden behind the print button bar. */}
      <div aria-hidden className="no-print h-32" />
    </>
  )
}
