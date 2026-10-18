import { InvitePreviewDto } from '@iplan/contracts'
import { type Locale, formatDateRange } from '@iplan/i18n'
import type { Route } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ApiError } from '@/lib/api-error'
import { serverApi } from '@/lib/server-api'
import { JoinButton } from './join-button'

/** Landing page of a shared invite link; sends signed-out visitors to sign in first. */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [t, locale] = await Promise.all([getTranslations(), getLocale()])
  let preview: InvitePreviewDto | null = null
  try {
    preview = await serverApi(`/api/join/${encodeURIComponent(token)}`, InvitePreviewDto)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`)
    }
    if (!(error instanceof ApiError)) throw error
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-[max(2rem,env(safe-area-inset-top))]">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG icon */}
      <img src="/icon.svg" alt="" className="mb-6 size-14 rounded-2xl shadow-lg" />
      <p className="text-sm font-medium text-muted-foreground">{t('join.title')}</p>
      {preview ? (
        <>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{preview.tripName}</h1>
          <p className="mt-1 text-muted-foreground">
            {formatDateRange(preview.startDate, preview.endDate, { locale: locale as Locale })}
          </p>
          <Card className="mt-6 space-y-1">
            {preview.invitedBy && <p>{t('join.invitedBy', { name: preview.invitedBy })}</p>}
            <p className="text-muted-foreground">
              {t('join.as', { role: t(`trips.role.${preview.role}`) })}
            </p>
          </Card>
          <div className="mt-6">
            {preview.currentRole ? (
              <>
                <p className="mb-3 text-center text-sm text-muted-foreground">
                  {t('join.already', { role: t(`trips.role.${preview.currentRole}`) })}
                </p>
                <Link
                  href={`/trips/${preview.tripId}` as Route}
                  className={buttonVariants({ size: 'lg' })}
                >
                  {t('join.open')}
                </Link>
              </>
            ) : (
              <JoinButton token={token} />
            )}
          </div>
        </>
      ) : (
        <Card className="mt-4 text-danger">{t('join.invalid')}</Card>
      )}
    </main>
  )
}
