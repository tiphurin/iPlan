'use client'

import type { FinanceCategoryDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SectionTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { useCategories, useCategoryName, useFinanceMutations } from '@/lib/finance'

export function CategoriesView({ initial }: { initial: FinanceCategoryDto[] }) {
  const t = useTranslations()
  const categoryName = useCategoryName()
  const { data: categories } = useCategories(initial)
  const { saveCategory, deleteCategory } = useFinanceMutations()
  const [color, setColor] = useState('#0ea5e9')

  function saveBudget(category: FinanceCategoryDto, value: string) {
    const budget = value.replaceAll(',', '').trim() || null
    const current = category.budgetMinor
      ? toDecimalString(money(BigInt(category.budgetMinor), 'THB'))
      : null
    if (budget === current) return
    saveCategory.mutate({
      id: category.id,
      input: { kind: category.kind, name: category.name, color: category.color, budget },
    })
  }

  function add(event: FormEvent<HTMLFormElement>, kind: 'income' | 'expense') {
    event.preventDefault()
    const form = event.currentTarget
    const name = String(new FormData(form).get('name') ?? '').trim()
    if (!name) return
    saveCategory.mutate({ input: { kind, name, color } }, { onSuccess: () => form.reset() })
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
                <li key={c.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
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
            </li>
          </ul>
        </section>
      ))}
    </div>
  )
}
