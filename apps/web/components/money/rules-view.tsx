'use client'

import type { FinanceCategoryDto, RecurringKind, RecurringRuleDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'
import { formatMonth } from '@iplan/i18n'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, SectionTitle } from '@/components/ui/card'
import { MonthField } from '@/components/ui/date-fields'
import { Field, Input, Select } from '@/components/ui/field'
import { ApiError } from '@/lib/api-error'
import { fmt } from '@/lib/expenses'
import { useCategories, useCategoryName, useFinanceMutations, useRules } from '@/lib/finance'
import { useFormat } from '@/lib/use-format'
import { confirmDialog } from '@/lib/confirm'

const KINDS: RecurringKind[] = ['income', 'deduction', 'fixed']
const KIND_LABEL = { income: 'income', deduction: 'deductions', fixed: 'fixed' } as const

export function RulesView({
  initialRules,
  initialCategories,
  thisMonth,
}: {
  initialRules: RecurringRuleDto[]
  initialCategories: FinanceCategoryDto[]
  thisMonth: string
}) {
  const t = useTranslations()
  const f = useFormat()
  const categoryName = useCategoryName()
  const { data: rules } = useRules(initialRules)
  const { data: categories } = useCategories(initialCategories)
  const { saveRule, deleteRule } = useFinanceMutations()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function onSubmit(event: FormEvent<HTMLFormElement>, rule?: RecurringRuleDto) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (k: string) => String(form.get(k) ?? '').trim()
    saveRule.mutate(
      {
        ...(rule && { id: rule.id }),
        input: {
          kind: value('kind') as RecurringKind,
          name: value('name'),
          amount: value('amount').replaceAll(',', ''),
          startMonth: value('startMonth'),
          endMonth: value('endMonth') || null,
          categoryId: value('categoryId') || null,
        },
      },
      {
        onSuccess: () => {
          setEditing(null)
          setErrors({})
        },
        onError: (e) => setErrors(e instanceof ApiError ? e.fields : {}),
      },
    )
  }

  const form = (rule?: RecurringRuleDto) => (
    <Card>
      <form onSubmit={(e) => onSubmit(e, rule)} className="space-y-3">
        <Field label={t('finance.rule.kind')}>
          <Select name="kind" defaultValue={rule?.kind ?? 'fixed'}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`finance.${KIND_LABEL[k]}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('finance.rule.name')} error={errors.name}>
          noLeadingSpace <Input name="name" required maxLength={60} defaultValue={rule?.name} />
        </Field>
        <Field label={t('finance.rule.amount')} error={errors.amount}>
          <Input
            name="amount"
            inputMode="decimal"
            defaultValue={rule ? toDecimalString(money(BigInt(rule.amountMinor), 'THB')) : ''}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('finance.rule.start')} error={errors.startMonth}>
            <MonthField
              name="startMonth"
              label={t('finance.rule.start')}
              defaultValue={rule?.startMonth ?? thisMonth}
            />
          </Field>
          <Field
            label={t('finance.rule.end')}
            hint={t('finance.rule.endHint')}
            error={errors.endMonth}
          >
            <MonthField
              name="endMonth"
              label={t('finance.rule.end')}
              defaultValue={rule?.endMonth ?? undefined}
              optional
            />
          </Field>
        </div>
        <Field label={t('finance.rule.category')} error={errors.categoryId}>
          <Select name="categoryId" defaultValue={rule?.categoryId ?? ''}>
            <option value="">{t('finance.rule.none')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryName(c.name)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setEditing(null)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={saveRule.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Card>
  )

  return (
    <div className="space-y-5 px-4">
      {KINDS.map((kind) => (
        <section key={kind}>
          <SectionTitle>{t(`finance.${KIND_LABEL[kind]}`)}</SectionTitle>
          <ul className="space-y-2">
            {rules
              .filter((r) => r.kind === kind)
              .map((rule) =>
                editing === rule.id ? (
                  <li key={rule.id}>{form(rule)}</li>
                ) : (
                  <li key={rule.id}>
                    <Card className="flex items-center gap-3 p-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setEditing(rule.id)}
                      >
                        <span className="block truncate font-medium">{rule.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatMonth(rule.startMonth, { locale: f.locale })}
                          {rule.endMonth &&
                            ` – ${formatMonth(rule.endMonth, { locale: f.locale })}`}
                        </span>
                      </button>
                      <span className="font-semibold tabular-nums">
                        {fmt(rule.amountMinor, 'THB')}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger"
                        aria-label={t('common.delete')}
                        onClick={async () =>
                          (await confirmDialog(t('common.confirmDelete'), { danger: true })) &&
                          deleteRule.mutate(rule.id)
                        }
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </Card>
                  </li>
                ),
              )}
          </ul>
        </section>
      ))}
      {editing === 'new' ? (
        form()
      ) : (
        <Button variant="secondary" size="lg" onClick={() => setEditing('new')}>
          <Plus aria-hidden className="size-5" />
          {t('finance.rule.add')}
        </Button>
      )}
    </div>
  )
}
