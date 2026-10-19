'use client'

import { LogOut, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'

export function PendingActions() {
  const t = useTranslations()
  const router = useRouter()
  const [busy, start] = useTransition()
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        variant="solid"
        disabled={busy}
        onClick={() => start(() => router.refresh())}
      >
        <RefreshCw aria-hidden className="size-5" />
        {t('pending.check')}
      </Button>
      <Button
        size="lg"
        variant="ghost"
        disabled={busy}
        onClick={() =>
          start(async () => {
            await apiFetch('/api/auth/sign-out', { method: 'POST', body: {} }).catch(
              () => undefined,
            )
            router.replace('/login')
            router.refresh()
          })
        }
      >
        <LogOut aria-hidden className="size-5" />
        {t('settings.signOut')}
      </Button>
    </div>
  )
}
