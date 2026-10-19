'use client'

import { AcceptInvitationDto, type FeatureKey, type InvitationDto } from '@iplan/contracts'
import { Check, Map as MapIcon, Wallet, X } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'

/** Invitations into trips and shared wallets, answered right on the home screen. */
export function InvitationsCard({
  initial,
  features,
}: {
  initial: InvitationDto[]
  features: readonly FeatureKey[]
}) {
  const t = useTranslations()
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function answer(inv: InvitationDto, accept: boolean) {
    setBusy(inv.id)
    setError(null)
    try {
      if (accept) {
        const joined = await apiFetch(`/api/invitations/${inv.id}/accept`, {
          method: 'POST',
          schema: AcceptInvitationDto,
        })
        router.push(
          (joined.kind === 'trip'
            ? `/trips/${joined.targetId}`
            : `/shared/${joined.targetId}`) as Route,
        )
      } else {
        await apiFetch(`/api/invitations/${inv.id}`, { method: 'DELETE' })
        setItems((list) => list.filter((x) => x.id !== inv.id))
      }
      router.refresh()
    } catch (e) {
      setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`))
      // The trip or wallet was deleted (or the invitation withdrawn): drop the card.
      if (e instanceof ApiError && (e.code === 'INVITATION_GONE' || e.code === 'NOT_FOUND')) {
        setItems((list) => list.filter((x) => x.id !== inv.id))
      }
    } finally {
      setBusy(null)
    }
  }

  if (items.length === 0) return null
  return (
    <section className="space-y-2 rounded-hero border-2 border-[#996cac]/50 bg-card p-4">
      <h2 className="text-lg font-bold">{t('invitations.title', { count: items.length })}</h2>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {items.map((inv) => {
          const Icon = inv.kind === 'trip' ? MapIcon : Wallet
          // Joining needs the feature; until an admin grants it, say so instead of failing.
          const allowed = features.includes(inv.kind === 'trip' ? 'trips' : 'shared')
          return (
            <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted p-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: inv.kind === 'trip' ? 'var(--l2)' : 'var(--l5)' }}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{inv.targetName}</span>
                <span className="block text-xs text-muted-foreground">
                  {t(inv.kind === 'trip' ? 'invitations.trip' : 'invitations.wallet', {
                    name: inv.invitedByName ?? '—',
                  })}
                </span>
              </span>
              <span className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => answer(inv, false)}
                  aria-label={t('invitations.decline')}
                >
                  <X aria-hidden className="size-4" />
                </Button>
                {allowed && (
                  <Button disabled={busy !== null} onClick={() => answer(inv, true)}>
                    <Check aria-hidden className="size-4" />
                    {t('invitations.accept')}
                  </Button>
                )}
              </span>
              {!allowed && (
                <p className="w-full text-xs font-medium text-warning">
                  {t('invitations.needAccess')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
