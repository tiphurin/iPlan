'use client'

import { Plus } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { useLedgerMutations } from '@/lib/ledgers'

export function NewLedger() {
  const t = useTranslations()
  const router = useRouter()
  const { create } = useLedgerMutations()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        try {
          const ledger = await create.mutateAsync({ name: name.trim(), currency: 'THB' })
          router.push(`/shared/${ledger.id}` as Route)
        } catch (err) {
          setError(t(`errors.${err instanceof ApiError ? err.code : 'INTERNAL'}`))
        }
      }}
    >
      <div className="flex gap-2">
        <Input
          value={name}
          maxLength={80}
          placeholder={t('shared.newPlaceholder')}
          aria-label={t('shared.newName')}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="solid" className="shrink-0" disabled={create.isPending}>
          <Plus aria-hidden className="size-4" />
          {t('shared.create')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  )
}
