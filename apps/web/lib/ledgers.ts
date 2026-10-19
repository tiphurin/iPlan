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
