import { TripBackup, isTripColor } from '@iplan/contracts'
import { isValidTimeZone, money, parseMoney, toDecimalString } from '@iplan/core'
import type { AuditLog } from '../../shared/audit'
import type { SessionUser } from '../../shared/context'
import { AppError, notFound, validationFailed } from '../../shared/errors'
import type { ChecklistRepository } from '../checklist/checklist.repository'
import type { ExpensesRepository } from '../expenses/expenses.repository'
import type { InfoCardsRepository } from '../info-cards/info-cards.repository'
import type { ItemsRepository } from '../items/items.repository'
import { checkItem } from '../items/items.service'
import type { TripsRepository } from '../trips/trips.repository'
import { type TripAccess, checkTripFields } from '../trips/trips.service'
import type { BackupRepository } from './backup.repository'
import { buildIcs } from './ics'

export interface BackupSources {
  trips: Pick<TripsRepository, 'members'>
  items: Pick<ItemsRepository, 'listByTrip'>
  checklist: Pick<ChecklistRepository, 'list'>
  infoCards: Pick<InfoCardsRepository, 'list'>
  expenses: Pick<ExpensesRepository, 'list'>
}

type ItemRow = Awaited<ReturnType<BackupSources['items']['listByTrip']>>[number]

function toEvent(item: ItemRow) {
  const details = item.details as {
    address?: string
    flightNumber?: string
    lat?: number
    lng?: number
  }
  return {
    uid: `${item.id}@iplan`,
    title: details.flightNumber ? `${item.title} (${details.flightNumber})` : item.title,
    start: item.startsAt,
    end: item.endsAt,
    location: details.address,
    geo:
      typeof details.lat === 'number' && typeof details.lng === 'number'
        ? { lat: details.lat, lng: details.lng }
        : undefined,
    description: item.notes ?? undefined,
    updatedAt: item.updatedAt,
  }
}

/** Calendar export, JSON backup and import of whole trips. */
export class BackupService {
  constructor(
    private readonly sources: BackupSources,
    private readonly backups: BackupRepository,
    private readonly access: TripAccess,
    private readonly audit: AuditLog,
  ) {}

  async calendar(actor: SessionUser, tripId: string): Promise<{ name: string; ics: string }> {
    const { trip } = await this.access.requireAccess(actor, tripId, 'viewer')
    const items = await this.sources.items.listByTrip(tripId)
    return { name: trip.name, ics: buildIcs(trip.name, items.map(toEvent)) }
  }

  /**
   * One plan item as an .ics file. Its UID is the same as in the trip feed, so
   * opening it again on iPhone updates the event instead of adding a copy.
   */
  async calendarItem(
    actor: SessionUser,
    tripId: string,
    itemId: string,
  ): Promise<{ name: string; ics: string }> {
    const { trip } = await this.access.requireAccess(actor, tripId, 'viewer')
    const item = (await this.sources.items.listByTrip(tripId)).find((i) => i.id === itemId)
    if (!item) throw notFound('Item')
    return { name: item.title, ics: buildIcs(trip.name, [toEvent(item)]) }
  }

  async export(actor: SessionUser, tripId: string): Promise<TripBackup> {
    const { trip } = await this.access.requireAccess(actor, tripId, 'viewer')
    const [items, checklist, infoCards, expenses, members] = await Promise.all([
      this.sources.items.listByTrip(tripId),
      this.sources.checklist.list(tripId),
      this.sources.infoCards.list(tripId),
      this.sources.expenses.list(tripId),
      this.sources.trips.members(tripId),
    ])
    const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? id
    return {
      format: 'iplan.trip',
      version: 1,
      exportedAt: new Date().toISOString(),
      trip: {
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        homeTimeZone: trip.homeTimeZone,
        baseCurrency: trip.baseCurrency,
        fxRates: trip.fxRates,
        dailyBudget:
          trip.dailyBudgetMinor === null
            ? null
            : toDecimalString(money(trip.dailyBudgetMinor, trip.baseCurrency)),
        color: trip.color,
      },
      items: items.map((i) => ({
        dayDate: i.dayDate,
        kind: i.kind,
        title: i.title,
        startsAt: i.startsAt.toISOString(),
        endsAt: i.endsAt?.toISOString() ?? null,
        timeZone: i.timeZone,
        notes: i.notes,
        details: i.details,
      })),
      checklist: checklist.map((c) => ({ groupKey: c.groupKey, title: c.title })),
      infoCards: infoCards.map((c) => ({ kind: c.kind, title: c.title, body: c.body })),
      expenses: expenses.map(({ expense, shares }) => ({
        dayDate: expense.dayDate,
        title: expense.title,
        category: expense.category,
        amount: toDecimalString(money(expense.amountMinor, expense.currency)),
        currency: expense.currency,
        fxRate: expense.fxRate,
        paidBy: expense.paidBy === 'pool' ? 'pool' : nameOf(expense.paidBy),
        shares: Object.fromEntries(
          shares.map((s) => [
            nameOf(s.userId),
            toDecimalString(money(s.amountMinor, expense.currency)),
          ]),
        ),
      })),
    }
  }

  /** Creates a new trip owned by the caller from a backup file. */
  async import(actor: SessionUser, raw: unknown): Promise<{ tripId: string }> {
    const parsed = TripBackup.safeParse(raw)
    if (!parsed.success) {
      throw validationFailed({ file: 'This is not an iPlan trip file' })
    }
    const data = parsed.data
    const zones = [data.trip.homeTimeZone, ...data.items.map((i) => i.timeZone)]
    if (zones.some((z) => !isValidTimeZone(z)))
      throw validationFailed({ file: 'Unknown time zone in file' })
    // Same rules as creating a trip and its items by hand (date order, 60-day limit...).
    const fileProblem = (check: () => void, what: string) => {
      try {
        check()
      } catch (error) {
        if (!(error instanceof AppError)) throw error
        const detail = Object.values(error.fields ?? {})[0] ?? error.message
        throw validationFailed({ file: `${what}: ${detail}` })
      }
    }
    fileProblem(() => checkTripFields(data.trip), 'Trip')
    for (const i of data.items) {
      fileProblem(
        () =>
          checkItem(data.trip, {
            dayDate: i.dayDate,
            startsAt: new Date(i.startsAt),
            endsAt: i.endsAt ? new Date(i.endsAt) : null,
            timeZone: i.timeZone,
            details: i.details ?? {},
          }),
        `"${i.title}"`,
      )
    }

    let dailyBudgetMinor: bigint | null = null
    if (data.trip.dailyBudget) {
      try {
        dailyBudgetMinor = parseMoney(data.trip.dailyBudget, data.trip.baseCurrency).amount
      } catch {
        throw validationFailed({ file: 'Invalid daily budget' })
      }
    }
    const tripId = await this.backups.importTrip(actor.id, {
      trip: {
        name: data.trip.name,
        destination: data.trip.destination ?? null,
        startDate: data.trip.startDate,
        endDate: data.trip.endDate,
        homeTimeZone: data.trip.homeTimeZone,
        baseCurrency: data.trip.baseCurrency,
        // The base currency is always 1:1, so it is never stored.
        fxRates: Object.fromEntries(
          Object.entries(data.trip.fxRates).filter(([code]) => code !== data.trip.baseCurrency),
        ),
        dailyBudgetMinor,
        color: isTripColor(data.trip.color) ? data.trip.color : null,
        createdBy: actor.id,
      },
      items: data.items.map((i, index) => ({
        dayDate: i.dayDate,
        kind: i.kind,
        title: i.title,
        startsAt: new Date(i.startsAt),
        endsAt: i.endsAt ? new Date(i.endsAt) : null,
        timeZone: i.timeZone,
        notes: i.notes ?? null,
        details: i.details ?? {},
        sortOrder: index,
      })),
      checklist: data.checklist.map((c, index) => ({ ...c, sortOrder: index })),
      infoCards: data.infoCards.map((c, index) => ({ ...c, sortOrder: index })),
    })
    await this.audit.record({
      actorId: actor.id,
      action: 'trip.import',
      entityType: 'trip',
      entityId: tripId,
      data: {
        items: data.items.length,
        checklist: data.checklist.length,
        infoCards: data.infoCards.length,
      },
    })
    return { tripId }
  }
}
