import { isAdminRole } from '@iplan/contracts'
import { AdminStatsDto } from '@iplan/contracts'
import { resolveLocale } from '@iplan/i18n'
import { BookOpen, KeyRound, Shield, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/page-header'
import { ListGroup } from '@/components/ui/card'
import { ListRow } from '@/components/ui/list-row'
import { FEATURES } from '@/features'
import { getMe, serverApi } from '@/lib/server-api'
import { THEME_COOKIE, resolveTheme } from '@/lib/theme'
import { AvatarEditor } from './avatar-editor'
import { NicknameForm, ProfileForm } from './profile-form'

export const metadata: Metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const [t, me, locale, store] = await Promise.all([
    getTranslations(),
    getMe(),
    getLocale(),
    cookies(),
  ])
  if (!me) return null
  const pending = isAdminRole(me.role)
    ? (await serverApi('/api/admin/stats', AdminStatsDto)).pendingUsers
    : 0
  return (
    <>
      <PageHeader title={t('nav.profile')} />
      <div className="space-y-6 px-4">
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <AvatarEditor name={me.name} image={me.image} />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold">
              {me.name}
              {me.nickname && (
                <span className="ml-1.5 text-base font-medium text-muted-foreground">
                  ({me.nickname})
                </span>
              )}
            </p>
            <p className="truncate text-sm text-muted-foreground">{me.email}</p>
            <p className="mt-1 flex flex-wrap gap-1.5">
              {isAdminRole(me.role) && (
                <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
                  {me.role === 'superadmin' ? t('admin.roleSuperadmin') : t('admin.roleAdmin')}
                </span>
              )}
              {me.features.map((key) => (
                <span
                  key={key}
                  className="rounded-full border px-2 py-0.5 text-xs"
                  style={{ borderColor: FEATURES[key].color, color: FEATURES[key].color }}
                >
                  {t(`features.${FEATURES[key].label}`)}
                </span>
              ))}
            </p>
          </div>
        </div>

        <NicknameForm initial={me.nickname} />

        <ListGroup>
          {me.role === 'superadmin' && (
            <ListRow
              href="/change-password"
              icon={<KeyRound aria-hidden className="size-5 text-l5" />}
              title={t('password.title')}
            />
          )}
          <ListRow
            href="/guide"
            icon={<BookOpen aria-hidden className="size-5 text-la" />}
            title={t('guide.open')}
          />
          {isAdminRole(me.role) && (
            <ListRow
              href="/admin"
              icon={<Shield aria-hidden className="size-5 text-l1" />}
              title={t('settings.adminLink')}
              meta={t('profile.adminHint')}
              trailing={
                pending > 0 ? (
                  <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
                    {t('profile.pending', { count: pending })}
                  </span>
                ) : undefined
              }
            />
          )}
          <ListRow
            href="/showcase"
            icon={<Sparkles aria-hidden className="size-5 text-l3" />}
            title={t('settings.showcase')}
          />
        </ListGroup>

        <ProfileForm
          locale={resolveLocale(locale)}
          theme={resolveTheme(store.get(THEME_COOKIE)?.value)}
        />
      </div>
    </>
  )
}
