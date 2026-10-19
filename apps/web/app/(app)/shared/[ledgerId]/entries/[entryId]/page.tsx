import { LedgerDetailDto, LedgerEntryDto } from '@iplan/contracts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EntryForm } from '@/components/shared/entry-form'
import { SettlementView } from '@/components/shared/settlement-view'
import { orNotFound } from '@/lib/or-not-found'
import { getMe, serverApi } from '@/lib/server-api'

export const metadata: Metadata = { title: 'Shared cost' }

export default async function EntryPage({
  params,
}: {
  params: Promise<{ ledgerId: string; entryId: string }>
}) {
  const { ledgerId, entryId } = await params
  const me = await getMe()
  if (!me) notFound()
  const [ledger, entry] = await orNotFound(
    Promise.all([
      serverApi(`/api/ledgers/${ledgerId}`, LedgerDetailDto),
      serverApi(`/api/ledger-entries/${entryId}`, LedgerEntryDto),
    ]),
  )
  if (entry.ledgerId !== ledger.id) notFound()
  return entry.kind === 'settlement' ? (
    <SettlementView ledger={ledger} entry={entry} meId={me.id} />
  ) : (
    <EntryForm ledger={ledger} meId={me.id} entry={entry} />
  )
}
