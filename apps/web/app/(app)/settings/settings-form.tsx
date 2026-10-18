'use client'

import { LOCALE_COOKIE, type Locale } from '@iplan/i18n'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { THEME_COOKIE, THEMES, type Theme, setPreferenceCookie } from '@/lib/theme'

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-11 rounded-lg text-sm font-medium transition-colors',
            value === option.value ? 'bg-card shadow-sm' : 'text-muted-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsForm({ locale, theme: initialTheme }: { locale: Locale; theme: Theme }) {
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
    <div className="space-y-6 px-4">
      <section>
        <SectionTitle>{t('language')}</SectionTitle>
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
      <section>
        <SectionTitle>{t('theme')}</SectionTitle>
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
      <Card className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-danger"
          onClick={signOut}
          disabled={pending}
        >
          <LogOut aria-hidden className="size-5" />
          {t('signOut')}
        </Button>
      </Card>
    </div>
  )
}
