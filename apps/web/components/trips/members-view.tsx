'use client'

import { InviteDto, type InviteRole, type TripDetailDto } from '@iplan/contracts'
import { formatDate } from '@iplan/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, Share, Trash2, UserMinus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'
import { tripKeys, useTrip } from '@/lib/trips'
import { useFormat } from '@/lib/use-format'

const inviteKey = (tripId: string) => ['trips', tripId, 'invites'] as const

export function MembersView({
  trip: initialTrip,
  initialInvites,
  meId,
}: {
  trip: TripDetailDto
  initialInvites: InviteDto[]
  meId: string
}) {
  const t = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const client = useQueryClient()
  const { data: trip } = useTrip(initialTrip.id, initialTrip)
  const canInvite = trip.role !== 'viewer'
  const isOwner = trip.role === 'owner'
  const [inviteRole, setInviteRole] = useState<InviteRole>('editor')
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const invites = useQuery({
    queryKey: inviteKey(trip.id),
    queryFn: () => apiFetch(`/api/trips/${trip.id}/invites`, { schema: z.array(InviteDto) }),
    initialData: initialInvites,
    enabled: canInvite,
  })
  const onError = (e: unknown) =>
    setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`))
  const refreshTrip = () => client.invalidateQueries({ queryKey: tripKeys.trip(trip.id) })

  const createInvite = useMutation({
    mutationFn: () =>
      apiFetch(`/api/trips/${trip.id}/invites`, {
        method: 'POST',
        body: { role: inviteRole, expiresInDays: 7 },
        schema: InviteDto,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: inviteKey(trip.id) }),
    onError,
  })
  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: inviteKey(trip.id) }),
    onError,
  })
  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: InviteRole }) =>
      apiFetch(`/api/trips/${trip.id}/members/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: { role },
      }),
    onSuccess: refreshTrip,
    onError,
  })
  const remove = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/trips/${trip.id}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
    onError,
  })

  const linkFor = (token: string) => `${window.location.origin}/join/${token}`

  async function share(invite: InviteDto) {
    const url = linkFor(invite.token)
    if (navigator.share) {
      await navigator.share({ title: trip.name, url }).catch(() => undefined)
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(invite.id)
  }

  async function copy(invite: InviteDto) {
    await navigator.clipboard.writeText(linkFor(invite.token))
    setCopied(invite.id)
  }

  async function removeMember(userId: string, name: string) {
    const leaving = userId === meId
    if (!window.confirm(leaving ? t('members.confirmLeave') : t('members.confirmRemove', { name })))
      return
    await remove.mutateAsync(userId)
    if (leaving) {
      router.replace('/')
      router.refresh()
    } else await refreshTrip()
  }

  return (
    <div className="space-y-6 px-4">
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <section>
        <SectionTitle>{t('trips.members', { count: trip.members.length })}</SectionTitle>
        <ul className="divide-y rounded-2xl border bg-card">
          {trip.members.map((member) => {
            const me = member.userId === meId
            return (
              <li key={member.userId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary">
                  {member.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {member.name}
                    {me && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({t('members.you')})
                      </span>
                    )}
                  </p>
                  {!(isOwner && member.role !== 'owner') && (
                    <p className="text-sm text-muted-foreground">
                      {t(`trips.role.${member.role}`)}
                    </p>
                  )}
                </div>
                {isOwner && member.role !== 'owner' && (
                  <Select
                    aria-label={t('members.changeRole')}
                    className="w-28 shrink-0 px-2"
                    value={member.role}
                    onChange={(e) =>
                      setRole.mutate({ userId: member.userId, role: e.target.value as InviteRole })
                    }
                  >
                    <option value="editor">{t('trips.role.editor')}</option>
                    <option value="viewer">{t('trips.role.viewer')}</option>
                  </Select>
                )}
                {member.role !== 'owner' && (isOwner || me) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger"
                    aria-label={me ? t('members.leave') : t('members.remove')}
                    onClick={() => removeMember(member.userId, member.name)}
                  >
                    <UserMinus aria-hidden className="size-5" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {canInvite && (
        <section>
          <SectionTitle>{t('members.invites')}</SectionTitle>
          <Card className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('members.invitesHint')}</p>
            <div className="flex gap-2">
              <Select
                aria-label={t('members.inviteAs')}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as InviteRole)}
              >
                <option value="editor">{t('trips.role.editor')}</option>
                <option value="viewer">{t('trips.role.viewer')}</option>
              </Select>
              <Button
                className="shrink-0"
                onClick={() => createInvite.mutate()}
                disabled={createInvite.isPending}
              >
                <Link2 aria-hidden className="size-4" />
                {t('members.createInvite')}
              </Button>
            </div>
          </Card>
          <ul className="mt-3 space-y-2">
            {invites.data.length === 0 && (
              <li className="px-1 text-sm text-muted-foreground">{t('members.noInvites')}</li>
            )}
            {invites.data.map((invite) => (
              <li key={invite.id}>
                <Card className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium">{t(`trips.role.${invite.role}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('members.expires', {
                        date: formatDate(invite.expiresAt.slice(0, 10), { locale: f.locale }),
                      })}
                      {' · '}
                      {t('members.used', { count: invite.useCount })}
                    </p>
                  </div>
                  <p className="truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                    /join/{invite.token}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="secondary" onClick={() => share(invite)}>
                      <Share aria-hidden className="size-4" />
                      {t('members.share')}
                    </Button>
                    <Button variant="secondary" onClick={() => copy(invite)}>
                      <Copy aria-hidden className="size-4" />
                      {copied === invite.id ? t('members.copied') : t('members.copy')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-danger"
                      onClick={() => revoke.mutate(invite.id)}
                    >
                      <Trash2 aria-hidden className="size-4" />
                      {t('members.revoke')}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
