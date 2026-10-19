import {
  type ExpenseDto,
  type ExpenseInput,
  type ExpenseSummaryDto,
  POOL_ID,
  type TripMoneySettingsInput,
} from '@iplan/contracts'
import {
  MoneyError,
  computeBalances,
  convertMoney,
  parseMoney,
  settle,
  toDecimalString,
  money,
} from '@iplan/core'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { notFound, validationFailed } from '../../shared/errors'
import { computeShares, splitParticipants } from '../../shared/split-shares'
import type { TripRow, TripsRepository } from '../trips/trips.repository'
import type { TripAccess } from '../trips/trips.service'
import { type NameOf, baseShares, toExpenseDto } from './expenses.mapper'
import type { ExpensesRepository, NewExpenseRow, ShareRow } from './expenses.repository'

type MemberDirectory = Pick<TripsRepository, 'members'>

function daysOf(start: string, end: string): string[] {
  const days: string[] = []
  for (
    let t = Date.parse(`${start}T00:00:00Z`);
    t <= Date.parse(`${end}T00:00:00Z`);
    t += 86_400_000
  ) {
    days.push(new Date(t).toISOString().slice(0, 10))
  }
  return days
}

/** CSV cell: quote when needed and neutralise spreadsheet formulas. */
function cell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export class ExpensesService {
  constructor(
    private readonly expenses: ExpensesRepository,
    private readonly trips: TripAccess,
    private readonly directory: MemberDirectory,
    private readonly audit: AuditLog,
  ) {}

  private async names(tripId: string): Promise<{ nameOf: NameOf; memberIds: Set<string> }> {
    const members = await this.directory.members(tripId)
    const byId = new Map(members.map((m) => [m.userId, m.name]))
    return {
      nameOf: (id) => (id === POOL_ID ? 'Pool' : (byId.get(id) ?? 'Former member')),
      memberIds: new Set(byId.keys()),
    }
  }

  /** Validates input and works out the stored row and per-member shares. */
  private async build(trip: TripRow, input: ExpenseInput, createdBy: string) {
    const problems: Record<string, string> = {}
    const { memberIds } = await this.names(trip.id)
    if (input.dayDate < trip.startDate || input.dayDate > trip.endDate) {
      problems.dayDate = 'Day must be within the trip dates'
    }
    if (input.paidBy !== POOL_ID && !memberIds.has(input.paidBy))
      problems.paidBy = 'Not a trip member'
    if (input.itemId && !(await this.expenses.itemInTrip(input.itemId, trip.id))) {
      problems.itemId = 'Item is not in this trip'
    }
    const rate =
      input.fxRate ?? (input.currency === trip.baseCurrency ? '1' : trip.fxRates[input.currency])
    if (!rate) problems.fxRate = `No exchange rate saved for ${input.currency}`

    let amount = 0n
    try {
      amount = parseMoney(input.amount, input.currency).amount
      if (amount <= 0n) problems.amount = 'Amount must be above zero'
    } catch (error) {
      problems.amount = error instanceof MoneyError ? error.message : 'Invalid amount'
    }
    if (Object.keys(problems).length > 0) throw validationFailed(problems)

    const split = input.split
    const participants = splitParticipants(split)
    const outsiders = participants.filter((id) => !memberIds.has(id))
    if (outsiders.length > 0)
      throw validationFailed({ split: 'Only trip members can share a cost' })

    const shares: Omit<ShareRow, 'expenseId'>[] = computeShares(amount, input.currency, split)

    const base = convertMoney(money(amount, input.currency), {
      from: input.currency,
      to: trip.baseCurrency,
      rate: rate as string,
    })
    const values: NewExpenseRow = {
      tripId: trip.id,
      dayDate: input.dayDate,
      itemId: input.itemId ?? null,
      title: input.title,
      category: input.category,
      amountMinor: amount,
      currency: input.currency,
      fxRate: rate as string,
      baseAmountMinor: base.amount,
      paidBy: input.paidBy,
      splitMode: split.mode,
      note: input.note ?? null,
      createdBy,
    }
    return { values, shares }
  }

  private async load(actor: SessionUser, expenseId: string, minimum: 'viewer' | 'editor') {
    const found = await this.expenses.find(expenseId)
    if (!found) throw notFound('Expense')
    const { trip } = await this.trips.requireAccess(actor, found.expense.tripId, minimum)
    return { found, trip }
  }

  async list(actor: SessionUser, tripId: string): Promise<ExpenseDto[]> {
    await this.trips.requireAccess(actor, tripId, 'viewer')
    const [rows, { nameOf }] = await Promise.all([this.expenses.list(tripId), this.names(tripId)])
    return rows.map((row) => toExpenseDto(row, nameOf))
  }

  async create(actor: SessionUser, tripId: string, input: ExpenseInput): Promise<ExpenseDto> {
    const { trip } = await this.trips.requireAccess(actor, tripId, 'editor')
    const { values, shares } = await this.build(trip, input, actor.id)
    const saved = await this.expenses.create(values, shares)
    await this.audit.record({
      actorId: actor.id,
      action: 'expense.create',
      entityType: 'expense',
      entityId: saved.expense.id,
      data: { tripId, title: values.title, amount: input.amount, currency: input.currency },
    })
    return toExpenseDto(saved, (await this.names(tripId)).nameOf)
  }

  async update(actor: SessionUser, expenseId: string, input: ExpenseInput): Promise<ExpenseDto> {
    const { found, trip } = await this.load(actor, expenseId, 'editor')
    const { values, shares } = await this.build(trip, input, found.expense.createdBy ?? actor.id)
    const saved = await this.expenses.replace(expenseId, values, shares)
    await this.audit.record({
      actorId: actor.id,
      action: 'expense.update',
      entityType: 'expense',
      entityId: expenseId,
      data: { tripId: trip.id, amount: input.amount, currency: input.currency },
    })
    return toExpenseDto(saved, (await this.names(trip.id)).nameOf)
  }

  async remove(actor: SessionUser, expenseId: string): Promise<void> {
    const { found, trip } = await this.load(actor, expenseId, 'editor')
    await this.expenses.delete(expenseId)
    await this.audit.record({
      actorId: actor.id,
      action: 'expense.delete',
      entityType: 'expense',
      entityId: expenseId,
      data: { tripId: trip.id, title: found.expense.title },
    })
  }

  async summary(actor: SessionUser, tripId: string): Promise<ExpenseSummaryDto> {
    const { trip } = await this.trips.requireAccess(actor, tripId, 'viewer')
    const [rows, { nameOf, memberIds }] = await Promise.all([
      this.expenses.list(tripId),
      this.names(tripId),
    ])

    const split = rows.map((row) => ({
      paidBy: row.expense.paidBy,
      amount: row.expense.baseAmountMinor,
      shares: baseShares(row),
    }))
    const balances = computeBalances(split)
    const paid = new Map<string, bigint>()
    const share = new Map<string, bigint>()
    for (const s of split) {
      paid.set(s.paidBy, (paid.get(s.paidBy) ?? 0n) + s.amount)
      for (const [id, v] of Object.entries(s.shares)) share.set(id, (share.get(id) ?? 0n) + v)
    }
    const partyIds = [...new Set([...memberIds, ...Object.keys(balances)])]
    const byDay = new Map<string, bigint>()
    const byCategory = new Map<string, bigint>()
    for (const { expense } of rows) {
      byDay.set(expense.dayDate, (byDay.get(expense.dayDate) ?? 0n) + expense.baseAmountMinor)
      byCategory.set(
        expense.category,
        (byCategory.get(expense.category) ?? 0n) + expense.baseAmountMinor,
      )
    }

    return {
      baseCurrency: trip.baseCurrency,
      totalMinor: rows.reduce((sum, r) => sum + r.expense.baseAmountMinor, 0n).toString(),
      parties: partyIds.map((id) => ({
        id,
        name: nameOf(id),
        paidMinor: (paid.get(id) ?? 0n).toString(),
        shareMinor: (share.get(id) ?? 0n).toString(),
        netMinor: (balances[id] ?? 0n).toString(),
      })),
      transfers: settle(balances).map((t) => ({
        from: t.from,
        fromName: nameOf(t.from),
        to: t.to,
        toName: nameOf(t.to),
        amountMinor: t.amount.toString(),
      })),
      byDay: daysOf(trip.startDate, trip.endDate).map((dayDate) => ({
        dayDate,
        spentMinor: (byDay.get(dayDate) ?? 0n).toString(),
        budgetMinor: trip.dailyBudgetMinor?.toString() ?? null,
      })),
      byCategory: [...byCategory.entries()]
        .sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1))
        .map(([category, spent]) => ({
          category: category as ExpenseSummaryDto['byCategory'][number]['category'],
          spentMinor: spent.toString(),
        })),
    }
  }

  /** Spreadsheet-friendly export: one row per expense, one share column per person. */
  async csv(actor: SessionUser, tripId: string): Promise<string> {
    const { trip } = await this.trips.requireAccess(actor, tripId, 'viewer')
    const [rows, { nameOf }, members] = await Promise.all([
      this.expenses.list(tripId),
      this.names(tripId),
      this.directory.members(tripId),
    ])
    const header = [
      'Date',
      'Title',
      'Category',
      'Amount',
      'Currency',
      'Rate',
      `Amount (${trip.baseCurrency})`,
      'Paid by',
      'Split',
      ...members.map((m) => `${m.name} (${trip.baseCurrency})`),
      'Note',
    ]
    const lines = rows.map((row) => {
      const base = baseShares(row)
      const dec = (minor: bigint) => toDecimalString(money(minor, trip.baseCurrency))
      return [
        row.expense.dayDate,
        row.expense.title,
        row.expense.category,
        toDecimalString(money(row.expense.amountMinor, row.expense.currency)),
        row.expense.currency,
        row.expense.fxRate,
        dec(row.expense.baseAmountMinor),
        nameOf(row.expense.paidBy),
        row.expense.splitMode,
        ...members.map((m) => (base[m.userId] === undefined ? '' : dec(base[m.userId] ?? 0n))),
        row.expense.note ?? '',
      ]
    })
    // BOM so Excel opens Thai text as UTF-8.
    return `\uFEFF${[header, ...lines].map((line) => line.map(cell).join(',')).join('\r\n')}\r\n`
  }

  async updateMoneySettings(actor: SessionUser, tripId: string, input: TripMoneySettingsInput) {
    const { trip } = await this.trips.requireAccess(actor, tripId, 'editor')
    const changes: { fxRates?: Record<string, string>; dailyBudgetMinor?: bigint | null } = {}
    if (input.fxRates) {
      // The base currency is always 1:1, so it is never stored.
      changes.fxRates = Object.fromEntries(
        Object.entries({ ...trip.fxRates, ...input.fxRates }).filter(
          ([code]) => code !== trip.baseCurrency,
        ),
      )
    }
    if (input.dailyBudget !== undefined) {
      try {
        changes.dailyBudgetMinor =
          input.dailyBudget === null
            ? null
            : parseMoney(input.dailyBudget, trip.baseCurrency).amount
      } catch (error) {
        throw validationFailed({
          dailyBudget: error instanceof Error ? error.message : 'Invalid amount',
        })
      }
    }
    await this.expenses.updateTripMoney(tripId, changes)
    await this.audit.record({
      actorId: actor.id,
      action: 'trip.money',
      entityType: 'trip',
      entityId: tripId,
      data: { fxRates: input.fxRates ?? null, dailyBudget: input.dailyBudget ?? null },
    })
  }
}
