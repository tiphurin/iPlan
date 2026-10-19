'use client'

import { Upload } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'

export function ImportTrip() {
  const t = useTranslations()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File) {
    setPending(true)
    setError(null)
    try {
      const body: unknown = JSON.parse(await file.text())
      const { tripId } = await apiFetch('/api/trips/import', {
        method: 'POST',
        body,
        schema: z.object({ tripId: z.uuid() }),
      })
      router.push(`/trips/${tripId}` as Route)
      router.refresh()
    } catch (e) {
      setError(
        e instanceof ApiError
          ? (Object.values(e.fields)[0] ?? t(`errors.${e.code}`))
          : t('errors.VALIDATION_FAILED'),
      )
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="lg"
        disabled={pending}
        onClick={() => input.current?.click()}
      >
        <Upload aria-hidden className="size-4" />
        {pending ? t('backup.importing') : t('backup.import')}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t('backup.importHint')}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void onFile(file)
        }}
      />
    </div>
  )
}
