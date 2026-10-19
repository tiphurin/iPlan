'use client'

import {
  type FinanceCategoryDto,
  FinanceCategoryDto as CategorySchema,
  type FinanceCategoryInput,
  MonthDto,
  type OverrideInput,
  RecurringRuleDto,
  type RecurringRuleInput,
  TransactionDto,
  type TransactionInput,
} from '@iplan/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { apiFetch } from './api-client'

export const financeKeys = {
  all: ['finance'] as const,
  month: (month: string) => ['finance', 'month', month] as const,
  rules: ['finance', 'rules'] as const,
  categories: ['finance', 'categories'] as const,
}

export function useMonth(month: string, initialData: MonthDto) {
  return useQuery({
    queryKey: financeKeys.month(month),
    queryFn: () => apiFetch(`/api/finance/months/${month}`, { schema: MonthDto }),
    initialData,
  })
}

export function useRules(initialData: RecurringRuleDto[]) {
  return useQuery({
    queryKey: financeKeys.rules,
    queryFn: () => apiFetch('/api/finance/rules', { schema: z.array(RecurringRuleDto) }),
    initialData,
  })
}

export function useCategories(initialData: FinanceCategoryDto[]) {
  return useQuery({
    queryKey: financeKeys.categories,
    queryFn: () => apiFetch('/api/finance/categories', { schema: z.array(CategorySchema) }),
    initialData,
  })
}

/** Every change can move totals, so all finance queries refresh. */
export function useFinanceMutations() {
  const client = useQueryClient()
  const onSuccess = () => client.invalidateQueries({ queryKey: financeKeys.all })
  return {
    saveRule: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: RecurringRuleInput }) =>
        id
          ? apiFetch(`/api/finance/rules/${id}`, {
              method: 'PUT',
              body: input,
              schema: RecurringRuleDto,
            })
          : apiFetch('/api/finance/rules', {
              method: 'POST',
              body: input,
              schema: RecurringRuleDto,
            }),
      onSuccess,
    }),
    deleteRule: useMutation({
      mutationFn: (id: string) => apiFetch(`/api/finance/rules/${id}`, { method: 'DELETE' }),
      onSuccess,
    }),
    setOverride: useMutation({
      mutationFn: ({
        ruleId,
        month,
        input,
      }: {
        ruleId: string
        month: string
        input: OverrideInput
      }) =>
        apiFetch(`/api/finance/rules/${ruleId}/months/${month}`, { method: 'PUT', body: input }),
      onSuccess,
    }),
    clearOverride: useMutation({
      mutationFn: ({ ruleId, month }: { ruleId: string; month: string }) =>
        apiFetch(`/api/finance/rules/${ruleId}/months/${month}`, { method: 'DELETE' }),
      onSuccess,
    }),
    saveTransaction: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: TransactionInput }) =>
        id
          ? apiFetch(`/api/finance/transactions/${id}`, {
              method: 'PUT',
              body: input,
              schema: TransactionDto,
            })
          : apiFetch('/api/finance/transactions', {
              method: 'POST',
              body: input,
              schema: TransactionDto,
            }),
      onSuccess,
    }),
    deleteTransaction: useMutation({
      mutationFn: (id: string) => apiFetch(`/api/finance/transactions/${id}`, { method: 'DELETE' }),
      onSuccess,
    }),
    saveCategory: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: FinanceCategoryInput }) =>
        id
          ? apiFetch(`/api/finance/categories/${id}`, {
              method: 'PUT',
              body: input,
              schema: CategorySchema,
            })
          : apiFetch('/api/finance/categories', {
              method: 'POST',
              body: input,
              schema: CategorySchema,
            }),
      onSuccess,
    }),
    deleteCategory: useMutation({
      mutationFn: (id: string) => apiFetch(`/api/finance/categories/${id}`, { method: 'DELETE' }),
      onSuccess,
    }),
  }
}

/** Built-in category names are stored as "default:<key>" and translated here. */
export function useCategoryName() {
  const t = useTranslations('finance.defaultCategories')
  return (name: string) => (name.startsWith('default:') ? t(name.slice(8)) : name)
}
