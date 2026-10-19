'use client'

import {
  LedgerDetailDto,
  LedgerDto,
  LedgerEntryDto,
  type LedgerEntryInput,
  type LedgerInput,
  type MonthStatusInput,
  PendingInviteDto,
  type SettleInput,
} from '@iplan/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiFetch } from './api-client'

export const ledgerKeys = {
  all: ['ledgers'] as const,
  detail: (id: string) => ['ledgers', id] as const,
}

export function useLedger(id: string, initialData: LedgerDetailDto) {
  return useQuery({
    queryKey: ledgerKeys.detail(id),
    queryFn: () => apiFetch(`/api/ledgers/${id}`, { schema: LedgerDetailDto }),
    initialData,
  })
}

/** Any change moves balances, so every ledger query refreshes. */
export function useLedgerMutations(ledgerId?: string) {
  const client = useQueryClient()
  const onSuccess = () => client.invalidateQueries({ queryKey: ledgerKeys.all })
  return {
    create: useMutation({
      mutationFn: (body: LedgerInput) =>
        apiFetch('/api/ledgers', { method: 'POST', body, schema: LedgerDto }),
      onSuccess,
    }),
    rename: useMutation({
      mutationFn: (body: LedgerInput) =>
        apiFetch(`/api/ledgers/${ledgerId}`, { method: 'PATCH', body, schema: LedgerDto }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: () => apiFetch(`/api/ledgers/${ledgerId}`, { method: 'DELETE' }),
      onSuccess,
    }),
    invite: useMutation({
      mutationFn: (userId: string) =>
        apiFetch(`/api/ledgers/${ledgerId}/invites`, {
          method: 'POST',
          body: { userId },
          schema: z.array(PendingInviteDto),
        }),
      onSuccess,
    }),
    removeMember: useMutation({
      mutationFn: (userId: string) =>
        apiFetch(`/api/ledgers/${ledgerId}/members/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
        }),
      onSuccess,
    }),
    addEntry: useMutation({
      mutationFn: (body: LedgerEntryInput) =>
        apiFetch(`/api/ledgers/${ledgerId}/entries`, {
          method: 'POST',
          body,
          schema: LedgerEntryDto,
        }),
      onSuccess,
    }),
    updateEntry: useMutation({
      mutationFn: ({ id, ...body }: LedgerEntryInput & { id: string }) =>
        apiFetch(`/api/ledger-entries/${id}`, { method: 'PUT', body, schema: LedgerEntryDto }),
      onSuccess,
    }),
    deleteEntry: useMutation({
      mutationFn: (id: string) => apiFetch(`/api/ledger-entries/${id}`, { method: 'DELETE' }),
      onSuccess,
    }),
    monthStatus: useMutation({
      mutationFn: ({ month, ...body }: MonthStatusInput & { month: string }) =>
        apiFetch(`/api/ledgers/${ledgerId}/months/${month}/status`, {
          method: 'PUT',
          body,
          schema: LedgerDetailDto,
        }),
      onSuccess,
    }),
    entryPaid: useMutation({
      mutationFn: ({ id, paidBack }: { id: string; paidBack: boolean }) =>
        apiFetch(`/api/ledger-entries/${id}/paid`, {
          method: 'PUT',
          body: { paidBack },
          schema: LedgerEntryDto,
        }),
      onSuccess,
    }),
    settle: useMutation({
      mutationFn: (body: SettleInput) =>
        apiFetch(`/api/ledgers/${ledgerId}/settlements`, {
          method: 'POST',
          body,
          schema: LedgerEntryDto,
        }),
      onSuccess,
    }),
  }
}

/** Colour per shared-cost category, for dots and chips. */
export const LEDGER_CATEGORY_COLORS: Record<string, string> = {
  food: '#ef7c1c',
  groceries: '#00a84d',
  home: '#996cac',
  bills: '#eab308',
  transport: '#0090d2',
  fun: '#ec4899',
  travel: '#0052a4',
  other: '#9aa3ae',
}

export type WalletTab = 'overview' | 'months'

/** "?tab=" from the URL; anything unknown falls back to the overview. */
export function parseWalletTab(value: unknown): WalletTab {
  return value === 'months' ? 'months' : 'overview'
}

/** "YYYY-MM-DD" that is a real calendar date, else null. */
export function validDateKey(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

/** The month an entry belongs to: expenses by date, settlements by what they settle. */
export function entryMonth(
  entry: Pick<LedgerEntryDto, 'date' | 'settlesMonth' | 'settlesEntryId'>,
  byId: ReadonlyMap<string, Pick<LedgerEntryDto, 'date'>>,
): string {
  return (
    entry.settlesMonth ??
    (entry.settlesEntryId ? byId.get(entry.settlesEntryId)?.date.slice(0, 7) : undefined) ??
    entry.date.slice(0, 7)
  )
}

/** Months the switcher can show, oldest first: every month with data plus the current one. */
export function walletMonths(withData: readonly string[], current: string): string[] {
  return [...new Set([...withData, current])].sort()
}

/** The current month when it has data, else the latest month that does, else the current one. */
export function defaultWalletMonth(withData: readonly string[], current: string): string {
  if (withData.includes(current)) return current
  return [...withData].sort().at(-1) ?? current
}

/** "?month=" when it is one of the switcher's months, else the default. */
export function pickWalletMonth(
  value: unknown,
  withData: readonly string[],
  current: string,
): string {
  return typeof value === 'string' && walletMonths(withData, current).includes(value)
    ? value
    : defaultWalletMonth(withData, current)
}

/** The previous (-1) or next (+1) month in the switcher's list, or null at either end. */
export function stepWalletMonth(
  months: readonly string[],
  month: string,
  delta: -1 | 1,
): string | null {
  const index = months.indexOf(month)
  if (index < 0) return null
  return months[index + delta] ?? null
}

/** Entries grouped by day, newest day first; within a day, newest added first. */
export function groupByDay<T extends Pick<LedgerEntryDto, 'date' | 'createdAt'>>(
  entries: readonly T[],
): { date: string; entries: T[] }[] {
  const sorted = [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
  const days: { date: string; entries: T[] }[] = []
  for (const entry of sorted) {
    const last = days.at(-1)
    if (last?.date === entry.date) last.entries.push(entry)
    else days.push({ date: entry.date, entries: [entry] })
  }
  return days
}

/** Date to pre-fill for a new cost: today in the current month, else the 1st of the month. */
export function newEntryDate(month: string, today: string): string {
  return today.startsWith(`${month}-`) ? today : `${month}-01`
}

/** Back to a wallet's monthly summary on a given month. */
export function walletMonthHref(ledgerId: string, month: string): string {
  return `/shared/${ledgerId}?tab=months&month=${month}`
}
