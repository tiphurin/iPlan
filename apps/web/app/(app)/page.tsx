import { FEATURE_KEYS, InvitationDto, isAdminRole } from '@iplan/contracts'
import { type Locale, formatDate, todayKey } from '@iplan/i18n'
import { BookOpen, ChevronRight, Lock, Shield } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { z } from 'zod'
import { Avatar } from '@/components/avatar'
import { InvitationsCard } from '@/components/invitations-card'
import { LanguageToggle } from '@/components/language-toggle'
import { Card } from '@/components/ui/card'
import { FEATURES } from '@/features'
import { DASHBOARD_WIDGETS } from '@/features/widgets'
import { cn } from '@/lib/cn'
import { getMe, serverApi } from '@/lib/server-api'

const tile = 'flex min-h-[76px] items-center gap-3 rounded-2xl border bg-card px-3.5 py-3'

/** Home: greeting, every feature as a tile, invitations, then one widget per feature (streamed). */
export default async function DashboardPage() {
  const [t, me, locale] = await Promise.all([getTranslations(), getMe(), getLocale()])
  if (!me) return null
  const features = me.features
  const invitations = await serverApi('/api/invitations', z.array(InvitationDto))
  return (
    <>
      <header className="flex items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4 md:pt-8">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 font-display text-[22px] font-bold md:hidden">
            <span aria-hidden className="size-3.5 rounded-full border-4 border-[#00a84d] bg-card" />
            iPlan
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(todayKey('Asia/Bangkok'), { locale: locale as Locale })}
          </p>
          <h1 className="text-[26px] leading-tight font-bold md:text-3xl">
            {t('dashboard.greeting', { name: me.nickname ?? me.name.split(' ')[0] ?? me.name })}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageToggle className="md:hidden" />
          <Link href="/profile" aria-label={t('nav.profile')} className="rounded-full">
            <Avatar name={me.name} image={me.image} size={40} />
          </Link>
        </div>
      </header>

      <div className="space-y-5 px-4">
        {invitations.length > 0 && <InvitationsCard initial={invitations} features={features} />}

        <nav aria-label={t('dashboard.apps')} className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
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
                  <span className="line-clamp-2 text-xs text-faint">
                    {granted ? t(`features.${f.label}Hint`) : t('dashboard.locked')}
                  </span>
                </span>
              </>
            )
            return granted ? (
              <Link key={key} href={f.href as Route} className={cn(tile, 'active:bg-muted')}>
                {body}
              </Link>
            ) : (
              <div key={key} className={cn(tile, 'border-dashed opacity-70')} aria-disabled>
                {body}
              </div>
            )
          })}
          {isAdminRole(me.role) && (
            <Link href="/admin" className={cn(tile, 'active:bg-muted')}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                <Shield aria-hidden className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block leading-tight font-semibold">{t('nav.admin')}</span>
                <span className="line-clamp-2 text-xs text-faint">{t('profile.adminHint')}</span>
              </span>
            </Link>
          )}
        </nav>

        <Link
          href="/guide"
          className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-3.5 active:bg-muted"
        >
          <BookOpen aria-hidden className="size-5 shrink-0 text-la" />
          <span className="flex-1 font-medium">{t('guide.open')}</span>
          <ChevronRight aria-hidden className="size-5 text-faint" />
        </Link>

        {features.length === 0 && (
          <Card className="py-6 text-center">
            <p className="font-semibold">{t('dashboard.noFeatures')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.noFeaturesHint')}</p>
          </Card>
        )}

        {/* Columns instead of a grid, so cards of different heights pack without gaps. */}
        <div className="gap-5 md:columns-2 [&>section]:mb-5 [&>section]:break-inside-avoid">
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
