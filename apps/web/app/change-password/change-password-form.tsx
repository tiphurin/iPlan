'use client'

import { MeDto } from '@iplan/contracts'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { BackLink } from '@/components/back-link'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'

export function ChangePasswordForm({ required }: { required: boolean }) {
  const t = useTranslations()
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const mismatch = again.length > 0 && again !== next

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (mismatch) return
        setBusy(true)
        setError(null)
        setFields({})
        try {
          await apiFetch('/api/me/password', {
            method: 'POST',
            body: { currentPassword: current, newPassword: next },
            schema: MeDto,
          })
          router.replace('/')
          router.refresh()
        } catch (err) {
          if (err instanceof ApiError) {
            setFields(err.fields ?? {})
            setError(t(`errors.${err.code}`))
          } else setError(t('errors.INTERNAL'))
          setBusy(false)
        }
      }}
    >
      {!required && <BackLink href="/profile" label={t('nav.profile')} />}
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Field label={t('password.current')} error={fields.currentPassword}>
        <Input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <Field label={t('password.new')} hint={t('password.rule')} error={fields.newPassword}>
        <Input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </Field>
      <Field label={t('password.again')} error={mismatch ? t('password.mismatch') : undefined}>
        <Input
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
      </Field>
      <Button
        type="submit"
        size="lg"
        disabled={busy || !current || next.length < 8 || mismatch || again !== next}
      >
        {t('password.save')}
      </Button>
    </form>
  )
}
