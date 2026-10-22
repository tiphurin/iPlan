'use client'

import type { ExpenseDto, ExpenseSummaryDto, MonthDto, PoolDto } from '@iplan/contracts'
import { money, toDecimalString } from '@iplan/core'

interface Cell {
  value: string | number | null
  type?: StringConstructor | NumberConstructor
  format?: string
  fontWeight?: 'bold'
}

const NUM = '#,##0.00'
const head = (labels: string[]): Cell[] =>
  labels.map((value) => ({ value, fontWeight: 'bold' as const }))
const text = (value: string | null | undefined): Cell => ({ value: value ?? '', type: String })
/** Real numbers (major units) so totals can be summed in Excel. */
const amount = (minor: string | bigint, currency: string): Cell => ({
  value: Number(toDecimalString(money(BigInt(minor), currency))),
  type: Number,
  format: currency === 'KRW' || currency === 'JPY' ? '#,##0' : NUM,
})

async function save(
  sheets: { sheet: string; data: Cell[][]; columns?: { width: number }[] }[],
  fileName: string,
) {
  // Loaded only when someone taps "Excel".
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(
    sheets.map((s) => ({ ...s, stickyRowsCount: 1 })) as Parameters<typeof writeXlsxFile>[0],
  ).toFile(fileName)
}

export interface TripExcelLabels {
  expenses: string
  people: string
  settle: string
  columns: {
    date: string
    title: string
    category: string
    amount: string
    currency: string
    rate: string
    base: string
    paidBy: string
    split: string
    name: string
    paid: string
    share: string
    net: string
    from: string
    to: string
  }
  category: (key: string) => string
  pool: string
  /** The "Pool" sheet: who put in what, each person's part, totals and the rule. */
  poolSheet: {
    title: string
    note: string
    percent: string
    rule: string
    mode: string
    putIn: string
    spent: string
    left: string
    byMember: string
  }
}

export async function exportTripExcel(
  tripName: string,
  expenses: ExpenseDto[],
  summary: ExpenseSummaryDto,
  members: { userId: string; name: string }[],
  l: TripExcelLabels,
  pool?: PoolDto,
) {
  const base = summary.baseCurrency
  const c = l.columns
  const party = (id: string, name: string) => (id === 'pool' ? l.pool : name)
  const ps = l.poolSheet
  const poolSheet =
    pool && (pool.contributions.length > 0 || BigInt(pool.spentBaseMinor) > 0n)
      ? [
          {
            sheet: ps.title,
            columns: [
              { width: 12 },
              { width: 20 },
              { width: 12 },
              { width: 8 },
              { width: 10 },
              { width: 14 },
              { width: 24 },
            ],
            data: [
              head([c.date, c.name, c.amount, c.currency, c.rate, `${c.base} (${base})`, ps.note]),
              ...pool.contributions.map((x) => [
                text(x.date),
                text(x.name),
                amount(x.amountMinor, x.currency),
                text(x.currency),
                { value: Number(x.fxRate), type: Number, format: '0.0000' } as Cell,
                amount(x.baseAmountMinor, base),
                text(x.note ?? ''),
              ]),
              [text('')],
              head([ps.byMember, `${ps.putIn} (${base})`, ps.percent]),
              ...pool.byMember.map((m) => [
                text(m.name),
                amount(m.contributedBaseMinor, base),
                { value: m.percentBp / 10000, type: Number, format: '0.0%' } as Cell,
              ]),
              [text('')],
              [text(ps.rule), text(ps.mode)],
              [text(ps.putIn), amount(pool.totalBaseMinor, base)],
              [text(ps.spent), amount(pool.spentBaseMinor, base)],
              [text(ps.left), amount(pool.leftoverBaseMinor, base)],
            ],
          },
        ]
      : []
  await save(
    [
      {
        sheet: l.expenses,
        columns: [
          { width: 12 },
          { width: 28 },
          { width: 14 },
          { width: 12 },
          { width: 8 },
          { width: 10 },
          { width: 14 },
          { width: 16 },
          { width: 10 },
          ...members.map(() => ({ width: 14 })),
        ],
        data: [
          head([
            c.date,
            c.title,
            c.category,
            c.amount,
            c.currency,
            c.rate,
            `${c.base} (${base})`,
            c.paidBy,
            c.split,
            ...members.map((m) => `${m.name} (${base})`),
          ]),
          ...expenses.map((e) => [
            text(e.dayDate),
            text(e.title),
            text(l.category(e.category)),
            amount(e.amountMinor, e.currency),
            text(e.currency),
            { value: Number(e.fxRate), type: Number, format: '0.0000' } as Cell,
            amount(e.baseAmountMinor, base),
            text(party(e.paidBy, e.paidByName)),
            text(e.splitMode),
            ...members.map((m) => {
              const share = e.shares.find((s) => s.userId === m.userId)
              return share ? amount(share.baseAmountMinor, base) : text('')
            }),
          ]),
        ],
      },
      {
        sheet: l.people,
        columns: [{ width: 20 }, { width: 14 }, { width: 14 }, { width: 14 }],
        data: [
          head([c.name, c.paid, c.share, c.net]),
          ...summary.parties.map((p) => [
            text(party(p.id, p.name)),
            amount(p.paidMinor, base),
            amount(p.shareMinor, base),
            amount(p.netMinor, base),
          ]),
        ],
      },
      {
        sheet: l.settle,
        columns: [{ width: 20 }, { width: 20 }, { width: 14 }],
        data: [
          head([c.from, c.to, `${c.amount} (${base})`]),
          ...summary.transfers.map((t) => [
            text(party(t.from, t.fromName)),
            text(party(t.to, t.toName)),
            amount(t.amountMinor, base),
          ]),
        ],
      },
      ...poolSheet,
    ],
    `${tripName}.xlsx`,
  )
}

export interface MonthExcelLabels {
  summary: string
  lines: string
  oneOff: string
  rows: { key: keyof MonthDto['summary']; label: string }[]
  columns: {
    type: string
    name: string
    planned: string
    amount: string
    adjusted: string
    date: string
    title: string
    category: string
    note: string
  }
  kind: (key: string) => string
  category: (id: string | null) => string
}

export async function exportMonthExcel(data: MonthDto, l: MonthExcelLabels) {
  const c = l.columns
  await save(
    [
      {
        sheet: l.summary,
        columns: [{ width: 24 }, { width: 16 }],
        data: [
          head(['', data.month]),
          ...l.rows.map((r) => [text(r.label), amount(String(data.summary[r.key]), 'THB')]),
        ],
      },
      {
        sheet: l.lines,
        columns: [{ width: 14 }, { width: 26 }, { width: 14 }, { width: 14 }, { width: 10 }],
        data: [
          head([c.type, c.name, c.planned, c.amount, c.adjusted]),
          ...data.lines.map((line) => [
            text(l.kind(line.kind)),
            text(line.name),
            amount(line.plannedMinor, 'THB'),
            amount(line.amountMinor, 'THB'),
            text(line.overridden ? '✓' : ''),
          ]),
        ],
      },
      {
        sheet: l.oneOff,
        columns: [
          { width: 12 },
          { width: 12 },
          { width: 26 },
          { width: 16 },
          { width: 14 },
          { width: 24 },
        ],
        data: [
          head([c.date, c.type, c.title, c.category, c.amount, c.note]),
          ...data.transactions.map((t) => [
            text(t.date),
            text(l.kind(t.kind)),
            text(t.title),
            text(l.category(t.categoryId)),
            amount(t.kind === 'expense' ? `-${t.amountMinor}` : t.amountMinor, 'THB'),
            text(t.note),
          ]),
        ],
      },
    ],
    `iplan-${data.month}.xlsx`,
  )
}
