import { LedgerDetailDto } from '@iplan/contracts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LedgerView } from '@/components/shared/ledger-view'
import { orNotFound } from '@/lib/or-not-found'
import { getMe, serverApi } from '@/lib/server-api'

export const metadata: Metadata = { title: 'Shared money' }

export default async function LedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ ledgerId: string }>
  searchParams: Promise<{ tab?: string; month?: string }>
}) {
  const [{ ledgerId }, query] = await Promise.all([params, searchParams])
  const me = await getMe()
  if (!me) notFound()
  const ledger = await orNotFound(serverApi(`/api/ledgers/${ledgerId}`, LedgerDetailDto))
  return (
    <LedgerView key={ledger.id} initial={ledger} meId={me.id} tab={query.tab} month={query.month} />
  )
}
