/** In-memory repositories for service and HTTP tests (no database needed). */
import type { TripRole } from '@iplan/contracts'
import type { AuditEntry, AuditLog } from '../shared/audit'
import type { SessionUser } from '../shared/context'
import type {
  CheckInRow,
  ItemRow,
  ItemsRepository,
  NewItemRow,
} from '../modules/items/items.repository'
import type { AttachmentEntity } from '@iplan/contracts'
import type { StorageProvider } from '../infra/storage'
import type {
  AdminRepository,
  AuditRow,
  StatsRow,
  UserRow as AdminUserRow,
} from '../modules/admin/admin.repository'
import type {
  AttachmentRow,
  AttachmentScope,
  AttachmentsRepository,
  NewAttachmentRow,
} from '../modules/attachments/attachments.repository'
import type { BackupRepository, ImportData } from '../modules/backup/backup.repository'
import type {
  ChecklistRepository,
  ChecklistRow,
  TickRow,
} from '../modules/checklist/checklist.repository'
import type {
  ExpenseWithShares,
  ExpensesRepository,
  NewExpenseRow,
  ShareRow,
} from '../modules/expenses/expenses.repository'
import type {
  CategoryRow,
  FinanceRepository,
  OverrideRow,
  RuleRow,
  TransactionRow,
} from '../modules/finance/finance.repository'
import type {
  InfoCardFields,
  InfoCardRow,
  InfoCardsRepository,
} from '../modules/info-cards/info-cards.repository'
import type {
  InviteRow,
  InviteWithTrip,
  MembersRepository,
} from '../modules/members/members.repository'
import type {
  MemberRow,
  NewTripRow,
  TripRow,
  TripWithRole,
  TripsRepository,
} from '../modules/trips/trips.repository'

let counter = 0
export const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`

export const users = {
  owner: { id: 'owner', name: 'Owner', email: 'owner@test', role: 'user' },
  editor: { id: 'editor', name: 'Editor', email: 'editor@test', role: 'user' },
  viewer: { id: 'viewer', name: 'Viewer', email: 'viewer@test', role: 'user' },
  stranger: { id: 'stranger', name: 'Stranger', email: 'stranger@test', role: 'user' },
} satisfies Record<string, SessionUser>

const nameOf = (userId: string) =>
  (users as Record<string, SessionUser | undefined>)[userId]?.name ?? userId

export class FakeAudit implements AuditLog {
  entries: AuditEntry[] = []
  async record(entry: AuditEntry) {
    this.entries.push(entry)
  }
}

export class InMemoryTrips implements TripsRepository {
  trips = new Map<string, TripRow>()
  roles = new Map<string, Map<string, TripRole>>()

  async listForUser(userId: string): Promise<TripWithRole[]> {
    const result: TripWithRole[] = []
    for (const trip of this.trips.values()) {
      const found = await this.findForUser(trip.id, userId)
      if (found) result.push(found)
    }
    return result
  }

  async findForUser(tripId: string, userId: string): Promise<TripWithRole | null> {
    const trip = this.trips.get(tripId)
    const role = this.roles.get(tripId)?.get(userId)
    if (!trip || !role) return null
    return { trip, role, memberCount: this.roles.get(tripId)?.size ?? 0 }
  }

  async members(tripId: string): Promise<MemberRow[]> {
    return [...(this.roles.get(tripId) ?? new Map<string, TripRole>())].map(([userId, role]) => ({
      userId,
      name: nameOf(userId),
      image: null,
      role,
    }))
  }

  async create(values: NewTripRow, ownerId: string): Promise<TripRow> {
    const now = new Date()
    const trip: TripRow = {
      id: uuid(),
      name: values.name,
      destination: values.destination ?? null,
      startDate: values.startDate,
      endDate: values.endDate,
      homeTimeZone: values.homeTimeZone ?? 'Asia/Bangkok',
      baseCurrency: values.baseCurrency ?? 'THB',
      fxRates: values.fxRates ?? {},
      dailyBudgetMinor: values.dailyBudgetMinor ?? null,
      createdBy: values.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.trips.set(trip.id, trip)
    this.roles.set(trip.id, new Map([[ownerId, 'owner']]))
    return trip
  }

  addMember(tripId: string, userId: string, role: TripRole) {
    this.roles.get(tripId)?.set(userId, role)
  }

  async update(tripId: string, changes: Partial<NewTripRow>): Promise<TripRow | null> {
    const trip = this.trips.get(tripId)
    if (!trip) return null
    const next = { ...trip, ...changes } as TripRow
    this.trips.set(tripId, next)
    return next
  }

  async delete(tripId: string) {
    this.trips.delete(tripId)
    this.roles.delete(tripId)
  }
}

export class InMemoryItems implements ItemsRepository {
  items = new Map<string, ItemRow>()
  checkIns: CheckInRow[] = []

  async listByTrip(tripId: string) {
    return [...this.items.values()]
      .filter((i) => i.tripId === tripId)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  }
  async checkInsByTrip(tripId: string) {
    return this.checkIns.filter((c) => this.items.get(c.itemId)?.tripId === tripId)
  }
  async checkInsByItem(itemId: string) {
    return this.checkIns.filter((c) => c.itemId === itemId)
  }
  async findById(itemId: string) {
    return this.items.get(itemId) ?? null
  }
  async nextSortOrder(tripId: string, dayDate: string) {
    const orders = [...this.items.values()]
      .filter((i) => i.tripId === tripId && i.dayDate === dayDate)
      .map((i) => i.sortOrder)
    return orders.length ? Math.max(...orders) + 1 : 0
  }
  async create(values: NewItemRow): Promise<ItemRow> {
    const now = new Date()
    const row: ItemRow = {
      id: uuid(),
      tripId: values.tripId,
      dayDate: values.dayDate,
      kind: values.kind,
      title: values.title,
      startsAt: values.startsAt,
      endsAt: values.endsAt ?? null,
      timeZone: values.timeZone,
      notes: values.notes ?? null,
      details: values.details ?? {},
      sortOrder: values.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    }
    this.items.set(row.id, row)
    return row
  }
  async update(itemId: string, changes: Partial<NewItemRow>) {
    const row = this.items.get(itemId)
    if (!row) return null
    const next = { ...row, ...changes } as ItemRow
    this.items.set(itemId, next)
    return next
  }
  async delete(itemId: string) {
    this.items.delete(itemId)
  }
  async upsertCheckIn(itemId: string, userId: string, at: Date) {
    this.checkIns = this.checkIns.filter((c) => !(c.itemId === itemId && c.userId === userId))
    this.checkIns.push({ itemId, userId, name: nameOf(userId), checkedInAt: at })
  }
  async deleteCheckIn(itemId: string, userId: string) {
    this.checkIns = this.checkIns.filter((c) => !(c.itemId === itemId && c.userId === userId))
  }
}

export class InMemoryMembers implements MembersRepository {
  invites = new Map<string, InviteRow>()
  constructor(private readonly trips: InMemoryTrips) {}

  async roleOf(tripId: string, userId: string) {
    return this.trips.roles.get(tripId)?.get(userId) ?? null
  }
  async setRole(tripId: string, userId: string, role: TripRole) {
    this.trips.roles.get(tripId)?.set(userId, role)
  }
  async remove(tripId: string, userId: string) {
    this.trips.roles.get(tripId)?.delete(userId)
  }
  async add(tripId: string, userId: string, role: TripRole) {
    if (!this.trips.roles.get(tripId)?.has(userId)) this.trips.roles.get(tripId)?.set(userId, role)
  }
  async createInvite(values: {
    tripId: string
    token: string
    role: 'editor' | 'viewer'
    createdBy: string
    expiresAt: Date
  }): Promise<InviteRow> {
    const row: InviteRow = {
      id: uuid(),
      ...values,
      createdAt: new Date(),
      revokedAt: null,
      useCount: 0,
    }
    this.invites.set(row.id, row)
    return row
  }
  async activeInvites(tripId: string, now: Date) {
    return [...this.invites.values()].filter(
      (i) => i.tripId === tripId && !i.revokedAt && i.expiresAt > now,
    )
  }
  async findInvite(inviteId: string) {
    return this.invites.get(inviteId) ?? null
  }
  async findInviteByToken(token: string): Promise<InviteWithTrip | null> {
    const invite = [...this.invites.values()].find((i) => i.token === token)
    const trip = invite && this.trips.trips.get(invite.tripId)
    if (!invite || !trip) return null
    return {
      invite,
      tripName: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      invitedBy: invite.createdBy ? nameOf(invite.createdBy) : null,
    }
  }
  async revokeInvite(inviteId: string, at: Date) {
    const invite = this.invites.get(inviteId)
    if (invite) invite.revokedAt = at
  }
  async countInviteUse(inviteId: string) {
    const invite = this.invites.get(inviteId)
    if (invite) invite.useCount += 1
  }
}

export class InMemoryChecklist implements ChecklistRepository {
  rows = new Map<string, ChecklistRow>()
  tickRows: TickRow[] = []

  async list(tripId: string) {
    return [...this.rows.values()].filter((r) => r.tripId === tripId)
  }
  async ticks(tripId: string) {
    return this.tickRows.filter((t) => this.rows.get(t.itemId)?.tripId === tripId)
  }
  async find(itemId: string) {
    return this.rows.get(itemId) ?? null
  }
  async nextSortOrder(tripId: string, groupKey: string) {
    return [...this.rows.values()].filter((r) => r.tripId === tripId && r.groupKey === groupKey)
      .length
  }
  async create(values: { tripId: string; groupKey: string; title: string; sortOrder: number }) {
    const now = new Date()
    const row: ChecklistRow = { id: uuid(), ...values, createdAt: now, updatedAt: now }
    this.rows.set(row.id, row)
    return row
  }
  async update(itemId: string, changes: { groupKey?: string; title?: string }) {
    const row = this.rows.get(itemId)
    if (!row) return null
    const next = { ...row, ...changes }
    this.rows.set(itemId, next)
    return next
  }
  async delete(itemId: string) {
    this.rows.delete(itemId)
  }
  async tick(itemId: string, userId: string, at: Date) {
    if (!this.tickRows.some((t) => t.itemId === itemId && t.userId === userId)) {
      this.tickRows.push({ itemId, userId, name: nameOf(userId), tickedAt: at })
    }
  }
  async untick(itemId: string, userId: string) {
    this.tickRows = this.tickRows.filter((t) => !(t.itemId === itemId && t.userId === userId))
  }
}

export class InMemoryInfoCards implements InfoCardsRepository {
  rows = new Map<string, InfoCardRow>()

  async list(tripId: string) {
    return [...this.rows.values()].filter((r) => r.tripId === tripId)
  }
  async find(cardId: string) {
    return this.rows.get(cardId) ?? null
  }
  async nextSortOrder(tripId: string) {
    return (await this.list(tripId)).length
  }
  async create(values: InfoCardFields & { tripId: string; sortOrder: number }) {
    const now = new Date()
    const row: InfoCardRow = { id: uuid(), ...values, createdAt: now, updatedAt: now }
    this.rows.set(row.id, row)
    return row
  }
  async update(cardId: string, changes: Partial<InfoCardFields>) {
    const row = this.rows.get(cardId)
    if (!row) return null
    const next = { ...row, ...changes }
    this.rows.set(cardId, next)
    return next
  }
  async delete(cardId: string) {
    this.rows.delete(cardId)
  }
}

/** A trip owned by `owner` with an editor and a viewer, for module tests. */
export async function seededTrip() {
  const { TripsService } = await import('../modules/trips/trips.service')
  const repo = new InMemoryTrips()
  const audit = new FakeAudit()
  const trips = new TripsService(repo, audit)
  const { id } = await trips.create(users.owner, {
    name: 'Seoul',
    startDate: '2026-10-22',
    endDate: '2026-10-27',
    homeTimeZone: 'Asia/Bangkok',
    baseCurrency: 'THB',
  })
  repo.addMember(id, 'editor', 'editor')
  repo.addMember(id, 'viewer', 'viewer')
  return { tripId: id, trips, repo, audit }
}

export class InMemoryExpenses implements ExpensesRepository {
  rows = new Map<string, ExpenseWithShares>()
  constructor(
    private readonly trips: InMemoryTrips,
    private readonly items?: InMemoryItems,
  ) {}

  async list(tripId: string) {
    return [...this.rows.values()].filter((r) => r.expense.tripId === tripId)
  }
  async find(expenseId: string) {
    return this.rows.get(expenseId) ?? null
  }
  private save(
    id: string,
    values: NewExpenseRow,
    shares: Omit<ShareRow, 'expenseId'>[],
    createdAt: Date,
  ) {
    const row: ExpenseWithShares = {
      expense: {
        id,
        ...values,
        itemId: values.itemId ?? null,
        category: values.category ?? 'other',
        note: values.note ?? null,
        createdBy: values.createdBy ?? null,
        createdAt,
        updatedAt: new Date(),
      },
      shares: shares.map((s) => ({ ...s, expenseId: id })),
    }
    this.rows.set(id, row)
    return row
  }
  async create(values: NewExpenseRow, shares: Omit<ShareRow, 'expenseId'>[]) {
    return this.save(uuid(), values, shares, new Date())
  }
  async replace(expenseId: string, values: NewExpenseRow, shares: Omit<ShareRow, 'expenseId'>[]) {
    return this.save(
      expenseId,
      values,
      shares,
      this.rows.get(expenseId)?.expense.createdAt ?? new Date(),
    )
  }
  async delete(expenseId: string) {
    this.rows.delete(expenseId)
  }
  async itemInTrip(itemId: string, tripId: string) {
    return (await this.items?.findById(itemId))?.tripId === tripId
  }
  async updateTripMoney(
    tripId: string,
    changes: { fxRates?: Record<string, string>; dailyBudgetMinor?: bigint | null },
  ) {
    await this.trips.update(tripId, changes)
  }
}

export class MemoryStorage implements StorageProvider {
  files = new Map<string, Uint8Array<ArrayBuffer>>()
  async put(key: string, body: Uint8Array) {
    this.files.set(key, new Uint8Array(body))
  }
  async get(key: string) {
    return this.files.get(key) ?? null
  }
  async delete(key: string) {
    this.files.delete(key)
  }
}

export class InMemoryAttachments implements AttachmentsRepository {
  rows = new Map<string, AttachmentRow>()
  /** entityId → scope for entities that "exist". */
  entities = new Map<string, AttachmentScope>()

  async scopeOf(_entityType: AttachmentEntity, entityId: string) {
    return this.entities.get(entityId) ?? null
  }
  async list(entityType: AttachmentEntity, entityId: string) {
    return [...this.rows.values()].filter(
      (r) => r.entityType === entityType && r.entityId === entityId,
    )
  }
  async find(id: string) {
    return this.rows.get(id) ?? null
  }
  async create(values: NewAttachmentRow) {
    const row: AttachmentRow = {
      id: uuid(),
      ownerId: values.ownerId ?? null,
      tripId: values.tripId ?? null,
      entityType: values.entityType,
      entityId: values.entityId,
      kind: values.kind,
      storageKey: values.storageKey,
      thumbKey: values.thumbKey ?? null,
      contentType: values.contentType,
      sizeBytes: values.sizeBytes,
      width: values.width ?? null,
      height: values.height ?? null,
      createdAt: new Date(),
    }
    this.rows.set(row.id, row)
    return row
  }
  async delete(id: string) {
    this.rows.delete(id)
  }
}

export class InMemoryFinance implements FinanceRepository {
  cats: CategoryRow[] = []
  ruleRows: RuleRow[] = []
  overrideRows: OverrideRow[] = []
  txRows: TransactionRow[] = []

  async categories(ownerId: string) {
    return this.cats.filter((c) => c.ownerId === ownerId)
  }
  async createCategories(rows: Parameters<FinanceRepository['createCategories']>[0]) {
    const created = rows.map((r): CategoryRow => ({
      id: uuid(),
      ownerId: r.ownerId,
      kind: r.kind,
      name: r.name,
      color: r.color ?? '#94a3b8',
      budgetMinor: r.budgetMinor ?? null,
      sortOrder: r.sortOrder ?? 0,
      createdAt: new Date(),
    }))
    this.cats.push(...created)
    return created
  }
  async updateCategory(id: string, ownerId: string, changes: Partial<CategoryRow>) {
    const row = this.cats.find((c) => c.id === id && c.ownerId === ownerId)
    if (!row) return null
    Object.assign(row, changes)
    return row
  }
  async deleteCategory(id: string, ownerId: string) {
    const before = this.cats.length
    this.cats = this.cats.filter((c) => !(c.id === id && c.ownerId === ownerId))
    return this.cats.length < before
  }
  async rules(ownerId: string) {
    return this.ruleRows.filter((r) => r.ownerId === ownerId)
  }
  async createRule(values: Parameters<FinanceRepository['createRule']>[0]) {
    const row: RuleRow = {
      id: uuid(),
      ownerId: values.ownerId,
      kind: values.kind,
      name: values.name,
      amountMinor: values.amountMinor,
      startMonth: values.startMonth,
      endMonth: values.endMonth ?? null,
      categoryId: values.categoryId ?? null,
      sortOrder: values.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.ruleRows.push(row)
    return row
  }
  async updateRule(id: string, ownerId: string, changes: Partial<RuleRow>) {
    const row = this.ruleRows.find((r) => r.id === id && r.ownerId === ownerId)
    if (!row) return null
    Object.assign(row, changes)
    return row
  }
  async deleteRule(id: string, ownerId: string) {
    const before = this.ruleRows.length
    this.ruleRows = this.ruleRows.filter((r) => !(r.id === id && r.ownerId === ownerId))
    return this.ruleRows.length < before
  }
  async overrides(ruleIds: string[]) {
    return this.overrideRows.filter((o) => ruleIds.includes(o.ruleId))
  }
  async setOverride(row: OverrideRow) {
    await this.clearOverride(row.ruleId, row.month)
    this.overrideRows.push(row)
  }
  async clearOverride(ruleId: string, month: string) {
    this.overrideRows = this.overrideRows.filter((o) => !(o.ruleId === ruleId && o.month === month))
  }
  async transactions(ownerId: string, fromDate: string, toDate: string) {
    return this.txRows.filter(
      (t) => t.ownerId === ownerId && t.date >= fromDate && t.date <= toDate,
    )
  }
  async createTransaction(values: Parameters<FinanceRepository['createTransaction']>[0]) {
    const row: TransactionRow = {
      id: uuid(),
      ownerId: values.ownerId,
      kind: values.kind,
      title: values.title,
      amountMinor: values.amountMinor,
      date: values.date,
      categoryId: values.categoryId ?? null,
      note: values.note ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.txRows.push(row)
    return row
  }
  async updateTransaction(id: string, ownerId: string, changes: Partial<TransactionRow>) {
    const row = this.txRows.find((t) => t.id === id && t.ownerId === ownerId)
    if (!row) return null
    Object.assign(row, changes)
    return row
  }
  async deleteTransaction(id: string, ownerId: string) {
    const before = this.txRows.length
    this.txRows = this.txRows.filter((t) => !(t.id === id && t.ownerId === ownerId))
    return this.txRows.length < before
  }
}

export class InMemoryAdmin implements AdminRepository {
  people: AdminUserRow[] = Object.values(users).map((u, i) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: true,
    image: null,
    createdAt: new Date(Date.UTC(2026, 0, i + 1)),
    updatedAt: new Date(),
    role: u.id === 'owner' ? 'admin' : 'user',
    banned: false,
    banReason: null,
    banExpires: null,
    locale: 'th',
    trips: 1,
  }))
  sessions = new Set(['owner', 'editor', 'viewer'])
  log: AuditRow[] = []

  async stats(): Promise<StatsRow> {
    return {
      users: this.people.length,
      newUsers30d: 0,
      suspendedUsers: this.people.filter((p) => p.banned).length,
      activeSessions: this.sessions.size,
      trips: 1,
      tripItems: 0,
      expenses: 0,
      transactions: 0,
      attachments: 0,
      storageBytes: 0,
      databaseBytes: 0,
    }
  }
  async users(query: string | undefined) {
    const rows = this.people.filter(
      (p) => !query || p.name.includes(query) || p.email.includes(query),
    )
    return { rows, total: rows.length }
  }
  async user(id: string) {
    return this.people.find((p) => p.id === id) ?? null
  }
  async updateUser(
    id: string,
    changes: { role?: string; banned?: boolean; banReason?: string | null },
  ) {
    const person = this.people.find((p) => p.id === id)
    if (person) Object.assign(person, changes)
  }
  async revokeSessions(userId: string) {
    this.sessions.delete(userId)
  }
  async audit() {
    return { rows: this.log, total: this.log.length }
  }
}

/** Writes imported trips into the other in-memory repositories. */
export class InMemoryBackup implements BackupRepository {
  constructor(
    private readonly trips: InMemoryTrips,
    private readonly items: InMemoryItems,
    private readonly checklist: InMemoryChecklist,
    private readonly infoCards: InMemoryInfoCards,
  ) {}

  async importTrip(ownerId: string, data: ImportData) {
    const trip = await this.trips.create(data.trip, ownerId)
    for (const item of data.items) await this.items.create({ ...item, tripId: trip.id })
    for (const c of data.checklist) await this.checklist.create({ ...c, tripId: trip.id })
    for (const c of data.infoCards) {
      await this.infoCards.create({
        kind: c.kind,
        title: c.title,
        body: c.body ?? '',
        tripId: trip.id,
        sortOrder: c.sortOrder ?? 0,
      })
    }
    return trip.id
  }
}
