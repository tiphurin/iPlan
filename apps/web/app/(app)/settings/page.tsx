import { resolveLocale } from '@iplan/i18n'
import { getLocale, getTranslations } from 'next-intl/server'
import { Shield } from 'lucide-react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { getMe } from '@/lib/server-api'
import { THEME_COOKIE, resolveTheme } from '@/lib/theme'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const [t, me, locale, store] = await Promise.all([
    getTranslations('settings'),
    getMe(),
    getLocale(),
    cookies(),
  ])
  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={me ? t('signedInAs', { email: me.email }) : undefined}
      />
      {me?.role === 'admin' && (
        <div className="px-4 pb-4">
          <Link href="/admin" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            <Shield aria-hidden className="size-5" />
            {t('adminLink')}
          </Link>
        </div>
      )}
      <SettingsForm
        locale={resolveLocale(locale)}
        theme={resolveTheme(store.get(THEME_COOKIE)?.value)}
      />
    </>
  )
}
