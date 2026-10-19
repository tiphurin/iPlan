'use client'

import {
  LedgerDetailDto,
  LedgerDto,
  LedgerEntryDto,
  type LedgerEntryInput,
  type LedgerInput,
  type SettleInput,
} from '@iplan/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
    addMember: useMutation({
      mutationFn: (email: string) =>
        apiFetch(`/api/ledgers/${ledgerId}/members`, {
          method: 'POST',
          body: { email },
          schema: LedgerDto,
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
