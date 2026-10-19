'use client'

import {
  type AdminStatsDto,
  AdminUserDto,
  AdminUserListDto,
  AuditListDto,
  FEATURE_KEYS,
  type FeatureKey,
  UserGroupDto,
} from '@iplan/contracts'
import { formatDate } from '@iplan/i18n'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Search, ShieldBan, ShieldCheck, Trash2, UserCheck } from 'lucide-react'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Avatar } from '@/components/avatar'
import { FEATURES } from '@/features'
import { Input, Select } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { useFormat } from '@/lib/use-format'

type Tab = 'approvals' | 'users' | 'groups' | 'overview' | 'audit'
const TABS: readonly Tab[] = ['approvals', 'users', 'groups', 'overview', 'audit']
const PAGE = 25
const GB = 1024 ** 3

function bytes(n: number) {
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(n / 1024)} KB`
}

export function AdminView({ stats, meId }: { stats: AdminStatsDto; meId: string }) {
  const t = useTranslations('admin')
  const [tab, setTab] = useState<Tab>(stats.pendingUsers > 0 ? 'approvals' : 'users')
  return (
    <div className="space-y-4 px-4">
      <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((k) => (
          <Chip key={k} pressed={tab === k} onClick={() => setTab(k)}>
            {t(`tabs.${k}`)}
            {k === 'approvals' && stats.pendingUsers > 0 && (
              <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-white">
                {stats.pendingUsers}
              </span>
            )}
          </Chip>
        ))}
      </nav>
      {tab === 'approvals' && <Users meId={meId} status="pending" />}
      {tab === 'users' && <Users meId={meId} status="active" />}
      {tab === 'groups' && <Groups />}
      {tab === 'overview' && <Overview stats={stats} />}
      {tab === 'audit' && <Audit />}
    </div>
  )
}

function Overview({ stats }: { stats: AdminStatsDto }) {
  const t = useTranslations('admin.stats')
  const counts = [
    'users',
    'newUsers30d',
    'suspendedUsers',
    'pendingUsers',
    'activeSessions',
    'trips',
    'tripItems',
    'expenses',
    'transactions',
    'attachments',
  ] as const
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {counts.map((k) => (
          <Card key={k} className="p-3">
            <p className="text-2xl font-bold tabular-nums">{stats[k].toLocaleString('en')}</p>
            <p className="text-xs text-muted-foreground">{t(k)}</p>
          </Card>
        ))}
      </div>
      {(
        [
          ['storageBytes', stats.storageBytes, 10 * GB],
          ['databaseBytes', stats.databaseBytes, 0.5 * GB],
        ] as const
      ).map(([k, used, limit]) => (
        <Card key={k}>
          <div className="mb-2 flex justify-between text-sm">
            <span>{t(k)}</span>
            <span className="tabular-nums">{bytes(used)}</span>
          </div>
          <Progress value={used / limit} />
        </Card>
      ))}
    </div>
  )
}

function useGroups() {
  return useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: () => apiFetch('/api/admin/groups', { schema: z.array(UserGroupDto) }),
  })
}

function Users({ meId, status }: { meId: string; status: 'pending' | 'active' }) {
  const t = useTranslations()
  const f = useFormat()
  const client = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const { data: groups } = useGroups()
  const { data } = useQuery({
    queryKey: ['admin', 'users', status, q, page],
    queryFn: () =>
      apiFetch(
        `/api/admin/users?status=${status}&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
        { schema: AdminUserListDto },
      ),
    placeholderData: keepPreviousData,
  })
  const update = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      role?: 'user' | 'admin'
      status?: 'pending' | 'active'
      groupIds?: string[]
      banned?: boolean
      banReason?: string | null
    }) =>
      apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body,
        schema: AdminUserDto,
      }),
    onSuccess: () => {
      setError(null)
      return client.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e) => setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`)),
  })
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE))

  function suspend(user: AdminUserDto) {
    if (user.banned) return update.mutate({ id: user.id, banned: false })
    const reason = window.prompt(t('admin.reason'))
    if (reason === null) return
    update.mutate({ id: user.id, banned: true, banReason: reason || null })
  }

  return (
    <div className="space-y-3">
      {status === 'pending' && (
        <p className="text-sm text-muted-foreground">{t('admin.approvalsHint')}</p>
      )}
      <label className="relative block">
        <Search
          aria-hidden
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder={t('admin.search')}
          className="pl-9"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {data?.users.length === 0 && (
        <Card className="py-8 text-center text-muted-foreground">
          {status === 'pending' ? t('admin.noPending') : t('admin.empty')}
        </Card>
      )}
      <ul className="grid gap-2 lg:grid-cols-2">
        {data?.users.map((u) => (
          <li key={u.id}>
            <UserCard
              user={u}
              me={u.id === meId}
              groups={groups ?? []}
              busy={update.isPending}
              joined={t('admin.joined', {
                date: formatDate(u.createdAt.slice(0, 10), { locale: f.locale }),
              })}
              onApprove={(groupIds) => update.mutate({ id: u.id, status: 'active', groupIds })}
              onGroups={(groupIds) => update.mutate({ id: u.id, groupIds })}
              onRole={(role) => update.mutate({ id: u.id, role })}
              onSuspend={() => suspend(u)}
            />
          </li>
        ))}
      </ul>
      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
  )
}

function UserCard({
  user: u,
  me,
  groups,
  busy,
  joined,
  onApprove,
  onGroups,
  onRole,
  onSuspend,
}: {
  user: AdminUserDto
  me: boolean
  groups: UserGroupDto[]
  busy: boolean
  joined: string
  onApprove: (groupIds: string[]) => void
  onGroups: (groupIds: string[]) => void
  onRole: (role: 'user' | 'admin') => void
  onSuspend: () => void
}) {
  const t = useTranslations()
  const pending = u.status === 'pending'
  // Pending users: pick groups first, then approve. Active users: chips save at once.
  const [picked, setPicked] = useState<string[]>(u.groupIds)
  const selected = pending ? picked : u.groupIds
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id]
    if (pending) setPicked(next)
    else onGroups(next)
  }
  return (
    <Card className={cn('space-y-3 p-3', u.banned && 'border-danger/40 bg-danger/5')}>
      <div className="flex items-center gap-3">
        <Avatar name={u.name} image={u.image} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {u.name}
            {me && <span className="ml-1 text-xs text-muted-foreground">({t('admin.you')})</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          <p className="text-xs text-faint">
            {joined} · {t('admin.trips', { count: u.trips })}
          </p>
        </div>
      </div>
      {u.banned && (
        <p className="text-xs font-medium text-danger">
          {t('admin.suspended')}
          {u.banReason && `: ${u.banReason}`}
        </p>
      )}
      {u.role !== 'admin' && (
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">{t('admin.groups')}</p>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <Chip
                key={g.id}
                pressed={selected.includes(g.id)}
                disabled={busy}
                onClick={() => toggle(g.id)}
              >
                {selected.includes(g.id) && <Check aria-hidden className="size-4" />}
                {g.name}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {pending ? (
          <Button
            variant="primary"
            className="flex-1"
            disabled={busy || me}
            onClick={() => onApprove(picked)}
          >
            <UserCheck aria-hidden className="size-4" />
            {t('admin.approve')}
          </Button>
        ) : (
          <Select
            aria-label={t('admin.role')}
            value={u.role}
            disabled={me}
            className="w-auto flex-1"
            onChange={(e) => onRole(e.target.value as 'user' | 'admin')}
          >
            <option value="user">{t('admin.roleUser')}</option>
            <option value="admin">{t('admin.roleAdmin')}</option>
          </Select>
        )}
        <Button
          variant={u.banned ? 'secondary' : 'outline'}
          className={cn('shrink-0', !u.banned && 'text-danger')}
          disabled={me || busy}
          onClick={onSuspend}
        >
          {u.banned ? (
            <ShieldCheck aria-hidden className="size-4" />
          ) : (
            <ShieldBan aria-hidden className="size-4" />
          )}
          {u.banned ? t('admin.unsuspend') : pending ? t('admin.reject') : t('admin.suspend')}
        </Button>
      </div>
    </Card>
  )
}

function Groups() {
  const t = useTranslations()
  const client = useQueryClient()
  const { data: groups } = useGroups()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const onError = (e: unknown) =>
    setError(t(`errors.${e instanceof ApiError ? e.code : 'INTERNAL'}`))
  const refresh = () => {
    setError(null)
    return client.invalidateQueries({ queryKey: ['admin'] })
  }
  const create = useMutation({
    mutationFn: (body: { name: string; features: FeatureKey[] }) =>
      apiFetch('/api/admin/groups', { method: 'POST', body, schema: UserGroupDto }),
    onSuccess: () => {
      setName('')
      return refresh()
    },
    onError,
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; features?: FeatureKey[] }) =>
      apiFetch(`/api/admin/groups/${id}`, { method: 'PATCH', body, schema: UserGroupDto }),
    onSuccess: refresh,
    onError,
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/groups/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError,
  })

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('admin.groupsHint')}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="grid gap-2 lg:grid-cols-2">
        {groups?.map((g) => (
          <li key={g.id}>
            <Card className="space-y-3 p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">{g.name}</p>
                  <p className="text-xs text-faint">
                    {t('admin.memberCount', { count: g.memberCount })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.delete')}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(t('admin.confirmDeleteGroup', { name: g.name }))) {
                      remove.mutate(g.id)
                    }
                  }}
                >
                  <Trash2 aria-hidden className="size-5 text-danger" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FEATURE_KEYS.map((key) => {
                  const on = g.features.includes(key)
                  return (
                    <Chip
                      key={key}
                      pressed={on}
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({
                          id: g.id,
                          features: on ? g.features.filter((k) => k !== key) : [...g.features, key],
                        })
                      }
                    >
                      {on && <Check aria-hidden className="size-4" />}
                      {t(`features.${FEATURES[key].label}`)}
                    </Chip>
                  )
                })}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) create.mutate({ name: name.trim(), features: [] })
        }}
      >
        <Input
          placeholder={t('admin.newGroup')}
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="solid" className="shrink-0" disabled={create.isPending}>
          <Plus aria-hidden className="size-4" />
          {t('common.add')}
        </Button>
      </form>
    </div>
  )
}

function Audit() {
  const t = useTranslations('admin')
  const f = useFormat()
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const { data } = useQuery({
    queryKey: ['admin', 'audit', page, action],
    queryFn: () =>
      apiFetch(
        `/api/admin/audit?page=${page}${action ? `&action=${encodeURIComponent(action)}` : ''}`,
        {
          schema: AuditListDto,
        },
      ),
    placeholderData: keepPreviousData,
  })
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE))
  return (
    <div className="space-y-3">
      <Input
        placeholder={t('filter')}
        value={action}
        onChange={(e) => {
          setAction(e.target.value)
          setPage(1)
        }}
      />
      {data?.entries.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
      <ul className="divide-y rounded-2xl border bg-card">
        {data?.entries.map((e) => (
          <li key={e.id} className="px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <code className="text-sm font-semibold">{e.action}</code>
              <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {f.day(e.createdAt.slice(0, 10))} {f.time(e.createdAt, 'Asia/Bangkok')}
              </time>
            </div>
            <p className="text-xs text-muted-foreground">
              {e.actorName ?? '—'} · {e.entityType}
              {e.entityId && ` ${e.entityId.slice(0, 8)}`}
            </p>
            {e.data && Object.keys(e.data).length > 0 && (
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                {JSON.stringify(e.data)}
              </p>
            )}
          </li>
        ))}
      </ul>
      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
  )
}

function Pager({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (p: number) => void
}) {
  const t = useTranslations('admin')
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t('prev')}
      </Button>
      <span className="text-sm text-muted-foreground">{t('page', { page, pages })}</span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t('next')}
      </Button>
    </div>
  )
}
