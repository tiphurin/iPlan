import { isAdminRole } from '@iplan/contracts'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppNav } from '@/components/bottom-nav'
import { ConfirmHost } from '@/lib/confirm'
import { NavigationTracker } from '@/lib/history'
import { getMe } from '@/lib/server-api'
import { UnsavedGuard } from '@/lib/unsaved'

/**
 * Everything behind sign-in and approval. Phones: one column above a bottom tab
 * bar. Tablets and desktop: a left sidebar and a wider, multi-column page.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await getMe()
  if (!me) redirect('/login')
  if (me.mustChangePassword) redirect('/change-password')
  if (me.status !== 'active') redirect('/pending')
  return (
    <>
      <NavigationTracker />
      <UnsavedGuard />
      <ConfirmHost />
      <AppNav features={me.features} isAdmin={isAdminRole(me.role)} />
      <div className="md:pl-20 lg:pl-60">
        <main className="mx-auto min-h-dvh max-w-xl pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:max-w-5xl md:px-4 md:pb-12">
          {children}
        </main>
      </div>
    </>
  )
}
