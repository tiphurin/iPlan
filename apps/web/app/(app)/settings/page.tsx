import { resolveLocale } from '@iplan/i18n'
import { getLocale, getTranslations } from 'next-intl/server'
import { cookies } from 'next/headers'
import { PageHeader } from '@/components/page-header'
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
      <SettingsForm
        locale={resolveLocale(locale)}
        theme={resolveTheme(store.get(THEME_COOKIE)?.value)}
      />
    </>
  )
}
