'use client'

import { LOCALE_COOKIE, type Locale } from '@iplan/i18n'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { setPreferenceCookie } from '@/lib/theme'

/** TH | EN switch shown on every screen. Also saved on the account when signed in. */
export function LanguageToggle({
  className,
  ...rest
}: {
  className?: string
  'data-header-lang'?: boolean
}) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const [pending, start] = useTransition()
  function change(next: Locale) {
    if (next === locale) return
    setPreferenceCookie(LOCALE_COOKIE, next)
    start(async () => {
      await apiFetch('/api/me', { method: 'PATCH', body: { locale: next } }).catch(() => undefined)
      router.refresh()
    })
  }
  return (
    <div
      {...rest}
      role="radiogroup"
      aria-label="Language / ภาษา"
      className={cn(
        'inline-flex shrink-0 rounded-full border bg-card p-0.5 text-xs font-semibold',
        pending && 'opacity-60',
        className,
      )}
    >
      {(['th', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={locale === l}
          onClick={() => change(l)}
          className={cn(
            'min-h-9 min-w-10 rounded-full px-2.5',
            locale === l ? 'seg-on font-semibold' : 'text-muted-foreground',
          )}
        >
          {l === 'th' ? 'TH' : 'EN'}
        </button>
      ))}
    </div>
  )
}
