'use client'

import { type AdminStatsDto, AdminUserDto, AdminUserListDto, AuditListDto } from '@iplan/contracts'
import { formatDate } from '@iplan/i18n'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ShieldBan, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { apiFetch } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import { useFormat } from '@/lib/use-format'

type Tab = 'overview' | 'users' | 'audit'
const PAGE = 25
const GB = 1024 ** 3

function bytes(n: number) {
  if (n >= GB) return `${(n / GB).toFixed(2)} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(n / 1024)} KB`
}

export function AdminView({ stats, meId }: { stats: AdminStatsDto; meId: string }) {
  const t = useTranslations('admin')
  const [tab, setTab] = useState<Tab>('overview')
  return (
    <div className="space-y-4 px-4">
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {(['overview', 'users', 'audit'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              'min-h-11 rounded-lg text-sm font-medium',
              tab === k ? 'bg-card shadow-sm' : 'text-muted-foreground',
            )}
          >
            {t(k)}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview stats={stats} />}
      {tab === 'users' && <Users meId={meId} />}
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
    'activeSessions',
    'trips',
    'tripItems',
    'expenses',
    'transactions',
    'attachments',
  ] as const
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
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

function Users({ meId }: { meId: string }) {
  const t = useTranslations()
  const f = useFormat()
  const client = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const { data } = useQuery({
    queryKey: ['admin', 'users', q, page],
    queryFn: () =>
      apiFetch(`/api/admin/users?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`, {
        schema: AdminUserListDto,
      }),
    placeholderData: keepPreviousData,
  })
  const update = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string
      role?: 'user' | 'admin'
      banned?: boolean
      banReason?: string | null
    }) =>
      apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body,
        schema: AdminUserDto,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin'] }),
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
      <ul className="space-y-2">
        {data?.users.map((u) => (
          <li key={u.id}>
            <Card className={cn('space-y-2 p-3', u.banned && 'border-danger/40 bg-danger/5')}>
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary">
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {u.name}
                    {u.id === meId && (
                      <span className="ml-1 text-xs text-muted-foreground">({t('admin.you')})</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.joined', {
                      date: formatDate(u.createdAt.slice(0, 10), { locale: f.locale }),
                    })}{' '}
                    · {t('admin.trips', { count: u.trips })}
                  </p>
                </div>
              </div>
              {u.banned && (
                <p className="text-xs font-medium text-danger">
                  {t('admin.suspended')}
                  {u.banReason && `: ${u.banReason}`}
                </p>
              )}
              <div className="flex gap-2">
                <Select
                  aria-label={t('admin.role')}
                  value={u.role}
                  disabled={u.id === meId}
                  onChange={(e) =>
                    update.mutate({ id: u.id, role: e.target.value as 'user' | 'admin' })
                  }
                >
                  <option value="user">{t('admin.roleUser')}</option>
                  <option value="admin">{t('admin.roleAdmin')}</option>
                </Select>
                <Button
                  variant={u.banned ? 'secondary' : 'outline'}
                  className={cn('shrink-0', !u.banned && 'text-danger')}
                  disabled={u.id === meId || update.isPending}
                  onClick={() => suspend(u)}
                >
                  {u.banned ? (
                    <ShieldCheck aria-hidden className="size-4" />
                  ) : (
                    <ShieldBan aria-hidden className="size-4" />
                  )}
                  {u.banned ? t('admin.unsuspend') : t('admin.suspend')}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Pager page={page} pages={pages} onPage={setPage} />
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
