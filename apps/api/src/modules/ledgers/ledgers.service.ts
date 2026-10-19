import type {
  LedgerDetailDto,
  LedgerDto,
  LedgerEntryDto,
  LedgerEntryInput,
  LedgerInput,
  SettleInput,
} from '@iplan/contracts'
import { MoneyError, computeBalances, parseMoney, settle } from '@iplan/core'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { AppError, conflict, forbidden, notFound, validationFailed } from '../../shared/errors'
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
}

/** Shared money between people: who paid, how it was split, who owes whom. */
export class LedgersService {
  constructor(
    private readonly ledgers: LedgersRepository,
    private readonly audit: AuditLog,
  ) {}

  private async load(actor: SessionUser, ledgerId: string): Promise<Loaded> {
    const ledger = await this.ledgers.find(ledgerId)
    if (!ledger) throw notFound('Ledger')
    const members = await this.ledgers.members(ledgerId)
    const me = members.find((m) => m.userId === actor.id)
    // Non-members get the same answer as a missing ledger.
    if (!me) throw notFound('Ledger')
    const byId = new Map(members.map((m) => [m.userId, m.name]))
    return {
      ledger,
      role: me.role,
      members,
      nameOf: (id) => byId.get(id) ?? 'Former member',
    }
  }

  private requireOwner(loaded: Loaded) {
    if (loaded.role !== 'owner') throw forbidden('Only the owner can do this')
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
    // Includes former members, so the balances still net to zero.
    const full = computeBalances(
      entries.map((e) => ({
        paidBy: e.paidBy,
        amount: e.amountMinor,
        shares: Object.fromEntries(e.shares.map((s) => [s.userId, s.amountMinor])),
      })),
    )
    const months = new Map<string, { total: bigint; mine: bigint }>()
    for (const e of entries) {
      if (e.kind !== 'expense') continue
      const key = e.date.slice(0, 7)
      const m = months.get(key) ?? { total: 0n, mine: 0n }
      m.total += e.amountMinor
      m.mine += e.shares.find((s) => s.userId === actor.id)?.amountMinor ?? 0n
      months.set(key, m)
    }
    return {
      ...base,
      entries: entries.map((e) => toLedgerEntryDto(e, loaded.nameOf)),
      transfers: settle(full).map((t) => ({
        from: t.from,
        to: t.to,
        amountMinor: t.amount.toString(),
      })),
      months: [...months.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, m]) => ({
          month,
          totalMinor: m.total.toString(),
          myShareMinor: m.mine.toString(),
        })),
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

  /** Adds an approved user by email. */
  async addMember(actor: SessionUser, ledgerId: string, email: string): Promise<LedgerDto> {
    const loaded = await this.load(actor, ledgerId)
    this.requireOwner(loaded)
    const found = await this.ledgers.findUserByEmail(email.toLowerCase())
    if (!found || found.status !== 'active') {
      throw new AppError('USER_NOT_FOUND', 404, 'No approved user with that email')
    }
    if (loaded.members.some((m) => m.userId === found.id)) throw conflict('Already a member')
    await this.ledgers.addMember(ledgerId, found.id, 'member')
    await this.audit.record({
      actorId: actor.id,
      action: 'ledger.member.add',
      entityType: 'ledger',
      entityId: ledgerId,
      data: { userId: found.id },
    })
    const next = await this.load(actor, ledgerId)
    return this.summary(actor, next, await this.ledgers.entries(ledgerId))
  }

  /** The owner removes others; anyone else can leave. */
  async removeMember(actor: SessionUser, ledgerId: string, userId: string): Promise<void> {
    const loaded = await this.load(actor, ledgerId)
    const target = loaded.members.find((m) => m.userId === userId)
    if (!target) throw notFound('Member')
    if (userId !== actor.id) this.requireOwner(loaded)
    if (target.role === 'owner') {
      throw new AppError('OWNER_CANNOT_LEAVE', 409, 'The owner cannot leave; delete it instead')
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
    return toLedgerEntryDto(row, loaded.nameOf)
  }

  async getEntry(actor: SessionUser, entryId: string): Promise<LedgerEntryDto> {
    const { entry, loaded } = await this.loadEntry(actor, entryId)
    return toLedgerEntryDto(entry, loaded.nameOf)
  }

  async updateEntry(
    actor: SessionUser,
    entryId: string,
    input: LedgerEntryInput,
  ): Promise<LedgerEntryDto> {
    const { entry, loaded } = await this.loadEntry(actor, entryId)
    if (entry.kind !== 'expense') throw validationFailed({ kind: 'Settlements cannot be edited' })
    const { values, shares } = this.build(loaded, input)
    await this.ledgers.updateEntry(entryId, values satisfies Partial<NewEntryRow>, shares)
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
    const { entry } = await this.loadEntry(actor, entryId)
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
