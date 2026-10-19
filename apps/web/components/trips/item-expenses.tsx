'use client'

import { ExpenseDto, POOL_ID, type TripMemberDto } from '@iplan/contracts'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Plus } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { CATEGORY_COLORS } from '@/components/charts/donut'
import { apiFetch } from '@/lib/api-client'
import { expenseKeys, fmt } from '@/lib/expenses'

/**
 * The costs recorded for one plan item, each a tap away from its edit page,
 * plus "add" — so what was spent at a place can be checked and corrected there.
 */
export function ItemExpenses({
  tripId,
  itemId,
  members,
  canEdit,
  fromItemPage = false,
}: {
  tripId: string
  itemId: string
  members: readonly TripMemberDto[]
  canEdit: boolean
  /** On the item's own page: the cost pages come back here and say so. */
  fromItemPage?: boolean
}) {
  const from = fromItemPage ? 'from=item' : ''
  const t = useTranslations()
  // Same cache as the trip's expense list, so it is instant when that list is loaded.
  const { data } = useQuery({
    queryKey: expenseKeys.list(tripId),
    queryFn: () => apiFetch(`/api/trips/${tripId}/expenses`, { schema: z.array(ExpenseDto) }),
  })
  const mine = (data ?? []).filter((e) => e.itemId === itemId)
  const nameOf = (id: string) =>
    id === POOL_ID
      ? t('expenses.form.pool')
      : (members.find((m) => m.userId === id)?.name ?? t('expenses.form.formerMember'))
  if (!canEdit && mine.length === 0) return null

  return (
    <section className="space-y-2">
      <p className="text-sm font-semibold">{t('itemSheet.costs')}</p>
      {mine.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {mine.map((e) => (
            <li key={e.id}>
              <Link
                href={`/trips/${tripId}/expenses/${e.id}${from && `?${from}`}` as Route}
                className="flex min-h-14 items-center gap-3 px-3 py-2 active:bg-muted"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[e.category] ?? '#94a3b8' }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t('itemSheet.paidBy', { name: nameOf(e.paidBy) })}
                  </span>
                </span>
                <span className="num shrink-0">{fmt(e.amountMinor, e.currency)}</span>
                {canEdit && <ChevronRight aria-hidden className="size-4 shrink-0 text-faint" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <Link
          href={`/trips/${tripId}/expenses/new?item=${itemId}${from && `&${from}`}` as Route}
          className="flex min-h-11 items-center gap-2 rounded-2xl border border-dashed px-3 text-sm font-medium text-primary active:bg-muted"
        >
          <Plus aria-hidden className="size-4" />
          {t('itemSheet.expense')}
        </Link>
      )}
    </section>
  )
}
