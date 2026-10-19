'use client'

import {
  ExpenseDto,
  type ExpenseInput,
  ExpenseSummaryDto,
  type TripMoneySettingsInput,
} from '@iplan/contracts'
import { money } from '@iplan/core'
import { formatMoney } from '@iplan/i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiFetch } from './api-client'
import { tripKeys } from './trips'

export const expenseKeys = {
  list: (tripId: string) => ['trips', tripId, 'expenses'] as const,
  summary: (tripId: string) => ['trips', tripId, 'expenses', 'summary'] as const,
}

/** "฿1,500.25" from a minor-unit string. */
export function fmt(minor: string | bigint, currency: string): string {
  return formatMoney(money(BigInt(minor), currency))
}

export function useExpenses(tripId: string, initialData: ExpenseDto[]) {
  return useQuery({
    queryKey: expenseKeys.list(tripId),
    queryFn: () => apiFetch(`/api/trips/${tripId}/expenses`, { schema: z.array(ExpenseDto) }),
    initialData,
  })
}

export function useExpenseSummary(tripId: string, initialData: ExpenseSummaryDto) {
  return useQuery({
    queryKey: expenseKeys.summary(tripId),
    queryFn: () => apiFetch(`/api/trips/${tripId}/expenses/summary`, { schema: ExpenseSummaryDto }),
    initialData,
  })
}

export function useExpenseMutations(tripId: string) {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: expenseKeys.list(tripId) })
  return {
    save: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: ExpenseInput }) =>
        id
          ? apiFetch(`/api/expenses/${id}`, { method: 'PUT', body: input, schema: ExpenseDto })
          : apiFetch(`/api/trips/${tripId}/expenses`, {
              method: 'POST',
              body: input,
              schema: ExpenseDto,
            }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiFetch(`/api/expenses/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
    settings: useMutation({
      mutationFn: (input: TripMoneySettingsInput) =>
        apiFetch(`/api/trips/${tripId}/money`, { method: 'PATCH', body: input }),
      onSuccess: () =>
        Promise.all([refresh(), client.invalidateQueries({ queryKey: tripKeys.trip(tripId) })]),
    }),
  }
}
