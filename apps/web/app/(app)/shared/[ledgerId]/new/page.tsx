import { LedgerDetailDto } from '@iplan/contracts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EntryForm } from '@/components/shared/entry-form'
import { orNotFound } from '@/lib/or-not-found'
import { getMe, serverApi } from '@/lib/server-api'

export const metadata: Metadata = { title: 'Add a shared cost' }

export default async function NewEntryPage({ params }: { params: Promise<{ ledgerId: string }> }) {
  const { ledgerId } = await params
  const me = await getMe()
  if (!me) notFound()
  const ledger = await orNotFound(serverApi(`/api/ledgers/${ledgerId}`, LedgerDetailDto))
  return <EntryForm ledger={ledger} meId={me.id} />
}
