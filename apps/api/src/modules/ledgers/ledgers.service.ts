import type {
  LedgerDetailDto,
  LedgerDto,
  LedgerEntryDto,
  LedgerEntryInput,
  LedgerInput,
  MonthStatusInput,
  PendingInviteDto,
  SettleInput,
} from '@iplan/contracts'
import { MoneyError, computeBalances, parseMoney, settle } from '@iplan/core'
import { monthParts, monthSummaries } from './ledgers.months'
import type { AuditLog } from '../../shared/audit'
import { type SessionUser, isAdmin, isSuperAdmin } from '../../shared/context'
import type { InvitationsService } from '../invitations/invitations.service'
import { AppError, forbidden, notFound, validationFailed } from '../../shared/errors'
import { computeShares, splitParticipants } from '../../shared/split-shares'
import { type NameOf, toLedgerEntryDto } from './ledgers.mapper'
import type {
  EntryWithShares,
  LedgerRole,
  LedgerRow,
  LedgersRepository,
  MemberRow,
  NewEntryRow,
} from './ledgers.repository'

interface Loaded {
  ledger: LedgerRow
  role: LedgerRole
  members: MemberRow[]
  nameOf: NameOf
  /** An admin (not the superadmin) looking at someone else's wallet. */
  readOnly: boolean
  /** Not a member: an admin or the superadmin looking in. */
  outsider: boolean
}

/** Shared money between people: who paid, how it was split, who owes whom. */
export class LedgersService {
  constructor(
    private readonly ledgers: LedgersRepository,
    private readonly audit: AuditLog,
    private readonly invitations?: InvitationsService,
  ) {}

  private async load(actor: SessionUser, ledgerId: string): Promise<Loaded> {
    const ledger = await this.ledgers.find(ledgerId)
    if (!ledger) throw notFound('Ledger')
    const members = await this.ledgers.members(ledgerId)
    const me = members.find((m) => m.userId === actor.id)
    // Non-members get the same answer as a missing ledger; admins may look in.
    if (!me && !isAdmin(actor)) throw notFound('Ledger')
    const byId = new Map(members.map((m) => [m.userId, m.name]))
    const outsider = !me
    return {
      ledger,
      role: me?.role ?? (isSuperAdmin(actor) ? 'owner' : 'member'),
      members,
      nameOf: (id) => byId.get(id) ?? 'Former member',
      readOnly: outsider && !isSuperAdmin(actor),
      outsider,
    }
  }

  private requireOwner(loaded: Loaded) {
    this.requireWrite(loaded)
    if (loaded.role !== 'owner') throw forbidden('Only the owner can do this')
  }

  private requireWrite(loaded: Loaded) {
    if (loaded.readOnly) throw forbidden("Admins can only look at other people's wallets")
  }

  private summary(actor: SessionUser, loaded: Loaded, entries: EntryWithShares[]): LedgerDto {
    const balances = computeBalances(
      entries.map((e) => ({
        paidBy: e.paidBy,
        amount: e.amountMinor,
        shares: Object.fromEntries(e.shares.map((s) => [s.userId, s.amountMinor])),
      })),
    )
    return {
      id: loaded.ledger.id,
      name: loaded.ledger.name,
      currency: loaded.ledger.currency,
      role: loaded.role,
      members: loaded.members.map((m) => ({
        ...m,
        balanceMinor: (balances[m.userId] ?? 0n).toString(),
      })),
      myBalanceMinor: (balances[actor.id] ?? 0n).toString(),
      entryCount: entries.length,
      createdAt: loaded.ledger.createdAt.toISOString(),
    }
  }

  async list(actor: SessionUser): Promise<LedgerDto[]> {
    const rows = await this.ledgers.listForUser(actor.id)
    return Promise.all(
      rows.map(async ({ ledger }) => {
        const loaded = await this.load(actor, ledger.id)
        return this.summary(actor, loaded, await this.ledgers.entries(ledger.id))
      }),
    )
  }

  async get(actor: SessionUser, ledgerId: string): Promise<LedgerDetailDto> {
    const loaded = await this.load(actor, ledgerId)
    const entries = await this.ledgers.entries(ledgerId)
    const base = this.summary(actor, loaded, entries)
    if (loaded.outsider) {
      await this.audit.record({
        actorId: actor.id,
        action: 'admin.view',
        entityType: 'ledger',
        entityId: ledgerId,
      })
    }
    const paidBack = new Set(entries.flatMap((e) => (e.settlesEntryId ? [e.settlesEntryId] : [])))
    // Includes former members, so the balances still net to zero.
    const full = computeBalances(
      entries.map((e) => ({
        paidBy: e.paidBy,
        amount: e.amountMinor,
        shares: Object.fromEntries(e.shares.map((s) => [s.userId, s.amountMinor])),
      })),
    )
    return {
      ...base,
      readOnly: loaded.readOnly,
      pendingInvites: (await this.invitations?.pending('ledger', ledgerId)) ?? [],
      entries: entries.map((e) => toLedgerEntryDto(e, loaded.nameOf, paidBack.has(e.id))),
      transfers: settle(full).map((t) => ({
        from: t.from,
        to: t.to,
        amountMinor: t.amount.toString(),
      })),
      months: monthSummaries(entries, actor.id),
    }
  }

  async create(actor: SessionUser, input: LedgerInput): Promise<LedgerDto> {
    const id = await this.ledgers.create({
      name: input.name,
      currency: input.currency,
      createdBy: actor.id,
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.create',
      entityType: 'ledger',
      entityId: id,
      data: { name: input.name },
    })
    return this.summary(actor, await this.load(actor, id), [])
  }

  async rename(actor: SessionUser, ledgerId: string, input: LedgerInput): Promise<LedgerDto> {
    this.requireOwner(await this.load(actor, ledgerId))
    await this.ledgers.rename(ledgerId, input.name)
    const loaded = await this.load(actor, ledgerId)
    return this.summary(actor, loaded, await this.ledgers.entries(ledgerId))
  }

  async remove(actor: SessionUser, ledgerId: string): Promise<void> {
    this.requireOwner(await this.load(actor, ledgerId))
    await this.ledgers.delete(ledgerId)
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.delete',
      entityType: 'ledger',
      entityId: ledgerId,
    })
  }

  /** Invites someone (found via people search); they join after accepting. */
  async invite(actor: SessionUser, ledgerId: string, userId: string): Promise<PendingInviteDto[]> {
    const loaded = await this.load(actor, ledgerId)
    this.requireOwner(loaded)
    if (!this.invitations) throw new Error('Invitations are not configured')
    return this.invitations.invite(
      actor,
      {
        kind: 'ledger',
        id: ledgerId,
        name: loaded.ledger.name,
        memberIds: loaded.members.map((m) => m.userId),
      },
      userId,
      'member',
    )
  }

  /** The owner removes others; anyone else can leave. */
  async removeMember(actor: SessionUser, ledgerId: string, userId: string): Promise<void> {
    const loaded = await this.load(actor, ledgerId)
    this.requireWrite(loaded)
    const target = loaded.members.find((m) => m.userId === userId)
    if (!target) throw notFound('Member')
    if (userId !== actor.id) this.requireOwner(loaded)
    if (target.role === 'owner') {
      throw new AppError('OWNER_CANNOT_LEAVE', 409, 'The owner cannot leave; delete it instead')
    }
    // Leaving with money still owed would hide the debt behind "Former member".
    const balances = computeBalances(
      (await this.ledgers.entries(ledgerId)).map((e) => ({
        paidBy: e.paidBy,
        amount: e.amountMinor,
        shares: Object.fromEntries(e.shares.map((s) => [s.userId, s.amountMinor])),
      })),
    )
    if ((balances[userId] ?? 0n) !== 0n) {
      throw new AppError('BALANCE_NOT_SETTLED', 409, 'Settle this member’s balance first')
    }
    await this.ledgers.removeMember(ledgerId, userId)
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.member.remove',
      entityType: 'ledger',
      entityId: ledgerId,
      data: { userId },
    })
  }

  private build(loaded: Loaded, input: LedgerEntryInput) {
    const memberIds = new Set(loaded.members.map((m) => m.userId))
    const problems: Record<string, string> = {}
    if (!memberIds.has(input.paidBy)) problems.paidBy = 'Not a member'
    let amount = 0n
    try {
      amount = parseMoney(input.amount, loaded.ledger.currency).amount
      if (amount <= 0n) problems.amount = 'Amount must be above zero'
    } catch (error) {
      problems.amount = error instanceof MoneyError ? error.message : 'Invalid amount'
    }
    if (splitParticipants(input.split).some((id) => !memberIds.has(id))) {
      problems.split = 'Only members can share a cost'
    }
    if (Object.keys(problems).length > 0) throw validationFailed(problems)
    const shares = computeShares(amount, loaded.ledger.currency, input.split)
    const values = {
      title: input.title,
      category: input.category,
      amountMinor: amount,
      date: input.date,
      paidBy: input.paidBy,
      splitMode: input.split.mode,
      note: input.note ?? null,
    }
    return { values, shares }
  }

  async addEntry(
    actor: SessionUser,
    ledgerId: string,
    input: LedgerEntryInput,
  ): Promise<LedgerEntryDto> {
    const loaded = await this.load(actor, ledgerId)
    this.requireWrite(loaded)
    const { values, shares } = this.build(loaded, input)
    const id = await this.ledgers.insertEntry(
      { ...values, ledgerId, kind: 'expense', createdBy: actor.id },
      shares,
    )
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.entry.create',
      entityType: 'ledger_entry',
      entityId: id,
      data: { ledgerId, title: input.title, amount: input.amount },
    })
    return this.entryDto(id, loaded)
  }

  private async loadEntry(actor: SessionUser, entryId: string) {
    const entry = await this.ledgers.entry(entryId)
    if (!entry) throw notFound('Entry')
    return { entry, loaded: await this.load(actor, entry.ledgerId) }
  }

  private async entryDto(id: string, loaded: Loaded): Promise<LedgerEntryDto> {
    const row = await this.ledgers.entry(id)
    if (!row) throw notFound('Entry')
    const all = await this.ledgers.entries(row.ledgerId)
    return toLedgerEntryDto(
      row,
      loaded.nameOf,
      all.some((e) => e.settlesEntryId === id),
    )
  }

  async getEntry(actor: SessionUser, entryId: string): Promise<LedgerEntryDto> {
    const { loaded } = await this.loadEntry(actor, entryId)
    return this.entryDto(entryId, loaded)
  }

  /**
   * Month status. "paid" records what that month still needs so it ends at zero;
   * "partial" records one amount (only when one person owes one other); "unpaid"
   * removes them. Every payment counted for that month (month status, per-expense
   * "paid back", plain settle-ups dated that month) is replaced, so nothing is
   * counted twice.
   */
  async setMonthStatus(
    actor: SessionUser,
    ledgerId: string,
    month: string,
    input: MonthStatusInput,
  ): Promise<LedgerDetailDto> {
    const loaded = await this.load(actor, ledgerId)
    this.requireWrite(loaded)
    let partial: bigint | null = null
    if (input.status === 'partial') {
      try {
        partial = parseMoney(input.amount ?? '', loaded.ledger.currency).amount
      } catch {
        throw validationFailed({ amount: 'Enter the amount paid' })
      }
      // More than owed is allowed: the extra becomes a debt the other way.
      if (partial <= 0n) throw validationFailed({ amount: 'Above zero' })
    }
    await this.ledgers.locked(ledgerId, async (repo) => {
      const entries = await repo.entries(ledgerId)
      if (!monthSummaries(entries, actor.id).some((m) => m.month === month)) {
        throw notFound('Month')
      }
      const { owed, settlements } = monthParts(entries, month)
      let plan: { from: string; to: string; amount: bigint }[] = []
      if (input.status === 'paid') {
        plan = owed.map((t) => ({ from: t.from, to: t.to, amount: t.amount }))
      } else if (partial !== null) {
        const [only, ...more] = owed
        if (!only || more.length > 0) {
          throw validationFailed({
            status: 'Partial payments need exactly one person owing one other',
          })
        }
        plan = [{ from: only.from, to: only.to, amount: partial }]
      }
      await repo.deleteEntries(settlements.map((e) => e.id))
      for (const p of plan) {
        await repo.insertEntry(
          {
            ledgerId,
            kind: 'settlement',
            title: 'Settlement',
            category: 'other',
            amountMinor: p.amount,
            date: `${month}-01`,
            paidBy: p.from,
            splitMode: 'exact',
            settlesMonth: month,
            createdBy: actor.id,
          },
          [{ userId: p.to, amountMinor: p.amount, percentBp: null }],
        )
      }
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.month.status',
      entityType: 'ledger',
      entityId: ledgerId,
      data: { month, status: input.status, ...(input.amount && { amount: input.amount }) },
    })
    return this.get(actor, ledgerId)
  }

  /**
   * Per-expense "paid back": records each sharer paying the payer, or removes that.
   * Marking one expense replaces a month-level payment for that month (it would
   * otherwise count twice); un-marking only removes this expense's payback.
   */
  async setEntryPaid(
    actor: SessionUser,
    entryId: string,
    paidBack: boolean,
  ): Promise<LedgerEntryDto> {
    const { entry, loaded } = await this.loadEntry(actor, entryId)
    this.requireWrite(loaded)
    if (entry.kind !== 'expense') throw validationFailed({ kind: 'Only expenses can be paid back' })
    await this.ledgers.locked(entry.ledgerId, async (repo) => {
      const current = await repo.entry(entryId)
      if (!current) throw notFound('Entry')
      const month = current.date.slice(0, 7)
      const all = await repo.entries(current.ledgerId)
      const stale = all.filter(
        (e) =>
          e.settlesEntryId === entryId ||
          (paidBack && e.kind === 'settlement' && e.settlesMonth === month),
      )
      await repo.deleteEntries(stale.map((e) => e.id))
      if (!paidBack) return
      for (const share of current.shares) {
        if (share.userId === current.paidBy || share.amountMinor <= 0n) continue
        await repo.insertEntry(
          {
            ledgerId: current.ledgerId,
            kind: 'settlement',
            title: 'Settlement',
            category: 'other',
            amountMinor: share.amountMinor,
            date: current.date,
            paidBy: share.userId,
            splitMode: 'exact',
            settlesEntryId: entryId,
            createdBy: actor.id,
          },
          [{ userId: current.paidBy, amountMinor: share.amountMinor, percentBp: null }],
        )
      }
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.entry.paid',
      entityType: 'ledger_entry',
      entityId: entryId,
      data: { paidBack },
    })
    return this.entryDto(entryId, loaded)
  }

  async updateEntry(
    actor: SessionUser,
    entryId: string,
    input: LedgerEntryInput,
  ): Promise<LedgerEntryDto> {
    const { entry, loaded } = await this.loadEntry(actor, entryId)
    this.requireWrite(loaded)
    if (entry.kind !== 'expense') throw validationFailed({ kind: 'Settlements cannot be edited' })
    const { values, shares } = this.build(loaded, input)
    await this.ledgers.locked(entry.ledgerId, async (repo) => {
      // Its paybacks were for the old amounts and split; it starts unpaid again.
      const paybacks = (await repo.entries(entry.ledgerId)).filter(
        (e) => e.settlesEntryId === entryId,
      )
      await repo.deleteEntries(paybacks.map((e) => e.id))
      await repo.updateEntry(entryId, values satisfies Partial<NewEntryRow>, shares)
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.entry.update',
      entityType: 'ledger_entry',
      entityId: entryId,
      data: { title: input.title, amount: input.amount },
    })
    return this.entryDto(entryId, loaded)
  }

  async deleteEntry(actor: SessionUser, entryId: string): Promise<void> {
    const { entry, loaded } = await this.loadEntry(actor, entryId)
    this.requireWrite(loaded)
    await this.ledgers.deleteEntry(entryId)
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.entry.delete',
      entityType: 'ledger_entry',
      entityId: entryId,
      data: { ledgerId: entry.ledgerId, title: entry.title },
    })
  }

  /** Records that `from` paid `to` back. */
  async settleUp(
    actor: SessionUser,
    ledgerId: string,
    input: SettleInput,
  ): Promise<LedgerEntryDto> {
    const loaded = await this.load(actor, ledgerId)
    this.requireWrite(loaded)
    const ids = new Set(loaded.members.map((m) => m.userId))
    const problems: Record<string, string> = {}
    if (!ids.has(input.from)) problems.from = 'Not a member'
    if (!ids.has(input.to)) problems.to = 'Not a member'
    if (input.from === input.to) problems.to = 'Pick someone else'
    let amount = 0n
    try {
      amount = parseMoney(input.amount, loaded.ledger.currency).amount
      if (amount <= 0n) problems.amount = 'Amount must be above zero'
    } catch {
      problems.amount = 'Invalid amount'
    }
    if (Object.keys(problems).length > 0) throw validationFailed(problems)
    const id = await this.ledgers.insertEntry(
      {
        ledgerId,
        kind: 'settlement',
        title: 'Settlement',
        category: 'other',
        amountMinor: amount,
        date: input.date,
        paidBy: input.from,
        splitMode: 'exact',
        note: input.note ?? null,
        createdBy: actor.id,
      },
      [{ userId: input.to, amountMinor: amount, percentBp: null }],
    )
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.settle',
      entityType: 'ledger',
      entityId: ledgerId,
      data: { from: input.from, to: input.to, amount: input.amount },
    })
    return this.entryDto(id, loaded)
  }
}
