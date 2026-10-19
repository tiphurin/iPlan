import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { safeNext } from '@/lib/safe-next'
import { z } from 'zod'
import { getMe, serverApi } from '@/lib/server-api'
import { LanguageToggle } from '@/components/language-toggle'
import { LoginButtons } from './login-buttons'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const next = safeNext((await searchParams).next)
  if (await getMe()) redirect(next)
  const t = await getTranslations('login')
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  const devLoginEnabled = process.env.DEV_LOGIN_ENABLED === 'true'
  const devUsers = devLoginEnabled
    ? await serverApi(
        '/api/dev/users',
        z.array(
          z.object({ name: z.string(), email: z.string(), status: z.string(), role: z.string() }),
        ),
      ).catch(() => [])
    : []
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div>
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG icon */}
          <img src="/icon.svg" alt="" className="size-16 rounded-2xl shadow-lg" />
          <LanguageToggle />
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t('subtitle')}</p>
      </div>
      <LoginButtons
        googleEnabled={googleEnabled}
        devUsers={devLoginEnabled ? devUsers : null}
        next={next}
      />
    </main>
  )
}
