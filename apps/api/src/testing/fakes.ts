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
  EntryWithShares,
  LedgerRole,
  LedgerRow,
  LedgersRepository,
  MemberRow as LedgerMemberRow,
  NewEntryRow as NewLedgerEntryRow,
  ShareRow as LedgerShareRow,
} from '../modules/ledgers/ledgers.repository'
import type {
  AccessRepository,
  CircleRow,
  GroupFields,
  GroupRow,
} from '../modules/access/access.repository'
import type {
  InvitationKind,
  InvitationRow,
  InvitationsRepository,
} from '../modules/invitations/invitations.repository'
import type { ContactRow, PeopleRepository } from '../modules/people/people.repository'
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
  ContributionRow,
  ExpensesRepository,
  NewContributionRow,
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
  TripContents,
  TripRow,
  TripWithRole,
  TripsRepository,
} from '../modules/trips/trips.repository'

let counter = 0
export const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`

export const GROUP_IDS = {
  travelers: '00000000-0000-4000-8000-0000000000a1',
  full: '00000000-0000-4000-8000-0000000000a2',
} as const

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

  async findAny(tripId: string, role: TripRole): Promise<TripWithRole | null> {
    const trip = this.trips.get(tripId)
    return trip ? { trip, role, memberCount: this.roles.get(tripId)?.size ?? 0 } : null
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
      color: values.color ?? null,
      coverKey: values.coverKey ?? null,
      poolMode: values.poolMode ?? 'actual',
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

  /** Item and expense stores to read trip contents from (set by tests that need it). */
  linked: { items?: InMemoryItems; expenses?: InMemoryExpenses } = {}

  async contents(tripId: string): Promise<TripContents> {
    const items = (await this.linked.items?.listByTrip(tripId)) ?? []
    const expenses = (await this.linked.expenses?.list(tripId)) ?? []
    const contributions = (await this.linked.expenses?.listContributions(tripId)) ?? []
    const days = [...items.map((i) => i.dayDate), ...expenses.map((e) => e.expense.dayDate)].sort()
    return {
      expenseCount: expenses.length + contributions.length,
      firstDay: days[0] ?? null,
      lastDay: days.at(-1) ?? null,
    }
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
  async retime(changes: { id: string; startsAt: Date; endsAt: Date | null }[]) {
    for (const c of changes) {
      const row = this.items.get(c.id)
      if (row) this.items.set(c.id, { ...row, startsAt: c.startsAt, endsAt: c.endsAt })
    }
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
  async upsertCheckIn(itemId: string, userId: string, at: Date, skipped = false) {
    this.checkIns = this.checkIns.filter((c) => !(c.itemId === itemId && c.userId === userId))
    this.checkIns.push({ itemId, userId, name: nameOf(userId), checkedInAt: at, skipped })
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
        subcategory: values.subcategory ?? null,
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

  contributions = new Map<string, ContributionRow>()
  async listContributions(tripId: string) {
    return [...this.contributions.values()]
      .filter((c) => c.tripId === tripId)
      .sort((a, b) => a.date.localeCompare(b.date))
  }
  async findContribution(id: string) {
    return this.contributions.get(id) ?? null
  }
  private saveContribution(id: string, values: NewContributionRow, createdAt: Date) {
    const row: ContributionRow = {
      id,
      ...values,
      note: values.note ?? null,
      createdBy: values.createdBy ?? null,
      createdAt,
    }
    this.contributions.set(id, row)
    return row
  }
  async createContribution(values: NewContributionRow) {
    return this.saveContribution(uuid(), values, new Date())
  }
  async updateContribution(id: string, values: NewContributionRow) {
    return this.saveContribution(id, values, this.contributions.get(id)?.createdAt ?? new Date())
  }
  async deleteContribution(id: string) {
    this.contributions.delete(id)
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
    // Like the real one: returns all of the owner's categories.
    return this.categories(rows[0]?.ownerId ?? '')
  }
  async createCategory(r: Parameters<FinanceRepository['createCategory']>[0]) {
    const row: CategoryRow = {
      id: uuid(),
      ownerId: r.ownerId,
      kind: r.kind,
      name: r.name,
      color: r.color ?? '#94a3b8',
      budgetMinor: r.budgetMinor ?? null,
      sortOrder: r.sortOrder ?? 0,
      createdAt: new Date(),
    }
    this.cats.push(row)
    return row
  }
  async userExists(id: string) {
    return Object.values(users).some((u) => u.id === id)
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
    status: u.id === 'stranger' ? 'pending' : 'active',
    avatarKey: null,
    nickname: null,
    mustChangePassword: false,
    bootstrapSecretHash: null,
    trips: 1,
  }))
  sessions = new Set(['owner', 'editor', 'viewer'])
  log: AuditRow[] = []

  async stats(): Promise<StatsRow> {
    return {
      users: this.people.length,
      newUsers30d: 0,
      suspendedUsers: this.people.filter((p) => p.banned).length,
      pendingUsers: this.people.filter((p) => p.status === 'pending').length,
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
  async users(query: string | undefined, _page: number, status?: string) {
    const rows = this.people.filter(
      (p) =>
        (!query || p.name.includes(query) || p.email.includes(query)) &&
        (!status || p.status === status),
    )
    return { rows, total: rows.length }
  }
  async user(id: string) {
    return this.people.find((p) => p.id === id) ?? null
  }
  async updateUser(
    id: string,
    changes: { role?: string; status?: string; banned?: boolean; banReason?: string | null },
  ) {
    const person = this.people.find((p) => p.id === id)
    if (person) Object.assign(person, changes)
  }
  async revokeSessions(userId: string) {
    this.sessions.delete(userId)
  }
  async allTrips() {
    return []
  }
  async allLedgers() {
    return []
  }
  async audit() {
    return { rows: this.log, total: this.log.length }
  }
}

/** Ledgers kept in memory; people come from the shared `users` fixtures. */
export class InMemoryLedgers implements LedgersRepository {
  rows: LedgerRow[] = []
  memberRows: { ledgerId: string; userId: string; role: LedgerRole; at: number }[] = []
  entryRows: EntryWithShares[] = []
  /** Pending users exist but can't be added. */
  directory = new Map<string, { id: string; status: string }>([
    ...Object.values(users).map((u) => [u.email, { id: u.id, status: 'active' }] as const),
    ['pending@test', { id: 'pending', status: 'pending' }],
  ])
  private seq = 0
  private uuid() {
    return `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`
  }

  async listForUser(userId: string) {
    return this.memberRows
      .filter((m) => m.userId === userId)
      .flatMap((m) => {
        const ledger = this.rows.find((r) => r.id === m.ledgerId)
        return ledger ? [{ ledger, role: m.role }] : []
      })
  }
  async find(id: string) {
    return this.rows.find((r) => r.id === id) ?? null
  }
  async members(ledgerId: string): Promise<LedgerMemberRow[]> {
    return this.memberRows
      .filter((m) => m.ledgerId === ledgerId)
      .sort((a, b) => a.at - b.at)
      .map((m) => ({
        userId: m.userId,
        name: nameOf(m.userId),
        email: `${m.userId}@test`,
        image: null,
        role: m.role,
      }))
  }
  async create(values: { name: string; currency: string; createdBy: string }) {
    const id = this.uuid()
    this.rows.push({ id, ...values, createdAt: new Date(), updatedAt: new Date() })
    await this.addMember(id, values.createdBy, 'owner')
    return id
  }
  async rename(id: string, name: string) {
    const row = this.rows.find((r) => r.id === id)
    if (row) row.name = name
  }
  async delete(id: string) {
    this.rows = this.rows.filter((r) => r.id !== id)
    this.memberRows = this.memberRows.filter((m) => m.ledgerId !== id)
    this.entryRows = this.entryRows.filter((e) => e.ledgerId !== id)
  }
  async addMember(ledgerId: string, userId: string, role: LedgerRole) {
    this.memberRows.push({ ledgerId, userId, role, at: this.memberRows.length })
  }
  async removeMember(ledgerId: string, userId: string) {
    this.memberRows = this.memberRows.filter(
      (m) => !(m.ledgerId === ledgerId && m.userId === userId),
    )
  }
  async findUserByEmail(email: string) {
    return this.directory.get(email) ?? null
  }
  async entries(ledgerId: string) {
    return this.entryRows
      .filter((e) => e.ledgerId === ledgerId)
      .sort((a, b) => b.date.localeCompare(a.date))
  }
  async entry(id: string) {
    return this.entryRows.find((e) => e.id === id) ?? null
  }
  async insertEntry(values: NewLedgerEntryRow, shares: LedgerShareRow[]) {
    const id = this.uuid()
    this.entryRows.push({
      id,
      ledgerId: values.ledgerId,
      kind: values.kind ?? 'expense',
      title: values.title,
      category: values.category ?? 'other',
      amountMinor: values.amountMinor,
      date: values.date,
      paidBy: values.paidBy,
      splitMode: values.splitMode,
      note: values.note ?? null,
      settlesMonth: values.settlesMonth ?? null,
      settlesEntryId: values.settlesEntryId ?? null,
      createdBy: values.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      shares,
    })
    return id
  }
  async updateEntry(id: string, values: Partial<NewLedgerEntryRow>, shares: LedgerShareRow[]) {
    const row = this.entryRows.find((e) => e.id === id)
    if (row) Object.assign(row, values, { shares })
  }
  async deleteEntry(id: string) {
    await this.deleteEntries([id])
  }
  private lock: Promise<unknown> = Promise.resolve()
  /** Runs callers one after another, like the row lock in the real repository. */
  async locked<T>(_ledgerId: string, fn: (repo: LedgersRepository) => Promise<T>): Promise<T> {
    const run: Promise<T> = this.lock.then(() => fn(this))
    this.lock = run.catch(() => undefined)
    return run
  }
  async deleteEntries(ids: string[]) {
    // Mirrors ON DELETE CASCADE on settles_entry_id.
    const gone = new Set(ids)
    this.entryRows = this.entryRows.filter(
      (e) => !gone.has(e.id) && !(e.settlesEntryId && gone.has(e.settlesEntryId)),
    )
  }
}

/** Groups start like the migration: "Travelers" (trips) and "Full access" (trips + finance). */
export class InMemoryAccess implements AccessRepository {
  groupRows: { id: string; name: string; description: string | null; createdAt: Date }[] = [
    { id: GROUP_IDS.travelers, name: 'Travelers', description: null, createdAt: new Date(0) },
    { id: GROUP_IDS.full, name: 'Full access', description: null, createdAt: new Date(0) },
  ]
  features = new Map<string, string[]>([
    [GROUP_IDS.travelers, ['trips']],
    [GROUP_IDS.full, ['trips', 'finance']],
  ])
  members = new Map<string, string[]>([
    ['owner', [GROUP_IDS.full]],
    ['editor', [GROUP_IDS.full]],
    ['viewer', [GROUP_IDS.full]],
  ])
  private seq = 0

  async featuresFor(userId: string) {
    const groups = this.members.get(userId) ?? []
    return [
      ...new Set([
        ...groups.flatMap((g) => this.features.get(g) ?? []),
        ...(this.direct.get(userId) ?? []),
      ]),
    ]
  }
  async groups(): Promise<GroupRow[]> {
    return this.groupRows.map((g) => ({
      ...g,
      features: this.features.get(g.id) ?? [],
      memberCount: [...this.members.values()].filter((ids) => ids.includes(g.id)).length,
    }))
  }
  async group(id: string) {
    return (await this.groups()).find((g) => g.id === id) ?? null
  }
  async createGroup(fields: GroupFields, features: string[]) {
    const id = `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`
    this.groupRows.push({ id, ...fields, createdAt: new Date() })
    this.features.set(id, features)
    return id
  }
  async updateGroup(id: string, fields: Partial<GroupFields>, features?: string[]) {
    const row = this.groupRows.find((g) => g.id === id)
    if (row) Object.assign(row, fields)
    if (features) this.features.set(id, features)
  }
  async deleteGroup(id: string) {
    this.groupRows = this.groupRows.filter((g) => g.id !== id)
    this.features.delete(id)
    for (const [userId, ids] of this.members) {
      this.members.set(
        userId,
        ids.filter((g) => g !== id),
      )
    }
  }
  async groupIdsFor(userIds: string[]) {
    return new Map(userIds.map((id) => [id, [...(this.members.get(id) ?? [])]]))
  }
  async setUserGroups(userId: string, groupIds: string[]) {
    this.members.set(userId, groupIds)
  }
  direct = new Map<string, string[]>()
  async directFeaturesFor(userIds: string[]) {
    return new Map(userIds.map((id) => [id, [...(this.direct.get(id) ?? [])]]))
  }
  async setUserFeatures(userId: string, features: string[]) {
    this.direct.set(userId, features)
  }
  circleRows: { id: string; name: string; createdAt: Date }[] = []
  circleMembers = new Map<string, string[]>()
  async circles(): Promise<CircleRow[]> {
    return this.circleRows.map((c) => ({
      ...c,
      memberCount: [...this.circleMembers.values()].filter((ids) => ids.includes(c.id)).length,
    }))
  }
  async createCircle(name: string) {
    const id = `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`
    this.circleRows.push({ id, name, createdAt: new Date() })
    return id
  }
  async renameCircle(id: string, name: string) {
    const row = this.circleRows.find((c) => c.id === id)
    if (row) row.name = name
  }
  async deleteCircle(id: string) {
    this.circleRows = this.circleRows.filter((c) => c.id !== id)
    for (const [userId, ids] of this.circleMembers) {
      this.circleMembers.set(
        userId,
        ids.filter((c) => c !== id),
      )
    }
  }
  async circleIdsFor(userIds: string[]) {
    return new Map(userIds.map((id) => [id, [...(this.circleMembers.get(id) ?? [])]]))
  }
  async setUserCircles(userId: string, circleIds: string[]) {
    this.circleMembers.set(userId, circleIds)
  }
}

/** People and circles over the shared `users` fixtures (all active except `stranger`). */
export class InMemoryPeople implements PeopleRepository {
  constructor(private readonly access: InMemoryAccess) {}
  contacts = new Map<string, ContactRow>(
    Object.values(users).map((u) => [
      u.id,
      {
        id: u.id,
        name: u.name,
        email: u.email,
        locale: 'th',
        status: u.id === 'stranger' ? 'pending' : 'active',
        banned: false,
      },
    ]),
  )
  async search(query: string, excludeId: string, circleOf: string | null) {
    const mine = circleOf ? (this.access.circleMembers.get(circleOf) ?? []) : null
    return [...this.contacts.values()]
      .filter((c) => c.id !== excludeId && c.status === 'active')
      .filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase()))
      .filter(
        (c) => !mine || (this.access.circleMembers.get(c.id) ?? []).some((id) => mine.includes(id)),
      )
      .map((c) => ({ id: c.id, name: c.name, nickname: null, email: c.email, image: null }))
  }
  async contact(id: string) {
    return this.contacts.get(id) ?? null
  }
  async adminContacts() {
    return []
  }
}

/** Invitations; accepting adds the membership to the trip or ledger fakes. */
export class InMemoryInvitations implements InvitationsRepository {
  rows: InvitationRow[] = []
  private seq = 0
  constructor(
    private readonly trips?: InMemoryTrips,
    private readonly ledgers?: InMemoryLedgers,
  ) {}
  async create(values: Parameters<InvitationsRepository['create']>[0]) {
    if (
      this.rows.some(
        (r) =>
          r.kind === values.kind && r.targetId === values.targetId && r.userId === values.userId,
      )
    ) {
      return null
    }
    const id = `00000000-0000-4000-9000-${String(++this.seq).padStart(12, '0')}`
    this.rows.push({ id, ...values, createdAt: new Date() })
    return id
  }
  async find(id: string) {
    return this.rows.find((r) => r.id === id) ?? null
  }
  async forTarget(kind: InvitationKind, targetId: string) {
    return this.rows
      .filter((r) => r.kind === kind && r.targetId === targetId)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        name: nameOf(r.userId),
        image: null,
        role: r.role,
      }))
  }
  async forUser(userId: string) {
    return this.rows
      .filter((r) => r.userId === userId)
      .map((r) => ({
        ...r,
        targetName: 'Target',
        invitedByName: r.invitedBy ? nameOf(r.invitedBy) : null,
      }))
  }
  async accept(invitation: InvitationRow) {
    const gone =
      invitation.kind === 'ledger'
        ? this.ledgers && !(await this.ledgers.find(invitation.targetId))
        : this.trips && !this.trips.roles.has(invitation.targetId)
    if (gone) {
      await this.delete(invitation.id)
      return false
    }
    if (invitation.kind === 'ledger') {
      await this.ledgers?.addMember(invitation.targetId, invitation.userId, 'member')
    } else {
      this.trips?.roles
        .get(invitation.targetId)
        ?.set(invitation.userId, invitation.role === 'viewer' ? 'viewer' : 'editor')
    }
    await this.delete(invitation.id)
    return true
  }
  async delete(id: string) {
    this.rows = this.rows.filter((r) => r.id !== id)
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
