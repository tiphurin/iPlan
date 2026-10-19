import { Clock } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Hero } from '@/components/ui/card'
import { getMe } from '@/lib/server-api'
import { LanguageToggle } from '@/components/language-toggle'
import { PendingActions } from './pending-actions'

export const metadata: Metadata = { title: 'Waiting for approval' }

/** Signed in with Google, but an admin hasn't let this account in yet. */
export default async function PendingPage() {
  const me = await getMe()
  if (!me) redirect('/login')
  if (me.mustChangePassword) redirect('/change-password')
  if (me.status === 'active') redirect('/')
  const t = await getTranslations('pending')
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between gap-8 px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="space-y-4">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <Hero tone="ink">
          <Clock aria-hidden className="mb-3 size-9" />
          <p className="font-display text-[26px] leading-tight font-bold">{t('title')}</p>
          <p className="mt-2 text-[15px] opacity-95">{t('body', { email: me.email })}</p>
        </Hero>
        <p className="px-1 text-sm text-muted-foreground">{t('hint')}</p>
      </div>
      <PendingActions />
    </main>
  )
}
