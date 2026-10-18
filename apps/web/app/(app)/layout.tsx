import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { BottomNav } from '@/components/bottom-nav'
import { getMe } from '@/lib/server-api'

/** Everything behind sign-in: content above a fixed bottom tab bar. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!(await getMe())) redirect('/login')
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-xl pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </>
  )
}
