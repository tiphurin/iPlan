'use client'

import type { LedgerDetailDto, LedgerEntryDto } from '@iplan/contracts'
import { ArrowRight, Trash2 } from 'lucide-react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BackLink } from '@/components/back-link'
import { Button } from '@/components/ui/button'
import { Hero } from '@/components/ui/card'
import { fmt } from '@/lib/expenses'
import { entryMonth, useLedgerMutations, walletMonthHref } from '@/lib/ledgers'
import { useFormat } from '@/lib/use-format'

/** A recorded pay-back; it can only be deleted (then the debt comes back). */
export function SettlementView({
  ledger,
  entry,
  meId,
}: {
  ledger: LedgerDetailDto
  entry: LedgerEntryDto
  meId: string
}) {
  const t = useTranslations()
  const f = useFormat()
  const router = useRouter()
  const m = useLedgerMutations(ledger.id)
  const back = walletMonthHref(
    ledger.id,
    entryMonth(entry, new Map(ledger.entries.map((e) => [e.id, e]))),
  ) as Route
  const nameOf = (id: string) =>
    id === meId ? t('shared.you') : (ledger.members.find((x) => x.userId === id)?.name ?? '—')
  return (
    <>
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:pt-6">
        <BackLink history href={back} label={ledger.name} />
      </div>
      <div className="space-y-4 px-4 md:max-w-xl">
        <Hero tone="green">
          <p className="text-sm opacity-90">{f.day(entry.date)}</p>
          <p className="my-1 font-display text-[34px] leading-none font-bold">
            {fmt(entry.amountMinor, ledger.currency)}
          </p>
          <p className="flex items-center gap-1.5 text-[15px]">
            {nameOf(entry.paidBy)}
            <ArrowRight aria-hidden className="size-4" />
            {nameOf(entry.shares[0]?.userId ?? '')}
          </p>
          {entry.note && <p className="mt-2 text-sm opacity-90">{entry.note}</p>}
        </Hero>
        <Button
          variant="ghost"
          size="lg"
          className="text-danger"
          onClick={async () => {
            if (!window.confirm(t('shared.confirmUndoSettle'))) return
            await m.deleteEntry.mutateAsync(entry.id)
            router.replace(back)
            router.refresh()
          }}
        >
          <Trash2 aria-hidden className="size-4" />
          {t('shared.undoSettle')}
        </Button>
      </div>
    </>
  )
}
