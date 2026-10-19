'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'

type Pending = string | null

export function LoginButtons({
  googleEnabled,
  devUsers,
  next,
}: {
  googleEnabled: boolean
  /** null when dev login is off; otherwise everyone in the local database. */
  devUsers: { name: string; email: string; status: string }[] | null
  /** Where to go after signing in (already validated as a local path). */
  next: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(which: Exclude<Pending, null>, action: () => Promise<void>) {
    setPending(which)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`))
      setPending(null)
    }
  }

  const google = () =>
    run('google', async () => {
      const { url } = await apiFetch('/api/auth/sign-in/social', {
        method: 'POST',
        body: { provider: 'google', callbackURL: next },
        schema: z.object({ url: z.url() }),
      })
      window.location.href = url
    })

  const dev = (email: string) =>
    run(email, async () => {
      await apiFetch('/api/dev/login', { method: 'POST', body: { email } })
      router.replace(next as Route)
      router.refresh()
    })

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Button size="lg" onClick={google} disabled={!googleEnabled || pending !== null}>
        {t('login.google')}
      </Button>
      {!googleEnabled && (
        <p className="text-center text-xs text-muted-foreground">{t('login.googleMissing')}</p>
      )}
      {devUsers && (
        <div className="space-y-2 rounded-2xl border border-dashed p-3">
          <p className="text-center text-xs font-medium text-muted-foreground">
            {t('login.devTitle')}
          </p>
          {devUsers.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">{t('login.devEmpty')}</p>
          )}
          {devUsers.map((u) => (
            <Button
              key={u.email}
              size="lg"
              variant="secondary"
              onClick={() => dev(u.email)}
              disabled={pending !== null}
              className="justify-between font-medium"
            >
              <span className="truncate">{u.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {u.status === 'pending' ? t('login.devPending') : u.email}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
