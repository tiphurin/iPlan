'use client'

import type { FinanceCategoryDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SectionTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { useCategories, useCategoryName, useFinanceMutations } from '@/lib/finance'

export function CategoriesView({ initial }: { initial: FinanceCategoryDto[] }) {
  const t = useTranslations()
  const categoryName = useCategoryName()
  const { data: categories } = useCategories(initial)
  const { saveCategory, deleteCategory } = useFinanceMutations()
  const [color, setColor] = useState('#0ea5e9')
  /** Problems by category id, or by "new-<kind>" for the add form. */
  const [errors, setErrors] = useState<Record<string, string>>({})
  const setError = (key: string, message: string | null) =>
    setErrors((all) => {
      const rest = Object.fromEntries(Object.entries(all).filter(([k]) => k !== key))
      return message ? { ...rest, [key]: message } : rest
    })
  const messageOf = (e: unknown) =>
    e instanceof ApiError
      ? (Object.values(e.fields)[0] ?? t(`errors.${e.code}`))
      : t('errors.INTERNAL')

  function saveBudget(category: FinanceCategoryDto, value: string) {
    const budget = value.replaceAll(',', '').trim() || null
    const current = category.budgetMinor
      ? toDecimalString(money(BigInt(category.budgetMinor), 'THB'))
      : null
    if (budget === current) return setError(category.id, null)
    saveCategory.mutate(
      {
        id: category.id,
        input: { kind: category.kind, name: category.name, color: category.color, budget },
      },
      {
        onSuccess: () => setError(category.id, null),
        onError: (e) => setError(category.id, messageOf(e)),
      },
    )
  }

  function add(event: FormEvent<HTMLFormElement>, kind: 'income' | 'expense') {
    event.preventDefault()
    const form = event.currentTarget
    const name = String(new FormData(form).get('name') ?? '').trim()
    if (!name) return
    saveCategory.mutate(
      { input: { kind, name, color } },
      {
        onSuccess: () => {
          form.reset()
          setError(`new-${kind}`, null)
        },
        onError: (e) => setError(`new-${kind}`, messageOf(e)),
      },
    )
  }

  return (
    <div className="space-y-5 px-4">
      {(['expense', 'income'] as const).map((kind) => (
        <section key={kind}>
          <SectionTitle>
            {kind === 'expense' ? t('finance.totalExpenses') : t('finance.totalIncome')}
          </SectionTitle>
          <ul className="divide-y rounded-2xl border bg-card">
            {categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <li key={c.id} className="px-4 py-2">
                  <div className="flex min-h-8 items-center gap-3">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{categoryName(c.name)}</span>
                    {kind === 'expense' && (
                      <Input
                        aria-label={t('finance.category.budget')}
                        placeholder={t('finance.category.noBudget')}
                        inputMode="decimal"
                        className="w-28 text-right tabular-nums"
                        defaultValue={
                          c.budgetMinor ? toDecimalString(money(BigInt(c.budgetMinor), 'THB')) : ''
                        }
                        onBlur={(e) => saveBudget(c, e.target.value)}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-danger"
                      aria-label={t('common.delete')}
                      onClick={() =>
                        window.confirm(t('common.confirmDelete')) && deleteCategory.mutate(c.id)
                      }
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                  {errors[c.id] && (
                    <p role="alert" className="mt-1 text-right text-sm text-danger">
                      {errors[c.id]}
                    </p>
                  )}
                </li>
              ))}
            <li className="p-2">
              <form onSubmit={(e) => add(e, kind)} className="flex gap-2">
                <input
                  type="color"
                  aria-label="colour"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-11 w-11 shrink-0 rounded-xl border bg-card p-1"
                />
                <Input name="name" maxLength={40} placeholder={t('finance.category.name')} />
                <Button type="submit" size="icon" aria-label={t('finance.category.add')}>
                  <Plus aria-hidden className="size-5" />
                </Button>
              </form>
              {errors[`new-${kind}`] && (
                <p role="alert" className="mt-1 px-2 text-sm text-danger">
                  {errors[`new-${kind}`]}
                </p>
              )}
            </li>
          </ul>
        </section>
      ))}
    </div>
  )
}
