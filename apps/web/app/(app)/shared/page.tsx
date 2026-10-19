import { LedgerDto } from '@iplan/contracts'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { Avatar } from '@/components/avatar'
import { PageHeader } from '@/components/page-header'
import { BalanceLine } from '@/components/shared/balance-line'
import { NewLedger } from '@/components/shared/new-ledger'
import { Card, SectionTitle } from '@/components/ui/card'
import { serverApi } from '@/lib/server-api'

export const metadata: Metadata = { title: 'Shared money' }

export default async function SharedPage() {
  const [t, ledgers] = await Promise.all([
    getTranslations(),
    serverApi('/api/ledgers', z.array(LedgerDto)),
  ])
  return (
    <>
      <PageHeader title={t('features.shared')} subtitle={t('shared.subtitle')} />
      <div className="space-y-6 px-4">
        {ledgers.length === 0 && (
          <Card className="space-y-1 py-6 text-center">
            <p className="font-display text-xl font-semibold">{t('shared.empty')}</p>
            <p className="text-sm text-muted-foreground">{t('shared.emptyHint')}</p>
          </Card>
        )}
        {ledgers.length > 0 && (
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
        <section>
          <SectionTitle>{t('shared.newTitle')}</SectionTitle>
          <NewLedger />
        </section>
      </div>
    </>
  )
}
