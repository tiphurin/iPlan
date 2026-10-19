'use client'

import { LOCALE_COOKIE, type Locale } from '@iplan/i18n'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/chip'
import { apiFetch } from '@/lib/api-client'
import { THEME_COOKIE, THEMES, type Theme, setPreferenceCookie } from '@/lib/theme'

export function ProfileForm({ locale, theme: initialTheme }: { locale: Locale; theme: Theme }) {
  const t = useTranslations('settings')
  const router = useRouter()
  const [theme, setTheme] = useState(initialTheme)
  const [pending, startTransition] = useTransition()

  function changeLocale(next: Locale) {
    setPreferenceCookie(LOCALE_COOKIE, next)
    startTransition(async () => {
      // Also remember it on the account so other devices pick it up.
      await apiFetch('/api/me', { method: 'PATCH', body: { locale: next } }).catch(() => undefined)
      router.refresh()
    })
  }

  function changeTheme(next: Theme) {
    setTheme(next)
    setPreferenceCookie(THEME_COOKIE, next)
    document.documentElement.classList.remove(...THEMES)
    document.documentElement.classList.add(next)
  }

  function signOut() {
    startTransition(async () => {
      await apiFetch('/api/auth/sign-out', { method: 'POST', body: {} }).catch(() => undefined)
      router.replace('/login')
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('language')}</h2>
        <Segmented
          label={t('language')}
          value={locale}
          onChange={changeLocale}
          options={[
            { value: 'th', label: 'ไทย' },
            { value: 'en', label: 'English' },
          ]}
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('theme')}</h2>
        <Segmented
          label={t('theme')}
          value={theme}
          onChange={changeTheme}
          options={[
            { value: 'system', label: t('themeSystem') },
            { value: 'light', label: t('themeLight') },
            { value: 'dark', label: t('themeDark') },
          ]}
        />
      </section>
      <Button
        variant="secondary"
        size="lg"
        className="text-danger"
        onClick={signOut}
        disabled={pending}
      >
        <LogOut aria-hidden className="size-5" />
        {t('signOut')}
      </Button>
    </div>
  )
}
