'use client'

import { AcceptInviteDto } from '@iplan/contracts'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'

export function JoinButton({ token }: { token: string }) {
  const t = useTranslations()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join() {
    setPending(true)
    setError(null)
    try {
      const { tripId } = await apiFetch(`/api/join/${encodeURIComponent(token)}`, {
        method: 'POST',
        schema: AcceptInviteDto,
      })
      router.replace(`/trips/${tripId}` as Route)
      router.refresh()
    } catch (e) {
      setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`))
      setPending(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Button size="lg" onClick={join} disabled={pending}>
        {t('join.accept')}
      </Button>
    </div>
  )
}
