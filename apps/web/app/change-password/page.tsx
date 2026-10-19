import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { LanguageToggle } from '@/components/language-toggle'
import { getMe } from '@/lib/server-api'
import { ChangePasswordForm } from './change-password-form'

export const metadata: Metadata = { title: 'Change password' }

/** Required after signing in with the bootstrap password; also reachable from Profile. */
export default async function ChangePasswordPage() {
  const me = await getMe()
  if (!me) redirect('/login')
  // Only the built-in admin signs in with a password.
  if (me.role !== 'superadmin') redirect('/profile')
  const t = await getTranslations('password')
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <div>
        <h1 className="text-[28px] font-bold">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">
          {me.mustChangePassword ? t('required') : t('subtitle')}
        </p>
      </div>
      <ChangePasswordForm required={me.mustChangePassword} />
    </main>
  )
}
