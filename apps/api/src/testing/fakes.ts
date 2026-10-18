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
