import {
  type ExpenseDto,
  type ExpenseInput,
  type ExpenseSummaryDto,
  POOL_ID,
  type PoolContributionDto,
  type PoolContributionInput,
  type PoolContributionUpdateInput,
  type PoolDto,
  type TripMoneySettingsInput,
} from '@iplan/contracts'
import {
  MoneyError,
  contributedBy,
  convertMoney,
  pairTransfers,
  parseMoney,
  poolBalances,
  poolSettlement,
  summarizePool,
  toDecimalString,
  money,
} from '@iplan/core'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { notFound, poolShort, validationFailed } from '../../shared/errors'
import { computeShares, splitParticipants } from '../../shared/split-shares'
import type { TripRow, TripsRepository } from '../trips/trips.repository'
import type { TripAccess } from '../trips/trips.service'
import { type NameOf, baseShares, toContributionDto, toExpenseDto } from './expenses.mapper'
import type {
  ContributionRow,
  ExpenseWithShares,
  ExpensesRepository,
  NewContributionRow,
  NewExpenseRow,
  ShareRow,
} from './expenses.repository'

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

export type CsvLang = 'th' | 'en'

/** Words used in the CSV, per language. */
const CSV_TEXT: Record<
  CsvLang,
  Record<
    | 'date'
    | 'title'
    | 'category'
    | 'amount'
    | 'currency'
    | 'rate'
    | 'paidBy'
    | 'split'
    | 'note'
    | 'pool'
    | 'putInBy'
    | 'totalIn'
    | 'spentFromPool'
    | 'leftOver',
    string
  > & {
    categories: Record<string, string>
    splits: Record<string, string>
  }
> = {
  en: {
    date: 'Date',
    title: 'Title',
    category: 'Category',
    amount: 'Amount',
    currency: 'Currency',
    rate: 'Rate',
    paidBy: 'Paid by',
    split: 'Split',
    note: 'Note',
    pool: 'Pool',
    putInBy: 'Put in by',
    totalIn: 'Total put in',
    spentFromPool: 'Spent from pool',
    leftOver: 'Left over (negative = short)',
    categories: {
      food: 'Food',
      transport: 'Transport',
      stay: 'Stay',
      activity: 'Activities',
      shopping: 'Shopping',
      health: 'Health',
      other: 'Other',
    },
    splits: { equal: 'Equal', exact: 'Exact amounts', percent: 'Percent' },
  },
  th: {
    date: 'วันที่',
    title: 'รายการ',
    category: 'หมวด',
    amount: 'จำนวนเงิน',
    currency: 'สกุลเงิน',
    rate: 'อัตรา',
    paidBy: 'ใครจ่าย',
    split: 'หารแบบ',
    note: 'โน้ต',
    pool: 'กองกลาง',
    putInBy: 'ใครลง',
    totalIn: 'ลงรวม',
    spentFromPool: 'ใช้จากกองกลาง',
    leftOver: 'เหลือ (ติดลบ = ขาด)',
    categories: {
      food: 'อาหาร',
      transport: 'เดินทาง',
      stay: 'ที่พัก',
      activity: 'กิจกรรม',
      shopping: 'ช้อปปิ้ง',
      health: 'สุขภาพ',
      other: 'อื่นๆ',
    },
    splits: { equal: 'หารเท่ากัน', exact: 'ระบุจำนวน', percent: 'เปอร์เซ็นต์' },
  },
}

/** A trip name usable as a file name on every system. */
export function safeFileName(name: string): string {
  const cleaned = [...name]
    .map((ch) => (ch < ' ' || '\\/:*?"<>|'.includes(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return cleaned || 'trip'
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

  /**
   * Validates input and works out the stored row and per-member shares. When
   * editing, people already on the expense who have since left the trip may stay
   * (as payer or sharer); only newly added people must be current members.
   */
  private async build(
    trip: TripRow,
    input: ExpenseInput,
    createdBy: string,
    existing?: ExpenseWithShares,
  ) {
    const problems: Record<string, string> = {}
    const { memberIds } = await this.names(trip.id)
    const allowed = new Set(memberIds)
    for (const share of existing?.shares ?? []) allowed.add(share.userId)
    if (input.dayDate < trip.startDate || input.dayDate > trip.endDate) {
      problems.dayDate = 'Day must be within the trip dates'
    }
    if (
      input.paidBy !== POOL_ID &&
      !memberIds.has(input.paidBy) &&
      input.paidBy !== existing?.expense.paidBy
    )
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
    const outsiders = participants.filter((id) => !allowed.has(id))
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
      subcategory: input.subcategory ?? null,
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
    if (values.paidBy === POOL_ID)
      await this.assertPoolCovers(tripId, { spent: values.baseAmountMinor })
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
    const { values, shares } = await this.build(
      trip,
      input,
      found.expense.createdBy ?? actor.id,
      found,
    )
    const wasPool = found.expense.paidBy === POOL_ID ? found.expense.baseAmountMinor : 0n
    const isPool = values.paidBy === POOL_ID ? values.baseAmountMinor : 0n
    if (isPool > wasPool) await this.assertPoolCovers(trip.id, { spent: isPool - wasPool })
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

    const contributions = await this.expenses.listContributions(tripId)
    const pool = this.poolOptions(contributions)
    const split = rows.map((row) => ({
      paidBy: row.expense.paidBy,
      amount: row.expense.baseAmountMinor,
      shares: baseShares(row),
    }))
    const balances = poolBalances(split, pool)
    const contributed = contributedBy(pool.contributions)
    const paid = new Map<string, bigint>()
    const share = new Map<string, bigint>()
    for (const s of split) {
      paid.set(s.paidBy, (paid.get(s.paidBy) ?? 0n) + s.amount)
      for (const [id, v] of Object.entries(s.shares)) share.set(id, (share.get(id) ?? 0n) + v)
    }
    // Members only: the pool is shown on its own (put in / used per member).
    const partyIds = [...new Set([...memberIds, ...Object.keys(balances)])].filter(
      (id) => id !== POOL_ID,
    )
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
        contributedMinor: (contributed[id] ?? 0n).toString(),
        netMinor: (balances[id] ?? 0n).toString(),
      })),
      transfers: pairTransfers(split, POOL_ID).map((t) => ({
        from: t.from,
        fromName: nameOf(t.from),
        to: t.to,
        toName: nameOf(t.to),
        amountMinor: t.amount.toString(),
        items: t.items.map((item) => ({
          expenseId: rows[item.index]?.expense.id ?? '',
          title: rows[item.index]?.expense.title ?? '',
          amountMinor: item.amount.toString(),
        })),
      })),
      pool: poolSettlement(split, pool).map((m) => ({
        userId: m.userId,
        name: nameOf(m.userId),
        contributedMinor: m.contributed.toString(),
        usedMinor: m.used.toString(),
        netMinor: m.net.toString(),
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

  /**
   * Spreadsheet-friendly export: one row per expense, one share column per
   * person, then the pool. Headers in Thai or English; the file is named after
   * the trip.
   */
  async csv(
    actor: SessionUser,
    tripId: string,
    lang: CsvLang = 'en',
  ): Promise<{ fileName: string; body: string }> {
    const { trip } = await this.trips.requireAccess(actor, tripId, 'viewer')
    const [rows, { nameOf }, members] = await Promise.all([
      this.expenses.list(tripId),
      this.names(tripId),
      this.directory.members(tripId),
    ])
    const L = CSV_TEXT[lang]
    const baseCol = `${L.amount} (${trip.baseCurrency})`
    const dec = (minor: bigint) => toDecimalString(money(minor, trip.baseCurrency))
    const header = [
      L.date,
      L.title,
      L.category,
      L.amount,
      L.currency,
      L.rate,
      baseCol,
      L.paidBy,
      L.split,
      ...members.map((m) => `${m.name} (${trip.baseCurrency})`),
      L.note,
    ]
    const lines = rows.map((row) => {
      const base = baseShares(row)
      return [
        row.expense.dayDate,
        row.expense.title,
        L.categories[row.expense.category] ?? row.expense.category,
        toDecimalString(money(row.expense.amountMinor, row.expense.currency)),
        row.expense.currency,
        row.expense.fxRate,
        dec(row.expense.baseAmountMinor),
        row.expense.paidBy === POOL_ID ? L.pool : nameOf(row.expense.paidBy),
        L.splits[row.expense.splitMode] ?? row.expense.splitMode,
        ...members.map((m) => (base[m.userId] === undefined ? '' : dec(base[m.userId] ?? 0n))),
        row.expense.note ?? '',
      ]
    })
    // Money put into the pool and its totals, after a blank line.
    const pool = await this.pool(actor, tripId)
    const total = (label: string, minor: string) => [label, '', '', '', '', dec(BigInt(minor))]
    const poolLines: string[][] =
      pool.contributions.length > 0 || BigInt(pool.spentBaseMinor) > 0n
        ? [
            [],
            [L.pool],
            [L.date, L.putInBy, L.amount, L.currency, L.rate, baseCol, L.note],
            ...pool.contributions.map((x) => [
              x.date,
              x.name,
              toDecimalString(money(BigInt(x.amountMinor), x.currency)),
              x.currency,
              x.fxRate,
              dec(BigInt(x.baseAmountMinor)),
              x.note ?? '',
            ]),
            ...pool.byMember.map((m) => [
              '',
              m.name,
              '',
              '',
              '',
              dec(BigInt(m.contributedBaseMinor)),
              `${(m.percentBp / 100).toFixed(1)}%`,
            ]),
            total(L.totalIn, pool.totalBaseMinor),
            total(L.spentFromPool, pool.spentBaseMinor),
            total(L.leftOver, pool.leftoverBaseMinor),
          ]
        : []
    // BOM so Excel opens Thai text as UTF-8.
    const body = `\uFEFF${[header, ...lines, ...poolLines].map((line) => line.map(cell).join(',')).join('\r\n')}\r\n`
    return { fileName: `${safeFileName(trip.name)}.csv`, body }
  }

  private poolOptions(rows: ContributionRow[]) {
    return {
      poolId: POOL_ID,
      contributions: rows.map((r) => ({ userId: r.userId, amount: r.baseAmountMinor })),
    }
  }

  /** What the pool holds: contributions, spending and each member's part of the money put in. */
  async pool(actor: SessionUser, tripId: string): Promise<PoolDto> {
    const { trip } = await this.trips.requireAccess(actor, tripId, 'viewer')
    const [rows, contributions, { nameOf }] = await Promise.all([
      this.expenses.list(tripId),
      this.expenses.listContributions(tripId),
      this.names(tripId),
    ])
    const summary = summarizePool(
      rows.map((r) => ({
        paidBy: r.expense.paidBy,
        amount: r.expense.baseAmountMinor,
        shares: {},
      })),
      this.poolOptions(contributions).contributions,
      POOL_ID,
    )
    return {
      baseCurrency: trip.baseCurrency,
      contributions: contributions.map((c) => toContributionDto(c, nameOf)),
      totalBaseMinor: summary.totalIn.toString(),
      spentBaseMinor: summary.spent.toString(),
      leftoverBaseMinor: summary.leftover.toString(),
      byMember: summary.byMember.map((m) => ({
        userId: m.userId,
        name: nameOf(m.userId),
        contributedBaseMinor: m.contributed.toString(),
        percentBp: m.percentBp,
      })),
    }
  }

  /**
   * The pool can never pay out more than was put in. Throws when a change would
   * leave it below zero (or further below, for trips saved before this rule).
   */
  private async assertPoolCovers(
    tripId: string,
    change: { spent?: bigint; putIn?: bigint },
  ): Promise<void> {
    const [rows, contributions] = await Promise.all([
      this.expenses.list(tripId),
      this.expenses.listContributions(tripId),
    ])
    const spent = rows
      .filter((r) => r.expense.paidBy === POOL_ID)
      .reduce((sum, r) => sum + r.expense.baseAmountMinor, 0n)
    const putIn = contributions.reduce((sum, c) => sum + c.baseAmountMinor, 0n)
    const before = putIn - spent
    const after = before + (change.putIn ?? 0n) - (change.spent ?? 0n)
    if (after < 0n && after < before) throw poolShort()
  }

  /**
   * Validates a contribution and converts it into the base currency. The member
   * must be on the trip, except someone who has since left may stay on a
   * contribution they already made.
   */
  private async buildContribution(
    trip: TripRow,
    input: PoolContributionInput,
    createdBy: string,
    existing?: ContributionRow,
  ): Promise<NewContributionRow> {
    const problems: Record<string, string> = {}
    const { memberIds } = await this.names(trip.id)
    if (!memberIds.has(input.userId) && input.userId !== existing?.userId) {
      problems.userId = 'Not a trip member'
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
    const base = convertMoney(money(amount, input.currency), {
      from: input.currency,
      to: trip.baseCurrency,
      rate: rate as string,
    })
    return {
      tripId: trip.id,
      userId: input.userId,
      amountMinor: amount,
      currency: input.currency,
      fxRate: rate as string,
      baseAmountMinor: base.amount,
      date: input.date ?? existing?.date ?? new Date().toISOString().slice(0, 10),
      note: input.note === undefined ? (existing?.note ?? null) : input.note || null,
      createdBy,
    }
  }

  private async loadContribution(actor: SessionUser, id: string) {
    const found = await this.expenses.findContribution(id)
    if (!found) throw notFound('Contribution')
    const { trip } = await this.trips.requireAccess(actor, found.tripId, 'editor')
    return { found, trip }
  }

  async addContribution(
    actor: SessionUser,
    tripId: string,
    input: PoolContributionInput,
  ): Promise<PoolContributionDto> {
    const { trip } = await this.trips.requireAccess(actor, tripId, 'editor')
    const values = await this.buildContribution(trip, input, actor.id)
    const saved = await this.expenses.createContribution(values)
    await this.audit.record({
      actorId: actor.id,
      action: 'pool.contribute',
      entityType: 'pool_contribution',
      entityId: saved.id,
      data: { tripId, userId: input.userId, amount: input.amount, currency: input.currency },
    })
    return toContributionDto(saved, (await this.names(tripId)).nameOf)
  }

  async updateContribution(
    actor: SessionUser,
    id: string,
    input: PoolContributionUpdateInput,
  ): Promise<PoolContributionDto> {
    const { found, trip } = await this.loadContribution(actor, id)
    // A rate only carries over while the currency stays the same.
    const sameCurrency = input.currency === undefined || input.currency === found.currency
    const fxRate = input.fxRate ?? (sameCurrency ? found.fxRate : undefined)
    const merged: PoolContributionInput = {
      userId: input.userId ?? found.userId,
      amount: input.amount ?? toDecimalString(money(found.amountMinor, found.currency)),
      currency: input.currency ?? found.currency,
      ...(fxRate ? { fxRate } : {}),
      date: input.date ?? found.date,
      note: input.note === undefined ? found.note : input.note,
    }
    const values = await this.buildContribution(trip, merged, found.createdBy ?? actor.id, found)
    if (values.baseAmountMinor < found.baseAmountMinor)
      await this.assertPoolCovers(trip.id, {
        putIn: values.baseAmountMinor - found.baseAmountMinor,
      })
    const saved = await this.expenses.updateContribution(id, values)
    await this.audit.record({
      actorId: actor.id,
      action: 'pool.update',
      entityType: 'pool_contribution',
      entityId: id,
      data: { tripId: trip.id, amount: merged.amount, currency: merged.currency },
    })
    return toContributionDto(saved, (await this.names(trip.id)).nameOf)
  }

  async removeContribution(actor: SessionUser, id: string): Promise<void> {
    const { found, trip } = await this.loadContribution(actor, id)
    await this.assertPoolCovers(trip.id, { putIn: -found.baseAmountMinor })
    await this.expenses.deleteContribution(id)
    await this.audit.record({
      actorId: actor.id,
      action: 'pool.delete',
      entityType: 'pool_contribution',
      entityId: id,
      data: {
        tripId: trip.id,
        userId: found.userId,
        baseAmountMinor: found.baseAmountMinor.toString(),
      },
    })
  }

  async updateMoneySettings(actor: SessionUser, tripId: string, input: TripMoneySettingsInput) {
    const { trip } = await this.trips.requireAccess(actor, tripId, 'editor')
    const changes: { fxRates?: Record<string, string>; dailyBudgetMinor?: bigint | null } = {}
    if (input.fxRates) {
      // The map replaces the saved rates, so leaving a currency out removes it.
      // Expenses keep the rate they were saved with, so removing one is safe.
      // The base currency is always 1:1, so it is never stored.
      changes.fxRates = Object.fromEntries(
        Object.entries(input.fxRates).filter(([code]) => code !== trip.baseCurrency),
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
