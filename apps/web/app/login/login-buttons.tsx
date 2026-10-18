'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'

type Pending = 'google' | 'dev@iplan.local' | 'friend@iplan.local' | null

export function LoginButtons({
  googleEnabled,
  devLoginEnabled,
}: {
  googleEnabled: boolean
  devLoginEnabled: boolean
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
        body: { provider: 'google', callbackURL: '/' },
        schema: z.object({ url: z.url() }),
      })
      window.location.href = url
    })

  const dev = (email: 'dev@iplan.local' | 'friend@iplan.local') =>
    run(email, async () => {
      await apiFetch('/api/dev/login', { method: 'POST', body: { email } })
      router.replace('/')
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
      {devLoginEnabled && (
        <div className="space-y-2 rounded-2xl border border-dashed p-3">
          <p className="text-center text-xs font-medium text-muted-foreground">
            {t('login.devTitle')}
          </p>
          <Button
            size="lg"
            variant="outline"
            onClick={() => dev('dev@iplan.local')}
            disabled={pending !== null}
          >
            {t('login.devOwner')}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => dev('friend@iplan.local')}
            disabled={pending !== null}
          >
            {t('login.devFriend')}
          </Button>
        </div>
      )}
    </div>
  )
}
