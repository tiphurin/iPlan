import { AdminLedgerDto, LedgerDto, isAdminRole } from '@iplan/contracts'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { Avatar } from '@/components/avatar'
import { PageHeader } from '@/components/page-header'
import { BalanceLine } from '@/components/shared/balance-line'
import { NewLedgerButton } from '@/components/shared/new-ledger'
import { Card } from '@/components/ui/card'
import { getMe, serverApi } from '@/lib/server-api'
import { ScopeTabs } from '@/components/scope-tabs'

export const metadata: Metadata = { title: 'Shared money' }

export default async function SharedPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const [t, ledgers, me, { scope: rawScope }] = await Promise.all([
    getTranslations(),
    serverApi('/api/ledgers', z.array(LedgerDto)),
    getMe(),
    searchParams,
  ])
  const admin = me ? isAdminRole(me.role) : false
  const scope = admin && rawScope === 'all' ? 'all' : 'mine'
  const everyone =
    scope === 'all' ? await serverApi('/api/admin/ledgers', z.array(AdminLedgerDto)) : []
  return (
    <>
      <PageHeader
        title={t('features.shared')}
        subtitle={t('shared.subtitle')}
        action={scope === 'mine' ? <NewLedgerButton /> : undefined}
      />
      <div className="space-y-6 px-4">
        {admin && (
          <ScopeTabs
            base="/shared"
            scope={scope}
            labels={{ mine: t('scope.mine'), all: t('scope.allWallets') }}
          />
        )}
        {scope === 'all' && (
          <ul className="grid gap-2 md:grid-cols-2">
            {everyone.map((ledger) => (
              <li key={ledger.id}>
                <Link
                  href={`/shared/${ledger.id}` as Route}
                  className="block rounded-2xl border bg-card px-4 py-3 active:bg-muted"
                >
                  <span className="block truncate font-semibold">{ledger.name}</span>
                  <span className="block truncate text-xs text-faint">
                    {t('scope.owner', { name: ledger.ownerName ?? '—' })} ·{' '}
                    {t('shared.memberCount', { count: ledger.memberCount })} ·{' '}
                    {t('shared.entryCount', { count: ledger.entryCount })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {scope === 'mine' && ledgers.length === 0 && (
          <Card className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="font-display text-xl font-semibold">{t('shared.empty')}</p>
            <p className="text-sm text-muted-foreground">{t('shared.emptyHint')}</p>
            <NewLedgerButton className="mt-3 px-5" />
          </Card>
        )}
        {scope === 'mine' && ledgers.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {ledgers.map((ledger) => (
              <li key={ledger.id}>
                <Link
                  href={`/shared/${ledger.id}` as Route}
                  className="block rounded-2xl border bg-card p-4 active:bg-muted"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-display text-xl font-bold">{ledger.name}</p>
                    <span className="flex -space-x-2">
                      {ledger.members.slice(0, 4).map((m) => (
                        <Avatar key={m.userId} name={m.name} image={m.image} size={30} />
                      ))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">
                    <BalanceLine minor={ledger.myBalanceMinor} currency={ledger.currency} />
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    {t('shared.entryCount', { count: ledger.entryCount })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
