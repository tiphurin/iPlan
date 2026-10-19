import { type Locale, formatDate, todayKey } from '@iplan/i18n'
import { FEATURE_KEYS } from '@iplan/contracts'
import { Lock, Shield } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { Card } from '@/components/ui/card'
import { Avatar } from '@/components/avatar'
import { FEATURES } from '@/features'
import { DASHBOARD_WIDGETS } from '@/features/widgets'
import { getMe } from '@/lib/server-api'

/** Home: greeting, one tile per granted feature, then each feature's widget (streamed). */
export default async function DashboardPage() {
  const [t, me, locale] = await Promise.all([getTranslations(), getMe(), getLocale()])
  if (!me) return null
  const features = me.features
  return (
    <>
      <header className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-2 font-display text-[22px] font-bold md:invisible">
          <span aria-hidden className="size-3.5 rounded-full border-4 border-[#00a84d] bg-card" />
          iPlan
        </div>
        <Link href="/profile" aria-label={t('nav.profile')} className="rounded-full">
          <Avatar name={me.name} image={me.image} size={40} />
        </Link>
      </header>
      <div className="space-y-5 px-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatDate(todayKey('Asia/Bangkok'), { locale: locale as Locale })}
          </p>
          <h1 className="text-[26px] leading-tight font-bold">
            {t('dashboard.greeting', { name: me.name.split(' ')[0] ?? me.name })}
          </h1>
        </div>

        <nav aria-label={t('dashboard.apps')} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {FEATURE_KEYS.map((key) => {
            const f = FEATURES[key]
            const Icon = f.icon
            const granted = features.includes(key)
            const body = (
              <>
                <span
                  className="relative flex size-11 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: granted ? f.color : 'var(--lw)' }}
                >
                  <Icon aria-hidden className="size-6" />
                  {!granted && (
                    <Lock
                      aria-hidden
                      className="absolute -right-1 -bottom-1 size-5 rounded-full bg-card p-0.5 text-muted-foreground"
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block leading-tight font-semibold">
                    {t(`features.${f.label}`)}
                  </span>
                  <span className="block truncate text-xs text-faint">
                    {granted ? t(`features.${f.label}Hint`) : t('dashboard.locked')}
                  </span>
                </span>
              </>
            )
            const cls = 'flex min-h-[76px] items-center gap-3 rounded-2xl border bg-card px-3.5'
            return granted ? (
              <Link key={key} href={f.href as Route} className={`${cls} active:bg-muted`}>
                {body}
              </Link>
            ) : (
              <div key={key} className={`${cls} border-dashed opacity-70`} aria-disabled>
                {body}
              </div>
            )
          })}
          {me.role === 'admin' && (
            <Link
              href="/admin"
              className="flex min-h-[76px] items-center gap-3 rounded-2xl border bg-card px-3.5 active:bg-muted"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                <Shield aria-hidden className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{t('nav.admin')}</span>
                <span className="block truncate text-xs text-faint">{t('profile.adminHint')}</span>
              </span>
            </Link>
          )}
        </nav>
        {features.length === 0 && (
          <Card className="py-6 text-center">
            <p className="font-semibold">{t('dashboard.noFeatures')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.noFeaturesHint')}</p>
          </Card>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {features.map((key) => {
            const Widget = DASHBOARD_WIDGETS[key]
            return (
              <section key={key} aria-label={t(`features.${FEATURES[key].label}`)}>
                <Suspense
                  fallback={
                    <div className="h-36 animate-pulse rounded-hero bg-muted" aria-hidden />
                  }
                >
                  <Widget locale={locale as Locale} />
                </Suspense>
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}
